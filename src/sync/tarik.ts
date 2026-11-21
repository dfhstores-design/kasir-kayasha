/**
 * Menerapkan perubahan yang ditarik dari hub (D1) ke IndexedDB lokal
 * (Fase 2B, BU-33: sync banyak arah).
 *
 * ATURAN KONFLIK (BU-33) yang dijaga di sini:
 *  1. Uang/transaksi APPEND-ONLY: pembayaran & item baru ditambah, yang sudah
 *     ada TIDAK PERNAH ditimpa. Total hanya boleh berubah lewat edit yang
 *     lebih baru (ubahPesananJahit) — dan pembayaran lokal tetap dipertahankan.
 *  2. Data master (produk/bazar) digabung 3-arah dari bayangan: kolom yang
 *     hanya berubah di satu sisi diambil dari sisi itu; kolom yang berubah
 *     di dua sisi diputus dengan yang terbaru + dicatat di log.
 *  3. Status hanya boleh maju (pesanan & bayar); batal bersifat final.
 *  4. Pengaman diam-diam: yang tidak bisa diputus / gagal diterapkan hanya
 *     masuk logSinkron untuk owner — tidak memblokir, tidak ada antrean.
 *
 * Laporan tetap memakai `waktu` (tanggal transaksi); `terakhirSyncPada`
 * hanya mencatat kapan transaksi ini terakhir tersinkron.
 */
import type { IDBPDatabase } from "idb";
import {
  getDB,
  KATEGORI_BIAYA,
  type BazarRecord,
  type JournalRecord,
  type KasirDB,
  type LogSinkronRecord,
  type ProdukRecord,
  type SettingsRecord,
  type TransaksiRecord,
} from "../db/schema.ts";
import { buatId, SETTINGS_KOSONG } from "../db/repositori.ts";
import { recomputeJurnalDariDokumen } from "../lib/jurnal.ts";
import { sapaanDariWaktu } from "../lib/sapaan.ts";
import { periksaKiriman, type Kiriman, type KirimanBazar, type KirimanBiayaBazar, type KirimanPin, type KirimanProduk, type KirimanTransaksi, type Perubahan } from "./logika.ts";

type DB = IDBPDatabase<KasirDB>;

export interface KonteksTarik {
  perangkatId: string;
  /** Waktu ISO saat tarik berjalan (dipakai `terakhirSyncPada`). */
  sekarang: string;
}

export interface HasilTarik {
  transaksiBaru: number;
  transaksiDigabung: number;
  produkDigabung: number;
  bazarDigabung: number;
  /** Biaya bazar yang masuk/dihapus dari hub (F1). */
  biayaBazarDigabung: number;
  /** PIN peran yang diterapkan dari hub (F3). */
  pinDigabung: number;
  konflik: number;
  /** `diubah_pada` terbaru di antara semua baris yang diterima (kursor). */
  kursorBaru: string | null;
}

/** Urutan maju status pesanan (BU-33): tidak boleh mundur. */
const PERINGKAT_PESANAN: Record<string, number> = {
  diproses: 0,
  siap: 1,
  selesai: 2,
  dibatalkan: 3,
};

/** Urutan maju status bayar (BU-33): tidak boleh mundur. */
const PERINGKAT_BAYAR: Record<string, number> = {
  belum_dibayar: 0,
  dp: 1,
  lunas: 2,
};

function peringkat(peta: Record<string, number>, nilai: string): number {
  return peta[nilai] ?? -1;
}

function sama(a: unknown, b: unknown): boolean {
  return a === b;
}

/** Mencatat ke log sinkronisasi (hanya dibaca owner). Tidak pernah melempar. */
export async function catatLogSinkron(
  db: DB,
  entri: { jenis: LogSinkronRecord["jenis"]; judul: string; rincian: string; perangkat?: string | null },
): Promise<void> {
  try {
    await db.put("logSinkron", {
      id: buatId(),
      waktu: new Date().toISOString(),
      jenis: entri.jenis,
      judul: entri.judul,
      rincian: entri.rincian,
      perangkat: entri.perangkat ?? null,
    });
  } catch {
    // Log gagal ditulis: sync tetap jalan — log hanyalah catatan.
  }
}

/**
 * Gabung 3-arah satu record master (produk/bazar).
 * `bayangan` = snapshot terakhir yang diketahui hub (null = belum pernah sync).
 * Tanpa bayangan: yang terbaru menang utuh; bila waktu sama tapi isi beda,
 * lokal dipertahankan + dicatat sebagai konflik.
 */
export function gabungMaster<T extends Record<string, unknown>>(
  lokal: T,
  jauh: T,
  bayangan: T | null,
  kolom: Array<keyof T & string>,
  waktuLokal: string,
  waktuJauh: string,
): { hasil: T; konflik: string[] } {
  const konflik: string[] = [];
  const hasil = { ...lokal } as T;

  if (!bayangan) {
    if (waktuJauh > waktuLokal) {
      for (const k of kolom) hasil[k] = jauh[k];
      return { hasil, konflik };
    }
    if (waktuJauh === waktuLokal) {
      for (const k of kolom) {
        if (!sama(lokal[k], jauh[k])) konflik.push(String(k));
      }
    }
    return { hasil, konflik };
  }

  for (const k of kolom) {
    const lv = lokal[k];
    const jv = jauh[k];
    const bv = bayangan[k];
    if (sama(lv, jv)) continue;
    if (sama(lv, bv)) {
      // Hanya sisi jauh yang berubah.
      hasil[k] = jv;
    } else if (sama(jv, bv)) {
      // Hanya sisi lokal yang berubah: pertahankan lokal.
    } else {
      // Dua sisi mengubah kolom yang sama: yang terbaru menang + dicatat.
      konflik.push(String(k));
      hasil[k] = waktuJauh > waktuLokal ? jv : lv;
    }
  }
  return { hasil, konflik };
}

/** Menulis bayangan (snapshot terakhir yang diketahui hub) untuk satu record. */
export async function simpanBayanganUntuk(
  db: DB,
  jenis: "produk" | "bazar",
  idRecord: string,
): Promise<void> {
  const record = jenis === "produk" ? await db.get("products", idRecord) : await db.get("bazars", idRecord);
  if (!record) return;
  const diubahPada =
    jenis === "produk"
      ? (record as ProdukRecord).updatedAt
      : ((record as BazarRecord).updatedAt ?? (record as BazarRecord).createdAt);
  await simpanBayangan(db, jenis, idRecord, record as unknown as Record<string, unknown>, diubahPada);
}

async function simpanBayangan(
  db: DB,
  jenis: "produk" | "bazar",
  idRecord: string,
  data: Record<string, unknown>,
  diubahPada: string,
): Promise<void> {
  await db.put("bayangan", {
    id: `${jenis}:${idRecord}`,
    jenis,
    idRecord,
    data,
    diubahPada,
  });
}

/** Jurnal turunan untuk satu dokumen ditulis ulang dari pembayarannya (BU-02).
 *  Baris "pembatalan" (void) TIDAK dihapus — itu jejak audit, bukan turunan. */
async function sinkronkanJurnal(db: DB, t: TransaksiRecord): Promise<void> {
  const pembayaran = await db.getAllFromIndex("payments", "by-transaksi", t.id);
  const lama = await db.getAllFromIndex("journal", "by-dokumen", t.id);
  const tx = db.transaction("journal", "readwrite");
  for (const baris of lama) {
    if (baris.kategori === "dp" || baris.kategori === "pelunasan") {
      await tx.store.delete(baris.id);
    }
  }
  for (const baris of recomputeJurnalDariDokumen(
    { id: t.id, total: t.total },
    pembayaran.map((p) => ({ nominal: p.nominal, waktu: p.waktu })),
  )) {
    const utuh: JournalRecord = { ...baris, id: buatId() };
    await tx.store.put(utuh);
  }
  await tx.done;

  if (t.dibatalkanPada) {
    const sesudah = await db.getAllFromIndex("journal", "by-dokumen", t.id);
    const adaBatal = sesudah.some((b) => b.kategori === "pembatalan");
    if (!adaBatal) {
      const terbayar = pembayaran.reduce((n, p) => n + p.nominal, 0);
      if (terbayar > 0) {
        const alasan = (t.catatanPesanan ?? "").includes("Dibatalkan:")
          ? (t.catatanPesanan ?? "").split("Dibatalkan:")[1]!.trim()
          : "Dibatalkan dari perangkat lain";
        await db.put("journal", {
          id: buatId(),
          arah: "keluar",
          kategori: "pembatalan",
          nominal: terbayar,
          waktu: t.dibatalkanPada,
          dokumenId: t.id,
          pemilik: "usaha",
          sumber: "usaha",
          catatan: alasan,
        });
      }
    }
  }
}

/** Menerapkan satu transaksi dari hub (append-only, BU-33). */
async function terapkanTransaksi(db: DB, k: KirimanTransaksi, ctx: KonteksTarik): Promise<"baru" | "gabung"> {
  const lokal = await db.get("transactions", k.id);
  const sekarang = ctx.sekarang;

  if (!lokal) {
    const baru: TransaksiRecord = {
      id: k.id,
      nomorResi: k.nomorResi,
      nomorUrutHari: 0,
      ...(k.nomorUrutBulan !== undefined ? { nomorUrutBulan: k.nomorUrutBulan } : {}),
      ...(k.nomorUrutSementara === true ? { nomorUrutSementara: true as const } : {}),
      waktu: k.waktu,
      jenis: k.jenisDokumen === "jasa" ? "po" : "langsung",
      jenisDokumen: k.jenisDokumen,
      arahStok: k.arahStok,
      pelangganId: k.pelangganId,
      statusPesanan: (PERINGKAT_PESANAN[k.statusPesanan] ?? -1) >= 0
        ? (k.statusPesanan as TransaksiRecord["statusPesanan"])
        : "diproses",
      bazarId: k.bazarId,
      namaPemesan: k.namaPemesan,
      kontak: k.kontak ?? null,
      perkiraanSiap: k.perkiraanSiap ?? null,
      alamat: k.alamat ?? null,
      catatanPesanan: k.catatanPesanan ?? null,
      riwayatTotal: [],
      ongkirMode: k.ongkirMode as TransaksiRecord["ongkirMode"],
      ongkirNominal: k.ongkirNominal,
      subtotalAwal: k.subtotalAwal,
      diskonItem: k.diskonItem,
      diskonTotal: k.diskonTotal,
      total: k.total,
      sapaan: sapaanDariWaktu(new Date(k.waktu)),
      rekeningSnapshot: [],
      jenisBayar: (k.jenisBayar as TransaksiRecord["jenisBayar"]) ?? null,
      statusBayar: (PERINGKAT_BAYAR[k.statusBayar] ?? -1) >= 0
        ? (k.statusBayar as TransaksiRecord["statusBayar"])
        : "belum_dibayar",
      dibatalkanPada: k.dibatalkanPada,
      terakhirSyncPada: sekarang,
      createdAt: k.dibuatPada,
      updatedAt: k.diubahPada,
    };
    const tx = db.transaction(["transactions", "transaction_items", "payments", "pelanggan"], "readwrite");
    await tx.objectStore("transactions").put(baru);
    for (const [idx, it] of k.items.entries()) {
      await tx.objectStore("transaction_items").put({
        id: it.id,
        transaksiId: k.id,
        produkId: it.produkId,
        namaSnapshot: it.namaSnapshot,
        hargaSatuan: it.hargaSatuan,
        kuantitas: it.kuantitas,
        diskonPerUnit: it.diskonPerUnit,
        subtotalBersih: it.subtotalBersih,
        ukuran: it.ukuran ?? null,
        urutan: it.urutan ?? idx,
      });
    }
    for (const p of k.pembayaran) {
      await tx.objectStore("payments").put({
        id: p.id,
        transaksiId: k.id,
        nominal: p.nominal,
        waktu: p.waktu,
        metode: p.metode,
        catatan: p.catatan ?? null,
      });
    }
    if (k.pelangganId) {
      const ada = await tx.objectStore("pelanggan").get(k.pelangganId);
      if (!ada) {
        await tx.objectStore("pelanggan").put({
          id: k.pelangganId,
          nama: k.namaPemesan ?? "Pelanggan",
          kontak: k.kontak ?? null,
        });
      }
    }
    await tx.done;
    await sinkronkanJurnal(db, baru);
    return "baru";
  }

  // Sudah ada lokal: gabung append-only.
  const itemsLokal = await db.getAllFromIndex("transaction_items", "by-transaksi", k.id);
  const bayarLokal = await db.getAllFromIndex("payments", "by-transaksi", k.id);
  const idItemLokal = new Set(itemsLokal.map((i) => i.id));
  const idBayarLokal = new Set(bayarLokal.map((p) => p.id));

  let gabung: TransaksiRecord = { ...lokal, terakhirSyncPada: sekarang };

  if (k.diubahPada > lokal.updatedAt) {
    // Edit yang lebih baru dari perangkat lain (mis. ubahPesananJahit,
    // atau perbaikan nomor sementara F4): ambil isi terbaru, TAPI
    // pembayaran lokal tidak pernah dihapus.
    gabung = {
      ...gabung,
      // Nomor dokumen ikut diperbarui bila hub membawa yang lebih baru
      // (perbaikan nomor sementara F4) — nomor lama yang sementara
      // diganti nomor resmi dari hub.
      nomorResi: k.nomorResi,
      ...(k.nomorUrutBulan !== undefined
        ? { nomorUrutBulan: k.nomorUrutBulan }
        : lokal.nomorUrutBulan !== undefined
          ? { nomorUrutBulan: lokal.nomorUrutBulan }
          : {}),
      nomorUrutSementara: k.nomorUrutSementara === true,
      namaPemesan: k.namaPemesan,
      kontak: k.kontak ?? lokal.kontak,
      catatanPesanan: k.catatanPesanan ?? lokal.catatanPesanan,
      perkiraanSiap: k.perkiraanSiap ?? lokal.perkiraanSiap,
      alamat: k.alamat ?? lokal.alamat,
      jenisBayar: (k.jenisBayar as TransaksiRecord["jenisBayar"]) ?? lokal.jenisBayar,
      ongkirMode: k.ongkirMode as TransaksiRecord["ongkirMode"],
      ongkirNominal: k.ongkirNominal,
      subtotalAwal: k.subtotalAwal,
      diskonItem: k.diskonItem,
      diskonTotal: k.diskonTotal,
      total: k.total,
      // Status tetap hanya boleh maju (BU-33) — walau editnya lebih baru,
      // status lama yang lebih maju tidak boleh mundur.
      statusPesanan:
        (PERINGKAT_PESANAN[k.statusPesanan] ?? -1) >= 0 &&
        peringkat(PERINGKAT_PESANAN, k.statusPesanan) >= peringkat(PERINGKAT_PESANAN, lokal.statusPesanan)
          ? (k.statusPesanan as TransaksiRecord["statusPesanan"])
          : lokal.statusPesanan,
      statusBayar:
        (PERINGKAT_BAYAR[k.statusBayar] ?? -1) >= 0 &&
        peringkat(PERINGKAT_BAYAR, k.statusBayar) >= peringkat(PERINGKAT_BAYAR, lokal.statusBayar)
          ? (k.statusBayar as TransaksiRecord["statusBayar"])
          : lokal.statusBayar,
      dibatalkanPada: k.dibatalkanPada ?? lokal.dibatalkanPada,
      updatedAt: k.diubahPada,
    };
    // Baris item diganti utuh dengan versi terbaru (edit menulis ulang item).
    const tx = db.transaction("transaction_items", "readwrite");
    for (const lama of itemsLokal) await tx.objectStore("transaction_items").delete(lama.id);
    for (const [idx, it] of k.items.entries()) {
      await tx.objectStore("transaction_items").put({
        id: it.id,
        transaksiId: k.id,
        produkId: it.produkId,
        namaSnapshot: it.namaSnapshot,
        hargaSatuan: it.hargaSatuan,
        kuantitas: it.kuantitas,
        diskonPerUnit: it.diskonPerUnit,
        subtotalBersih: it.subtotalBersih,
        ukuran: it.ukuran ?? null,
        urutan: it.urutan ?? idx,
      });
    }
    await tx.done;
  } else {
    // Sama atau lebih lama: hanya tambah yang belum ada + status maju.
    if (k.diubahPada === lokal.updatedAt && k.total !== lokal.total) {
      await catatLogSinkron(db, {
        jenis: "konflik",
        judul: `Pesanan ${lokal.nomorResi} diubah di dua tempat`,
        rincian: `Total berbeda di waktu yang sama — dipakai versi perangkat ini (Rp${lokal.total.toLocaleString("id-ID")}).`,
        perangkat: k.perangkat ?? null,
      });
    }
    if (peringkat(PERINGKAT_PESANAN, k.statusPesanan) > peringkat(PERINGKAT_PESANAN, lokal.statusPesanan)) {
      gabung = { ...gabung, statusPesanan: k.statusPesanan as TransaksiRecord["statusPesanan"] };
    }
    if (peringkat(PERINGKAT_BAYAR, k.statusBayar) > peringkat(PERINGKAT_BAYAR, lokal.statusBayar)) {
      gabung = { ...gabung, statusBayar: k.statusBayar as TransaksiRecord["statusBayar"] };
    }
    if (k.dibatalkanPada && !lokal.dibatalkanPada) {
      gabung = { ...gabung, statusPesanan: "dibatalkan", dibatalkanPada: k.dibatalkanPada };
    }
    const tx = db.transaction("transaction_items", "readwrite");
    for (const [idx, it] of k.items.entries()) {
      if (idItemLokal.has(it.id)) continue;
      await tx.objectStore("transaction_items").put({
        id: it.id,
        transaksiId: k.id,
        produkId: it.produkId,
        namaSnapshot: it.namaSnapshot,
        hargaSatuan: it.hargaSatuan,
        kuantitas: it.kuantitas,
        diskonPerUnit: it.diskonPerUnit,
        subtotalBersih: it.subtotalBersih,
        ukuran: it.ukuran ?? null,
        urutan: it.urutan ?? idx,
      });
    }
    await tx.done;
  }

  // Pembayaran SELALU ditambah bila belum ada (append-only) — di kedua jalur.
  const txBayar = db.transaction("payments", "readwrite");
  for (const p of k.pembayaran) {
    if (idBayarLokal.has(p.id)) continue;
    await txBayar.objectStore("payments").put({
      id: p.id,
      transaksiId: k.id,
      nominal: p.nominal,
      waktu: p.waktu,
      metode: p.metode,
      catatan: p.catatan ?? null,
    });
  }
  await txBayar.done;

  await db.put("transactions", gabung);
  await sinkronkanJurnal(db, gabung);
  return "gabung";
}

/** Menerapkan satu produk dari hub (gabung 3-arah, BU-33). */
async function terapkanProduk(db: DB, k: KirimanProduk, ctx: KonteksTarik): Promise<void> {
  const lokal = await db.get("products", k.id);
  const jauh: ProdukRecord = {
    id: k.id,
    nama: k.nama,
    kode: k.kode,
    hargaJual: k.hargaJual,
    stokGudang: k.stokGudang,
    catatan: k.catatan ?? null,
    arsip: k.arsip,
    createdAt: lokal?.createdAt ?? k.diubahPada,
    updatedAt: k.diubahPada,
  };

  if (!lokal) {
    await db.put("products", jauh);
    await simpanBayangan(db, "produk", k.id, jauh as unknown as Record<string, unknown>, k.diubahPada);
    return;
  }

  const bayangan = await db.get("bayangan", `produk:${k.id}`);
  const { hasil, konflik } = gabungMaster(
    lokal as unknown as Record<string, unknown>,
    jauh as unknown as Record<string, unknown>,
    (bayangan?.data as Record<string, unknown> | undefined) ?? null,
    ["nama", "kode", "hargaJual", "stokGudang", "catatan", "arsip"],
    lokal.updatedAt,
    k.diubahPada,
  );
  const hasilProduk = {
    ...(hasil as unknown as ProdukRecord),
    updatedAt: lokal.updatedAt > k.diubahPada ? lokal.updatedAt : k.diubahPada,
  };
  await db.put("products", hasilProduk);
  await simpanBayangan(
    db,
    "produk",
    k.id,
    hasilProduk as unknown as Record<string, unknown>,
    hasilProduk.updatedAt,
  );
  if (konflik.length > 0) {
    await catatLogSinkron(db, {
      jenis: "konflik",
      judul: `Barang "${lokal.nama}" diubah di dua tempat`,
      rincian: `Kolom ${konflik.join(", ")} berbeda — dipakai yang terbaru (${hasilProduk.updatedAt}).`,
      perangkat: ctx.perangkatId,
    });
  }
}

/** Menerapkan satu bazar dari hub (gabung 3-arah, BU-33). */
async function terapkanBazar(db: DB, k: KirimanBazar, ctx: KonteksTarik): Promise<void> {
  const lokal = await db.get("bazars", k.id);
  const waktuLokal = lokal?.updatedAt ?? lokal?.createdAt ?? "";
  const jauh: BazarRecord = {
    id: k.id,
    nama: k.nama,
    mulai: k.mulai,
    selesai: k.selesai,
    lokasi: k.lokasi,
    catatan: k.catatan ?? null,
    status: (k.status === "selesai" ? "selesai" : "aktif") as BazarRecord["status"],
    pinKasirHash: k.pinKasirHash ?? null,
    ringkasanTerjual: lokal?.ringkasanTerjual ?? null,
    ringkasanDibawa: lokal?.ringkasanDibawa ?? null,
    ringkasanSisa: lokal?.ringkasanSisa ?? null,
    ditutupPada: lokal?.ditutupPada ?? null,
    createdAt: lokal?.createdAt ?? k.diubahPada,
    updatedAt: k.diubahPada,
  };

  if (!lokal) {
    await db.put("bazars", jauh);
    await simpanBayangan(db, "bazar", k.id, jauh as unknown as Record<string, unknown>, k.diubahPada);
    return;
  }

  const bayangan = await db.get("bayangan", `bazar:${k.id}`);
  const { hasil, konflik } = gabungMaster(
    lokal as unknown as Record<string, unknown>,
    jauh as unknown as Record<string, unknown>,
    (bayangan?.data as Record<string, unknown> | undefined) ?? null,
    ["nama", "status", "lokasi", "mulai", "selesai", "catatan", "pinKasirHash"],
    waktuLokal,
    k.diubahPada,
  );
  const hasilBazar = {
    ...(hasil as unknown as BazarRecord),
    // Tutup bazar bersifat final: sekali selesai, tetap selesai.
    status: (lokal.status === "selesai" || jauh.status === "selesai" ? "selesai" : "aktif") as BazarRecord["status"],
    updatedAt: waktuLokal > k.diubahPada ? waktuLokal : k.diubahPada,
  };
  await db.put("bazars", hasilBazar);
  await simpanBayangan(db, "bazar", k.id, hasilBazar as unknown as Record<string, unknown>, hasilBazar.updatedAt);
  if (konflik.length > 0) {
    await catatLogSinkron(db, {
      jenis: "konflik",
      judul: `Bazar "${lokal.nama}" diubah di dua tempat`,
      rincian: `Kolom ${konflik.join(", ")} berbeda — dipakai yang terbaru (${hasilBazar.updatedAt}).`,
      perangkat: ctx.perangkatId,
    });
  }
}

/**
 * Menerapkan satu biaya bazar dari hub (F1, BU-34). Biaya tidak pernah
 * diubah di aplikasi, jadi gabungnya sederhana: yang terbaru menang,
 * tombstone menghapus baris lokal. Mengembalikan true bila ada yang berubah.
 */
async function terapkanBiayaBazar(db: DB, k: KirimanBiayaBazar): Promise<boolean> {
  if (k.dihapus === true) {
    const lokal = await db.get("bazar_biaya", k.id);
    if (!lokal) return false;
    await db.delete("bazar_biaya", k.id);
    return true;
  }
  if (!(KATEGORI_BIAYA as readonly string[]).includes(k.kategori)) return false;
  const lokal = await db.get("bazar_biaya", k.id);
  // Baris lokal yang sama/lebih baru dipertahankan (tidak ada edit biaya,
  // jadi ini hanya pengaman jam perangkat yang selisih).
  if (lokal && k.diubahPada <= lokal.createdAt) return false;
  await db.put("bazar_biaya", {
    id: k.id,
    bazarId: k.bazarId ?? "",
    kategori: k.kategori,
    judul: k.judul,
    nominal: k.nominal,
    tanggal: k.tanggal,
    catatan: k.catatan ?? null,
    createdAt: k.dibuatPada,
  });
  return true;
}

/**
 * Menerapkan satu PIN peran dari hub (F3, BU-32/33). Yang diterapkan
 * hanya hash — PIN teks biasa tidak pernah sampai ke sini. Yang terbaru
 * menang (dibandingkan dengan `pinDiubahPada` lokal):
 *  - Jauh lebih baru (atau lokal belum pernah atur) → hash dipakai.
 *  - Lokal lebih baru → lokal dipertahankan, antrean kirim ditandai ulang
 *    supaya hub menerima yang terbaru, dan bentroknya dicatat di log.
 *  - Waktu sama → sudah sama, tidak ada yang diubah.
 * Mengembalikan true bila ada yang berubah di perangkat ini.
 */
async function terapkanPin(db: DB, k: KirimanPin, ctx: KonteksTarik): Promise<boolean> {
  const tersimpan = (await db.get("settings", "utama")) ?? (SETTINGS_KOSONG as SettingsRecord);
  const waktuLokal = tersimpan.pinDiubahPada?.[k.peran];
  if (waktuLokal !== undefined && k.diubahPada < waktuLokal) {
    // Lokal lebih baru: pertahankan + kirim ulang supaya hub ikut terbaru.
    const { tandaiUntukSync } = await import("./mesin.ts");
    await tandaiUntukSync("pin", k.id);
    await catatLogSinkron(db, {
      jenis: "konflik",
      judul: `PIN ${k.peran === "admin" ? "admin" : k.peran === "owner" ? "owner" : "kasir toko"} diubah di dua tempat`,
      rincian: "Dipakai PIN yang diatur terakhir di perangkat ini.",
      perangkat: ctx.perangkatId,
    });
    return false;
  }
  if (waktuLokal !== undefined && k.diubahPada === waktuLokal) return false;
  const baru: SettingsRecord = {
    ...tersimpan,
    pinDiubahPada: { ...(tersimpan.pinDiubahPada ?? {}), [k.peran]: k.diubahPada },
  };
  if (k.peran === "admin") baru.pinHash = k.hash;
  else if (k.peran === "owner") baru.pinOwnerHash = k.hash;
  else baru.pinKasirTokoHash = k.hash;
  await db.put("settings", { ...baru, id: "utama", updatedAt: new Date().toISOString() });
  return true;
}

/**
 * Menerapkan satu paket perubahan dari hub. Satu baris yang rusak dicatat
 * di log lalu dilewati — tidak pernah menggagalkan paket lainnya.
 */
export async function terapkanPerubahan(db: DB, perubahan: Perubahan, ctx: KonteksTarik): Promise<HasilTarik> {
  const hasil: HasilTarik = {
    transaksiBaru: 0,
    transaksiDigabung: 0,
    produkDigabung: 0,
    bazarDigabung: 0,
    biayaBazarDigabung: 0,
    pinDigabung: 0,
    konflik: 0,
    kursorBaru: null,
  };
  let kursor: string | null = null;
  const catatKursor = (waktu: string) => {
    if (!kursor || waktu > kursor) kursor = waktu;
  };

  const semua: Kiriman[] = [
    ...perubahan.transaksi,
    ...perubahan.produk,
    ...perubahan.bazar,
    ...perubahan.biayaBazar,
    ...perubahan.pin,
  ];
  for (const mentah of semua) {
    const cek = periksaKiriman(mentah);
    if (!cek.ok) {
      hasil.konflik += 1;
      await catatLogSinkron(db, {
        jenis: "konflik",
        judul: "Kiriman dari hub tidak bisa dipakai",
        rincian: cek.pesan,
        perangkat: ctx.perangkatId,
      });
      continue;
    }
    const k = cek.nilai;
    try {
      if (k.jenis === "transaksi") {
        const jenis = await terapkanTransaksi(db, k, ctx);
        if (jenis === "baru") hasil.transaksiBaru += 1;
        else hasil.transaksiDigabung += 1;
      } else if (k.jenis === "produk") {
        await terapkanProduk(db, k, ctx);
        hasil.produkDigabung += 1;
      } else if (k.jenis === "bazar") {
        await terapkanBazar(db, k, ctx);
        hasil.bazarDigabung += 1;
      } else if (k.jenis === "biaya_bazar") {
        if (await terapkanBiayaBazar(db, k)) hasil.biayaBazarDigabung += 1;
      } else {
        if (await terapkanPin(db, k, ctx)) hasil.pinDigabung += 1;
      }
      catatKursor(k.diubahPada);
    } catch (e) {
      hasil.konflik += 1;
      await catatLogSinkron(db, {
        jenis: "konflik",
        judul: "Gagal menerapkan kiriman dari hub",
        rincian: e instanceof Error ? e.message : "gagal diterapkan.",
        perangkat: ctx.perangkatId,
      });
    }
  }

  hasil.kursorBaru = kursor;
  return hasil;
}

/** Membuka database (untuk pemakaian di luar tes). */
export async function bukaDBTarik(): Promise<DB> {
  return getDB();
}
