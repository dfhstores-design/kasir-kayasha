/**
 * Logika sinkronisasi cloud (Phase 6) — TANPA dependensi runtime Cloudflare.
 *
 * Dipisah dari `functions/api/sync.ts` supaya bisa diuji dengan database tiruan
 * (lihat `sync.test.ts`). Handler hanya menyambungkan ke D1.
 *
 * JAMINAN UTAMA:
 *  1. Perangkat tetap sumber kebenaran; sinkronisasi tidak pernah memblokir penjualan.
 *  2. Idempoten: mengirim kiriman yang sama dua kali tidak menggandakan baris.
 *  3. Kiriman yang tidak valid DITOLAK per-kiriman, bukan menggagalkan seluruh batch.
 */

import type { JenisDokumen, ArahStok, KategoriBiaya } from "../db/schema.ts";
import { KATEGORI_BIAYA } from "../db/schema.ts";

export type JenisKiriman = "transaksi" | "produk" | "bazar" | "biaya_bazar";

export interface KirimanTransaksi {
  jenis: "transaksi";
  id: string;
  nomorResi: string;
  waktu: string;
  jenisDokumen: JenisDokumen;
  arahStok: ArahStok;
  pelangganId: string | null;
  statusPesanan: string;
  statusBayar: string;
  bazarId: string | null;
  namaPemesan: string | null;
  /** Kontak pemesan (Fase 2B: ikut tersinkron agar pesanan jahit utuh di perangkat lain). */
  kontak?: string | null;
  /** Catatan pesanan (Fase 2B). */
  catatanPesanan?: string | null;
  /** Perkiraan siap (Fase 2B). */
  perkiraanSiap?: string | null;
  /** Alamat kirim (Fase 2B). */
  alamat?: string | null;
  /** Nomor urut pesanan jahit dalam bulan (BU-19/21, Fase 2B). */
  nomorUrutBulan?: number;
  /** Jenis bayar terakhir (Fase 2B). */
  jenisBayar?: string | null;
  ongkirMode: string;
  ongkirNominal: number | null;
  subtotalAwal: number;
  diskonItem: number;
  diskonTotal: number;
  total: number;
  dibatalkanPada: string | null;
  dibuatPada: string;
  diubahPada: string;
  /** Id perangkat pengirim (Fase 2B): dipakai pull untuk tidak mengembalikan
   *  baris ke perangkat yang mengirimnya. */
  perangkat?: string;
  items: Array<{
    id: string;
    produkId: string | null;
    namaSnapshot: string;
    hargaSatuan: number;
    kuantitas: number;
    diskonPerUnit: number;
    subtotalBersih: number;
    /** Ukuran/catatan khusus per baris item (BU-56, Fase 2B). */
    ukuran?: string | null;
    /** Urutan baris seperti diinput (BU-56, Fase 2B). */
    urutan?: number;
  }>;
  pembayaran: Array<{
    id: string;
    nominal: number;
    waktu: string;
    metode: string | null;
    /** Catatan pembayaran (Fase 2B). */
    catatan?: string | null;
  }>;
}

export interface KirimanProduk {
  jenis: "produk";
  id: string;
  nama: string;
  kode: string | null;
  hargaJual: number;
  stokGudang: number;
  /** Catatan barang (Fase 2B). */
  catatan?: string | null;
  arsip: boolean;
  diubahPada: string;
}

export interface KirimanBazar {
  jenis: "bazar";
  id: string;
  nama: string;
  status: string;
  lokasi: string | null;
  mulai: string | null;
  selesai: string | null;
  /** Catatan bazar (Fase 2B). */
  catatan?: string | null;
  /** Hash PIN kasir bazar ini (Fase 2B, BU-34): harus ikut tersinkron agar
   *  kasir di perangkat lain bisa masuk ke bazar yang sama. Hash, bukan PIN. */
  pinKasirHash?: string | null;
  diubahPada: string;
}

/**
 * Satu pengeluaran bazar (F1, BU-34): harus tersinkron agar owner di
 * perangkat lain bisa melihat biaya saat rekonsiliasi tutup bazar.
 * Biaya tidak pernah diubah (hanya tambah + hapus di aplikasi), jadi
 * `diubahPada` = `dibuatPada` untuk kiriman biasa. `dihapus` = tombstone:
 * baris ini sudah dihapus di perangkat pengirim; hub menyimpannya sebagai
 * penanda hapus supaya perangkat lain ikut menghapus.
 */
export interface KirimanBiayaBazar {
  jenis: "biaya_bazar";
  id: string;
  bazarId: string | null;
  kategori: KategoriBiaya;
  judul: string;
  nominal: number;
  tanggal: string;
  catatan?: string | null;
  dibuatPada: string;
  diubahPada: string;
  perangkat?: string;
  dihapus?: boolean;
}

export type Kiriman = KirimanTransaksi | KirimanProduk | KirimanBazar | KirimanBiayaBazar;

export interface HasilKirim {
  diterima: string[];
  ditolak: Array<{ id: string; pesan: string }>;
}

/** Antarmuka database yang dibutuhkan sinkronisasi (supaya bisa diuji). */
export interface DBCloud {
  /** Menjalankan pernyataan SQL; `bind` mengikat parameter. */
  prepare(sql: string): {
    bind(...nilai: unknown[]): {
      run(): Promise<unknown>;
      first<T>(): Promise<T | null>;
      all<T>(): Promise<{ results: T[] }>;
    };
  };
}

/** Validasi minimum sebelum menyentuh database. */
export function periksaKiriman(k: unknown): { ok: true; nilai: Kiriman } | { ok: false; pesan: string } {
  if (!k || typeof k !== "object") return { ok: false, pesan: "Kiriman bukan objek." };
  const o = k as Record<string, unknown>;
  const id = o.id;
  if (typeof id !== "string" || id.length < 8) return { ok: false, pesan: "id tidak valid." };
  const jenis = o.jenis;
  if (jenis !== "transaksi" && jenis !== "produk" && jenis !== "bazar" && jenis !== "biaya_bazar") {
    return { ok: false, pesan: "jenis tidak dikenal." };
  }

  if (jenis === "transaksi") {
    const t = o as unknown as KirimanTransaksi;
    if (typeof t.nomorResi !== "string" || !t.nomorResi) return { ok: false, pesan: "nomorResi kosong." };
    if (!Number.isInteger(t.total) || t.total < 0) return { ok: false, pesan: "total harus integer ≥ 0." };
    if (!Array.isArray(t.items)) return { ok: false, pesan: "items harus array." };
    for (const it of t.items) {
      if (!Number.isInteger(it.hargaSatuan) || !Number.isInteger(it.kuantitas)) {
        return { ok: false, pesan: "item memuat angka bukan integer." };
      }
    }
    if (!Array.isArray(t.pembayaran)) return { ok: false, pesan: "pembayaran harus array." };
  }

  if (jenis === "produk") {
    const p = o as unknown as KirimanProduk;
    if (typeof p.nama !== "string" || !p.nama.trim()) return { ok: false, pesan: "nama produk kosong." };
    if (!Number.isInteger(p.hargaJual) || p.hargaJual < 0) return { ok: false, pesan: "hargaJual harus integer." };
  }

  if (jenis === "bazar") {
    const b = o as unknown as KirimanBazar;
    if (typeof b.nama !== "string" || !b.nama.trim()) return { ok: false, pesan: "nama bazar kosong." };
  }

  if (jenis === "biaya_bazar") {
    const b = o as unknown as KirimanBiayaBazar;
    if (typeof b.diubahPada !== "string" || Number.isNaN(Date.parse(b.diubahPada))) {
      return { ok: false, pesan: "diubahPada biaya tidak valid." };
    }
    // Tombstone hanya butuh id + waktu hapus; isi lain boleh kosong.
    if (b.dihapus === true) return { ok: true, nilai: k as Kiriman };
    if (typeof b.bazarId !== "string" || !b.bazarId) return { ok: false, pesan: "bazarId biaya kosong." };
    if (typeof b.judul !== "string" || !b.judul.trim()) return { ok: false, pesan: "judul biaya kosong." };
    if (!Number.isInteger(b.nominal) || b.nominal < 0) return { ok: false, pesan: "nominal biaya harus integer ≥ 0." };
    if (!(KATEGORI_BIAYA as readonly string[]).includes(b.kategori)) {
      return { ok: false, pesan: "kategori biaya tidak dikenal." };
    }
    if (typeof b.tanggal !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(b.tanggal)) {
      return { ok: false, pesan: "tanggal biaya tidak valid." };
    }
  }

  return { ok: true, nilai: k as Kiriman };
}

/** Kunci jejak idempoten. Sama untuk kiriman yang sama, berbeda bila isi berubah. */
export function kunciSync(k: Kiriman): string {
  return `${k.jenis}:${k.id}:${k.diubahPada}`;
}

/**
 * Menyimpan satu kiriman secara idempoten.
 * Bila kunci sudah ada di `sync_log`, kiriman dianggap SUDAH diterima dan dilewati.
 */
async function simpanTransaksi(db: DBCloud, k: KirimanTransaksi, sekarang: string): Promise<void> {
  // Baris induk di-upsert: kiriman yang sama menimpa, tidak menggandakan.
  // Kolom tambahan Fase 2B (kontak, catatan, perkiraan, alamat, nomor urut,
  // jenis bayar, perangkat) membuat pesanan jahit utuh di perangkat lain.
  await db
    .prepare(
      `INSERT INTO transactions
        (id, nomor_resi, waktu, jenis_dokumen, arah_stok, pelanggan_id, status_pesanan, status_bayar, bazar_id, nama_pemesan,
         kontak, catatan_pesanan, perkiraan_siap, alamat, nomor_urut_bulan, jenis_bayar,
         ongkir_mode, ongkir_nominal, subtotal_awal, diskon_item, diskon_total, total,
         dibatalkan_pada, dibuat_pada, diubah_pada, perangkat)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET
         status_pesanan=excluded.status_pesanan, status_bayar=excluded.status_bayar,
         total=excluded.total, dibatalkan_pada=excluded.dibatalkan_pada,
         diubah_pada=excluded.diubah_pada, kontak=excluded.kontak,
         catatan_pesanan=excluded.catatan_pesanan, perkiraan_siap=excluded.perkiraan_siap,
         alamat=excluded.alamat, nomor_urut_bulan=excluded.nomor_urut_bulan,
         jenis_bayar=excluded.jenis_bayar, perangkat=excluded.perangkat`,
    )
    .bind(
      k.id,
      k.nomorResi,
      k.waktu,
      k.jenisDokumen,
      k.arahStok,
      k.pelangganId,
      k.statusPesanan,
      k.statusBayar,
      k.bazarId,
      k.namaPemesan,
      k.kontak ?? null,
      k.catatanPesanan ?? null,
      k.perkiraanSiap ?? null,
      k.alamat ?? null,
      k.nomorUrutBulan ?? null,
      k.jenisBayar ?? null,
      k.ongkirMode,
      k.ongkirNominal,
      k.subtotalAwal,
      k.diskonItem,
      k.diskonTotal,
      k.total,
      k.dibatalkanPada,
      k.dibuatPada,
      k.diubahPada,
      k.perangkat ?? null,
    )
    .run();

  for (const it of k.items) {
    await db
      .prepare(
        `INSERT INTO transaction_items
          (id, transaksi_id, produk_id, nama_snapshot, harga_satuan, kuantitas, diskon_per_unit, subtotal_bersih, ukuran, urutan)
         VALUES (?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET kuantitas=excluded.kuantitas,
           harga_satuan=excluded.harga_satuan, diskon_per_unit=excluded.diskon_per_unit,
           subtotal_bersih=excluded.subtotal_bersih, ukuran=excluded.ukuran, urutan=excluded.urutan`,
      )
      .bind(
        it.id,
        k.id,
        it.produkId,
        it.namaSnapshot,
        it.hargaSatuan,
        it.kuantitas,
        it.diskonPerUnit,
        it.subtotalBersih,
        it.ukuran ?? null,
        it.urutan ?? null,
      )
      .run();
  }

  for (const p of k.pembayaran) {
    await db
      .prepare(
        `INSERT INTO payments (id, transaksi_id, nominal, waktu, metode, catatan)
         VALUES (?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET nominal=excluded.nominal, metode=excluded.metode, catatan=excluded.catatan`,
      )
      .bind(p.id, k.id, p.nominal, p.waktu, p.metode, p.catatan ?? null)
      .run();
  }

  await db
    .prepare(`INSERT OR REPLACE INTO sync_log (kunci, jenis, id_record, diterima_pada) VALUES (?,?,?,?)`)
    .bind(kunciSync(k), "transaksi", k.id, sekarang)
    .run();
}

async function simpanProduk(db: DBCloud, k: KirimanProduk, sekarang: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO products (id, nama, kode, harga_jual, stok_gudang, catatan, arsip, diubah_pada)
       VALUES (?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET nama=excluded.nama, kode=excluded.kode,
         harga_jual=excluded.harga_jual, stok_gudang=excluded.stok_gudang,
         catatan=excluded.catatan, arsip=excluded.arsip, diubah_pada=excluded.diubah_pada`,
    )
    .bind(k.id, k.nama, k.kode, k.hargaJual, k.stokGudang, k.catatan ?? null, k.arsip ? 1 : 0, k.diubahPada)
    .run();

  await db
    .prepare(`INSERT OR REPLACE INTO sync_log (kunci, jenis, id_record, diterima_pada) VALUES (?,?,?,?)`)
    .bind(kunciSync(k), "produk", k.id, sekarang)
    .run();
}

async function simpanBazar(db: DBCloud, k: KirimanBazar, sekarang: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO bazars (id, nama, status, lokasi, mulai, selesai, catatan, pin_kasir_hash, diubah_pada)
       VALUES (?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET nama=excluded.nama, status=excluded.status,
         lokasi=excluded.lokasi, mulai=excluded.mulai, selesai=excluded.selesai,
         catatan=excluded.catatan, pin_kasir_hash=excluded.pin_kasir_hash,
         diubah_pada=excluded.diubah_pada`,
    )
    .bind(k.id, k.nama, k.status, k.lokasi, k.mulai, k.selesai, k.catatan ?? null, k.pinKasirHash ?? null, k.diubahPada)
    .run();

  await db
    .prepare(`INSERT OR REPLACE INTO sync_log (kunci, jenis, id_record, diterima_pada) VALUES (?,?,?,?)`)
    .bind(kunciSync(k), "bazar", k.id, sekarang)
    .run();
}

/**
 * Menyimpan satu biaya bazar (F1, BU-34). Biaya tidak pernah diubah, jadi
 * upsert cukup menimpa berdasarkan id. Tombstone (`dihapus`) hanya menandai
 * `dihapus_pada` — barisnya tetap ada supaya perangkat yang menarik belakangan
 * masih tahu baris itu sudah dihapus. Upsert yang datang SESUDAH tombstone
 * yang lebih baru tidak boleh menghidupkan lagi baris yang sudah dihapus.
 */
async function simpanBiayaBazar(db: DBCloud, k: KirimanBiayaBazar, sekarang: string): Promise<void> {
  if (k.dihapus === true) {
    await db
      .prepare(
        `INSERT INTO bazar_biaya (id, bazar_id, kategori, judul, nominal, tanggal, catatan, dibuat_pada, diubah_pada, perangkat, dihapus_pada)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET dihapus_pada=excluded.dihapus_pada, diubah_pada=excluded.diubah_pada`,
      )
      .bind(
        k.id,
        k.bazarId,
        "",
        "",
        0,
        "",
        null,
        k.dibuatPada,
        k.diubahPada,
        k.perangkat ?? null,
        k.diubahPada,
      )
      .run();
  } else {
    const ada = await db
      .prepare(`SELECT dihapus_pada, diubah_pada FROM bazar_biaya WHERE id = ?`)
      .bind(k.id)
      .first<{ dihapus_pada: string | null; diubah_pada: string }>();
    const sudahDihapusLebihBaru =
      ada && ada.dihapus_pada !== null && k.diubahPada <= String(ada.diubah_pada ?? "");
    if (!sudahDihapusLebihBaru) {
      await db
        .prepare(
          `INSERT INTO bazar_biaya (id, bazar_id, kategori, judul, nominal, tanggal, catatan, dibuat_pada, diubah_pada, perangkat, dihapus_pada)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)
           ON CONFLICT(id) DO UPDATE SET bazar_id=excluded.bazar_id, kategori=excluded.kategori,
             judul=excluded.judul, nominal=excluded.nominal, tanggal=excluded.tanggal,
             catatan=excluded.catatan, diubah_pada=excluded.diubah_pada, perangkat=excluded.perangkat,
             dihapus_pada=NULL`,
        )
        .bind(
          k.id,
          k.bazarId,
          k.kategori,
          k.judul,
          k.nominal,
          k.tanggal,
          k.catatan ?? null,
          k.dibuatPada,
          k.diubahPada,
          k.perangkat ?? null,
          null,
        )
        .run();
    }
  }

  await db
    .prepare(`INSERT OR REPLACE INTO sync_log (kunci, jenis, id_record, diterima_pada) VALUES (?,?,?,?)`)
    .bind(kunciSync(k), "biaya_bazar", k.id, sekarang)
    .run();
}

/**
 * Memproses satu batch kiriman.
 * Tiap kiriman ditangani sendiri-sendiri: satu rusak tidak membatalkan yang lain.
 */
export async function prosesBatch(
  db: DBCloud,
  kiriman: readonly unknown[],
  sekarang: string = new Date().toISOString(),
): Promise<HasilKirim> {
  const diterima: string[] = [];
  const ditolak: Array<{ id: string; pesan: string }> = [];

  for (const mentah of kiriman) {
    const cek = periksaKiriman(mentah);
    if (!cek.ok) {
      const id = mentah && typeof mentah === "object" ? String((mentah as { id?: unknown }).id ?? "?") : "?";
      ditolak.push({ id, pesan: cek.pesan });
      continue;
    }

    const k = cek.nilai;
    try {
      // Sudah pernah diterima? Lewati tanpa menulis ulang.
      const ada = await db
        .prepare(`SELECT kunci FROM sync_log WHERE kunci = ?`)
        .bind(kunciSync(k))
        .first<{ kunci: string }>();
      if (ada) {
        diterima.push(k.id);
        continue;
      }

      if (k.jenis === "transaksi") await simpanTransaksi(db, k, sekarang);
      else if (k.jenis === "produk") await simpanProduk(db, k, sekarang);
      else if (k.jenis === "bazar") await simpanBazar(db, k, sekarang);
      else await simpanBiayaBazar(db, k, sekarang);

      diterima.push(k.id);
    } catch (e) {
      ditolak.push({ id: k.id, pesan: e instanceof Error ? e.message : "gagal disimpan." });
    }
  }

  return { diterima, ditolak };
}

/** Satu paket perubahan dari hub untuk satu perangkat (Fase 2B, BU-33). */
export interface Perubahan {
  sekarang: string;
  transaksi: KirimanTransaksi[];
  produk: KirimanProduk[];
  bazar: KirimanBazar[];
  /** Biaya bazar, termasuk tombstone (F1): baris yang sudah dihapus di
   *  perangkat lain ikut dikembalikan dengan `dihapus: true`. */
  biayaBazar: KirimanBiayaBazar[];
}

export interface OpsiTarik {
  /** Ambil baris yang diubah sesudah waktu ini (ISO). Kosong = dari awal. */
  sejak?: string;
  /** Id perangkat peminta: baris yang dikirim perangkat ini sendiri dilewati. */
  perangkat?: string;
  /** Batas per jenis (bawaan 50, maks 100). */
  batas?: number;
}

/** Baris D1 (snake_case) untuk satu transaksi. */
type BarisTransaksi = Record<string, unknown>;

/** Mengambil perubahan dari hub sesudah `sejak`, untuk ditarik perangkat lain.
 *  Baris yang berasal dari perangkat peminta sendiri dilewati (bila
 *  `perangkat` terisi — baris lama tanpa perangkat tetap dikembalikan dan
 *  perangkat penerima yang menyaringnya lewat bayangan/lokal). */
export async function ambilPerubahan(db: DBCloud, opsi: OpsiTarik = {}): Promise<Perubahan> {
  const sejak = opsi.sejak && !Number.isNaN(Date.parse(opsi.sejak)) ? opsi.sejak : "1970-01-01T00:00:00.000Z";
  const batas = Math.min(Math.max(opsi.batas ?? 50, 1), 100);
  const perangkat = opsi.perangkat ?? "";
  const sekarang = new Date().toISOString();

  const barisTrx = (
    await db
      .prepare(
        `SELECT * FROM transactions
         WHERE diubah_pada > ? AND (perangkat IS NULL OR perangkat != ?)
         ORDER BY diubah_pada ASC LIMIT ?`,
      )
      .bind(sejak, perangkat, batas)
      .all<BarisTransaksi>()
  ).results;

  const transaksi: KirimanTransaksi[] = [];
  if (barisTrx.length > 0) {
    const tempat = barisTrx.map(() => "?").join(",");
    const ids = barisTrx.map((b) => String(b.id));
    const items = (
      await db
        .prepare(`SELECT * FROM transaction_items WHERE transaksi_id IN (${tempat})`)
        .bind(...ids)
        .all<Record<string, unknown>>()
    ).results;
    const bayar = (
      await db
        .prepare(`SELECT * FROM payments WHERE transaksi_id IN (${tempat})`)
        .bind(...ids)
        .all<Record<string, unknown>>()
    ).results;

    for (const b of barisTrx) {
      const id = String(b.id);
      transaksi.push({
        jenis: "transaksi",
        id,
        nomorResi: String(b.nomor_resi ?? ""),
        waktu: String(b.waktu ?? ""),
        jenisDokumen: (b.jenis_dokumen as KirimanTransaksi["jenisDokumen"]) ?? "penjualan",
        arahStok: (b.arah_stok as KirimanTransaksi["arahStok"]) ?? "tidak_ada",
        pelangganId: (b.pelanggan_id as string | null) ?? null,
        statusPesanan: String(b.status_pesanan ?? ""),
        statusBayar: String(b.status_bayar ?? ""),
        bazarId: (b.bazar_id as string | null) ?? null,
        namaPemesan: (b.nama_pemesan as string | null) ?? null,
        kontak: (b.kontak as string | null) ?? null,
        catatanPesanan: (b.catatan_pesanan as string | null) ?? null,
        perkiraanSiap: (b.perkiraan_siap as string | null) ?? null,
        alamat: (b.alamat as string | null) ?? null,
        ...(typeof b.nomor_urut_bulan === "number" ? { nomorUrutBulan: b.nomor_urut_bulan } : {}),
        jenisBayar: (b.jenis_bayar as string | null) ?? null,
        ongkirMode: String(b.ongkir_mode ?? "ambil_sendiri"),
        ongkirNominal: (b.ongkir_nominal as number | null) ?? null,
        subtotalAwal: Number(b.subtotal_awal ?? 0),
        diskonItem: Number(b.diskon_item ?? 0),
        diskonTotal: Number(b.diskon_total ?? 0),
        total: Number(b.total ?? 0),
        dibatalkanPada: (b.dibatalkan_pada as string | null) ?? null,
        dibuatPada: String(b.dibuat_pada ?? ""),
        diubahPada: String(b.diubah_pada ?? ""),
        ...(typeof b.perangkat === "string" && b.perangkat ? { perangkat: b.perangkat } : {}),
        items: items
          .filter((i) => String(i.transaksi_id) === id)
          .map((i) => ({
            id: String(i.id),
            produkId: (i.produk_id as string | null) ?? null,
            namaSnapshot: String(i.nama_snapshot ?? ""),
            hargaSatuan: Number(i.harga_satuan ?? 0),
            kuantitas: Number(i.kuantitas ?? 0),
            diskonPerUnit: Number(i.diskon_per_unit ?? 0),
            subtotalBersih: Number(i.subtotal_bersih ?? 0),
            ukuran: (i.ukuran as string | null) ?? null,
            ...(typeof i.urutan === "number" ? { urutan: i.urutan } : {}),
          })),
        pembayaran: bayar
          .filter((p) => String(p.transaksi_id) === id)
          .map((p) => ({
            id: String(p.id),
            nominal: Number(p.nominal ?? 0),
            waktu: String(p.waktu ?? ""),
            metode: (p.metode as string | null) ?? null,
            catatan: (p.catatan as string | null) ?? null,
          })),
      });
    }
  }

  const produk = (
    await db
      .prepare(`SELECT * FROM products WHERE diubah_pada > ? ORDER BY diubah_pada ASC LIMIT ?`)
      .bind(sejak, batas)
      .all<Record<string, unknown>>()
  ).results.map((p) => ({
    jenis: "produk" as const,
    id: String(p.id),
    nama: String(p.nama ?? ""),
    kode: (p.kode as string | null) ?? null,
    hargaJual: Number(p.harga_jual ?? 0),
    stokGudang: Number(p.stok_gudang ?? 0),
    catatan: (p.catatan as string | null) ?? null,
    arsip: Number(p.arsip ?? 0) === 1,
    diubahPada: String(p.diubah_pada ?? ""),
  }));

  const bazar = (
    await db
      .prepare(`SELECT * FROM bazars WHERE diubah_pada > ? ORDER BY diubah_pada ASC LIMIT ?`)
      .bind(sejak, batas)
      .all<Record<string, unknown>>()
  ).results.map((b) => ({
    jenis: "bazar" as const,
    id: String(b.id),
    nama: String(b.nama ?? ""),
    status: String(b.status ?? ""),
    lokasi: (b.lokasi as string | null) ?? null,
    mulai: (b.mulai as string | null) ?? null,
    selesai: (b.selesai as string | null) ?? null,
    catatan: (b.catatan as string | null) ?? null,
    pinKasirHash: (b.pin_kasir_hash as string | null) ?? null,
    diubahPada: String(b.diubah_pada ?? ""),
  }));

  const biayaBazar: KirimanBiayaBazar[] = (
    await db
      .prepare(`SELECT * FROM bazar_biaya WHERE diubah_pada > ? ORDER BY diubah_pada ASC LIMIT ?`)
      .bind(sejak, batas)
      .all<Record<string, unknown>>()
  ).results.map((b) => ({
    jenis: "biaya_bazar" as const,
    id: String(b.id),
    bazarId: (b.bazar_id as string | null) ?? null,
    kategori: (b.kategori as KirimanBiayaBazar["kategori"]) ?? "lainnya",
    judul: String(b.judul ?? ""),
    nominal: Number(b.nominal ?? 0),
    tanggal: String(b.tanggal ?? ""),
    catatan: (b.catatan as string | null) ?? null,
    dibuatPada: String(b.dibuat_pada ?? ""),
    diubahPada: String(b.diubah_pada ?? ""),
    ...(typeof b.perangkat === "string" && b.perangkat ? { perangkat: b.perangkat } : {}),
    ...(b.dihapus_pada != null ? { dihapus: true as const } : {}),
  }));

  return { sekarang, transaksi, produk, bazar, biayaBazar };
}
