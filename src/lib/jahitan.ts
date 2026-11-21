/**
 * Pesanan jahit (BU-12, BU-13, BU-14, BU-15, BU-22, BU-28, BU-56) — fungsi murni + persistensi.
 *
 * Satu pesanan jahit = SATU dokumen `jenisDokumen:"jasa"` + `arahStok:"tidak_ada"`.
 * Tidak mengurangi stok. Pembayaran bertahap (DP/pelunasan) adalah baris `payments`
 * di bawah dokumen; jurnal hanyalah TURUNAN (recompute) dan hanya mencatat uang yang
 * benar-benar diterima (BU-08, BU-02).
 *
 * Saat pesanan dibuat, entitas `pelanggan` ikut dibentuk otomatis (BU-28) — tanpa
 * beban input Tante, dan `TransaksiRecord.pelangganId` menunjuk entitas itu untuk
 * CRM di tahap lanjut.
 *
 * Ukuran/catatan khusus (BU-56, 19 Nov 2026): SATU per baris item, bukan satu per
 * pesanan — ukuran asli dicatat manual Tante di buku khusus, kolom ini hanya
 * catatan bebas per item. Pesanan bisa diubah lewat `ubahPesananJahit`.
 *
 * Bagian murni (tanpa IndexedDB) bisa diuji lepas; hanya `simpanPesananJahit` dan
 * `ubahPesananJahit` yang menyentuh database. Skema TIDAK diubah di sini — dipakai
 * apa adanya dari schema.ts.
 */
import { getDB, type JournalRecord, type PelangganRecord, type Rekening, type TransaksiRecord, type UUID } from "../db/schema.ts";
import { buatId, daftarTransaksi } from "../db/repositori.ts";
import { nomorPlaceholder } from "./dokumen.ts";
import { mintaNomorUrutBulan } from "../sync/penomoran.ts";
import type { Rupiah } from "./money.ts";
import { sapaanDariWaktu } from "./sapaan.ts";
import { recomputeJurnalDariDokumen, hitungSisa } from "./jurnal.ts";

/** Satu baris "biaya lain" (BU-15): nama + nominal. Nominal boleh 0 (tidak dicetak). */
export interface BiayaLainInput {
  nama: string;
  nominal: Rupiah;
}

/** Satu baris item pesanan jahit (BU-55, BU-56): nama + harga satuan + jumlah + ukuran/catatan khusus. */
export interface ItemJahitanInput {
  nama: string;
  harga: Rupiah;
  kuantitas: number;
  /** Ukuran/catatan khusus per item (BU-56) — bebas, opsional; ukuran asli ada di buku khusus Tante. */
  ukuran: string | null;
}

/** Masukan wizard pesanan jahit (BU-22.A: langkah pemesan → jahitan → biaya → simpan). */
export interface RencanaJahitan {
  namaPemesan: string;
  kontak: string | null;
  /** Daftar item (BU-55); minimal 1 item. */
  items: readonly ItemJahitanInput[];
  perkiraanSelesai: string | null;
  catatan: string | null;
  biayaLain: readonly BiayaLainInput[];
}

export type HasilRencanaJahitan =
  | { ok: true; total: Rupiah; itemsTotal: Rupiah; biayaLainTotal: Rupiah }
  | { ok: false; pesan: string };

/**
 * Validasi rencana pesanan jahit (BU-14, BU-55): wajib `namaPemesan` dan
 * minimal 1 item (nama + harga > 0 + jumlah >= 1). Biaya lain opsional,
 * nominal integer >= 0.
 */
export function periksaRencanaJahitan(rencana: RencanaJahitan): HasilRencanaJahitan {
  if (rencana.namaPemesan.trim().length < 2) {
    return { ok: false, pesan: "Isi nama pemesan." };
  }
  const itemsBersih = rencana.items.filter(
    (i) => i.nama.trim().length >= 2 && Number.isInteger(i.harga) && i.harga > 0,
  );
  if (itemsBersih.length < 1) {
    return { ok: false, pesan: "Isi minimal satu item jahitan (nama + harga)." };
  }
  for (const i of itemsBersih) {
    if (!Number.isInteger(i.kuantitas) || i.kuantitas < 1) {
      return { ok: false, pesan: `Jumlah "${i.nama.trim()}" tidak valid.` };
    }
  }
  const itemsTotal = itemsBersih.reduce((n, i) => n + i.harga * i.kuantitas, 0);

  let biayaLainTotal = 0;
  for (const b of rencana.biayaLain) {
    if (!Number.isInteger(b.nominal) || b.nominal < 0) {
      return { ok: false, pesan: `Nominal "${b.nama || "biaya lain"}" tidak valid.` };
    }
    biayaLainTotal += b.nominal;
  }

  const total = itemsTotal + biayaLainTotal;
  if (!Number.isSafeInteger(total) || total <= 0) {
    return { ok: false, pesan: "Total tidak valid." };
  }

  return { ok: true, total, itemsTotal, biayaLainTotal };
}

export interface PesananJahitTersimpan {
  id: UUID;
  nomor: string;
  namaPemesan: string;
  total: Rupiah;
  items: readonly ItemJahitanInput[];
  biayaLain: readonly BiayaLainInput[];
  /** Null bila pesanan lama tidak punya pelanggan tercatat. */
  pelangganId: UUID | null;
}

export type HasilSimpanJahitan =
  | { ok: true; pesanan: PesananJahitTersimpan }
  | { ok: false; pesan: string };

/** Ringkasan status bayar pesanan jahit untuk kartu daftar & detail. */
export interface RingkasanJahitan {
  id: UUID;
  nomor: string;
  namaPemesan: string;
  kontak: string | null;
  model: string;
  ukuran: string | null;
  perkiraanSelesai: string | null;
  createdPada: string;
  total: Rupiah;
  terbayar: Rupiah;
  sisa: Rupiah;
  status: "terbuka" | "lunas" | "batal";
  sudahDikirim: boolean;
}

/** Bentuk penuh satu pesanan jahit untuk layar detail. */
export interface PesananJahitLengkap {
  transaksi: TransaksiRecord;
  /** Item dari transaction_items (BU-55); pesanan lama selalu 1 baris. */
  items: readonly ItemJahitanInput[];
  biayaLain: readonly BiayaLainInput[];
  /** Catatan bebas pesanan (BU-56, untuk isi ulang form saat ubah). */
  catatan: string | null;
  pelanggan: PelangganRecord | null;
  terbayar: Rupiah;
  sisa: Rupiah;
  status: "terbuka" | "lunas" | "batal";
  sudahDikirim: boolean;
}

const KUNCI_BIAYA_LAIN = "jahitanBiayaLain";

/**
 * Daftar "biaya lain" tersimpan untuk dipakai kembali (BU-15). Disimpan di
 * localStorage — bukan data transaksi, hanya preferensi isian Tante.
 */
export function bacaBiayaLainTersimpan(): Array<{ nama: string; terakhir: Rupiah }> {
  try {
    const mentah = localStorage.getItem(KUNCI_BIAYA_LAIN);
    if (!mentah) return [];
    const daftar = JSON.parse(mentah) as unknown;
    if (!Array.isArray(daftar)) return [];
    return daftar
      .filter((x): x is { nama: string; terakhir: Rupiah } => {
        const o = x as { nama?: unknown; terakhir?: unknown };
        return typeof o?.nama === "string" && typeof o?.terakhir === "number";
      })
      .map((x) => ({ nama: x.nama, terakhir: Number.isFinite(x.terakhir) ? x.terakhir : 0 }));
  } catch {
    return [];
  }
}

/** Menyimpan nama biaya lain yang pernah dipakai (unik, terbaru dulu). */
export function simpanBiayaLainTersimpan(nama: string, terakhir: Rupiah): void {
  try {
    const n = nama.trim().slice(0, 40);
    if (!n) return;
    const lama = bacaBiayaLainTersimpan().filter((x) => x.nama !== n);
    const daftar = [{ nama: n, terakhir }, ...lama].slice(0, 12);
    localStorage.setItem(KUNCI_BIAYA_LAIN, JSON.stringify(daftar));
  } catch {
    // Preferensi tidak tersimpan — bukan kesalahan fatal.
  }
}

/**
 * Menyimpan pesanan jahit: satu dokumen `jasa`, satu entitas `pelanggan` (BU-28),
 * dan jurnal turunan (BU-02, recompute). Pembayaran masuk lewat alur kasir.
 */
export async function simpanPesananJahit(
  rencana: RencanaJahitan,
  konteks: { rekening: readonly Rekening[]; waktu?: Date; urlSync?: string; fetchImpl?: typeof fetch },
): Promise<HasilSimpanJahitan> {
  const cek = periksaRencanaJahitan(rencana);
  if (!cek.ok) return { ok: false, pesan: cek.pesan };

  const waktu = konteks.waktu ?? new Date();
  const iso = waktu.toISOString();
  const hari = iso.slice(0, 10);
  const bulan = iso.slice(0, 7);
  // Nomor urut pesanan jahit (BU-19/21, diputuskan Tante 19 Nov 2026):
  // 5 digit, dihitung dalam BULAN yang sama (hanya jenisDokumen "jasa").
  // Saat online, nomor diminta ke hub (F4) supaya dua perangkat tidak
  // mendapat nomor yang sama. Saat offline / hub tidak bisa dihubungi,
  // dipakai hitungan lokal + ditandai sementara — sync akan meminta nomor
  // resmi dari hub dan menulis ulang nomor ini begitu online lagi.
  // Penjualan TIDAK PERNAH menunggu hub: gagal = nomor lokal.
  const urlSync = konteks.urlSync ?? import.meta.env.VITE_SYNC_URL ?? "";
  const nomorHub = await mintaNomorUrutBulan({ urlSync, bulan, fetchImpl: konteks.fetchImpl });
  const semua = await daftarTransaksi();
  const nomorSementara = nomorHub === null;
  const urutBulanIni = nomorHub ?? semua.filter((t) => t.waktu.slice(0, 7) === bulan && t.jenisDokumen === "jasa").length + 1;
  const urutHariIni = semua.filter((t) => t.waktu.slice(0, 10) === hari && t.jenisDokumen === "jasa").length + 1;
  const id = buatId();
  const pelangganId = buatId();

  const pelanggan: PelangganRecord = {
    id: pelangganId,
    nama: rencana.namaPemesan.trim(),
    kontak: rencana.kontak?.trim() || null,
  };

  const itemsBersih: ItemJahitanInput[] = rencana.items
    .filter((i) => i.nama.trim().length >= 2 && Number.isInteger(i.harga) && i.harga > 0)
    .map((i) => ({
      nama: i.nama.trim().slice(0, 60),
      harga: i.harga,
      kuantitas: Number.isInteger(i.kuantitas) && i.kuantitas >= 1 ? i.kuantitas : 1,
      ukuran: i.ukuran?.trim().slice(0, 40) || null,
    }));

  const biayaLainBersih: BiayaLainInput[] = rencana.biayaLain
    .filter((b) => b.nama.trim().length > 0 && b.nominal > 0)
    .map((b) => ({ nama: b.nama.trim().slice(0, 40), nominal: b.nominal }));

  const trx: TransaksiRecord = {
    id,
    nomorResi: nomorPlaceholder(waktu, urutBulanIni),
    nomorUrutHari: urutHariIni,
    nomorUrutBulan: urutBulanIni,
    ...(nomorSementara ? { nomorUrutSementara: true as const } : {}),
    waktu: iso,
    jenis: "po",
    jenisDokumen: "jasa",
    arahStok: "tidak_ada",
    pelangganId,
    statusPesanan: "diproses",
    bazarId: null,
    namaPemesan: rencana.namaPemesan.trim(),
    kontak: rencana.kontak?.trim() || null,
    perkiraanSiap: rencana.perkiraanSelesai || null,
    alamat: null,
    catatanPesanan: susunCatatanJahitan(rencana, itemsBersih, biayaLainBersih),
    riwayatTotal: [],
    ongkirMode: "ambil_sendiri",
    ongkirNominal: 0,
    subtotalAwal: cek.total,
    diskonItem: 0,
    diskonTotal: 0,
    total: cek.total,
    sapaan: sapaanDariWaktu(waktu),
    rekeningSnapshot: [...konteks.rekening],
    jenisBayar: null,
    statusBayar: "belum_dibayar",
    dibatalkanPada: null,
    createdAt: iso,
    updatedAt: iso,
  };

  const db = await getDB();

  // Semua tulisan dalam satu transaksi (BU-56, sama seperti ubahPesananJahit):
  // simpan baru kembali sesudah data benar-benar tertulis — layar berikut
  // tidak bisa membaca daftar sebelum pesanan tersimpan, dan pesanan tidak
  // bisa hilang kalau tab ditutup tepat sesudah tombol ditekan.
  const tx = db.transaction(["pelanggan", "transactions", "transaction_items", "journal"], "readwrite");
  await tx.objectStore("pelanggan").put(pelanggan);
  await tx.objectStore("transactions").put(trx);
  // Satu baris transaction_items per item (BU-55); pesanan 1 item = 1 baris.
  // Ukuran/catatan khusus ikut di baris item (BU-56); urutan dicatat supaya
  // urutan item tidak berubah-ubah saat dibaca (id baris acak).
  for (const [idx, item] of itemsBersih.entries()) {
    await tx.objectStore("transaction_items").put({
      id: buatId(),
      transaksiId: id,
      produkId: null,
      namaSnapshot: item.nama,
      hargaSatuan: item.harga,
      kuantitas: item.kuantitas,
      diskonPerUnit: 0,
      subtotalBersih: item.harga * item.kuantitas,
      ukuran: item.ukuran,
      urutan: idx,
    });
  }

  for (const b of recomputeJurnalDariDokumen({ id, total: cek.total }, [])) {
    const baris: JournalRecord = { ...b, id: buatId() };
    await tx.objectStore("journal").put(baris);
  }
  await tx.done;

  // Antrean sinkronisasi (Fase 2B): pesanan yang diubah harus sampai ke
  // perangkat lain.
  try {
    const { tandaiUntukSync } = await import("../sync/mesin.ts");
    await tandaiUntukSync("transaksi", id);
  } catch {
    // Sengaja diam: perubahan lokal sudah sah.
  }

  for (const b of biayaLainBersih) simpanBiayaLainTersimpan(b.nama, b.nominal);

  return {
    ok: true,
    pesanan: {
      id,
      nomor: trx.nomorResi,
      namaPemesan: trx.namaPemesan ?? "",
      total: cek.total,
      items: itemsBersih,
      biayaLain: biayaLainBersih,
      pelangganId,
    },
  };
}

function susunCatatanJahitan(
  rencana: RencanaJahitan,
  itemsBersih: readonly ItemJahitanInput[],
  biayaLainBersih: readonly BiayaLainInput[],
): string | null {
  const bagian: string[] = [];
  // Segmen pertama = nama item pertama (dipakai daftar sebagai "model").
  // Ukuran TIDAK lagi di sini (BU-56): ukuran/catatan khusus ada di baris item.
  if (itemsBersih.length > 0) bagian.push(itemsBersih[0]!.nama);
  if (biayaLainBersih.length > 0) bagian.push(biayaLainBersih.map((b) => `${b.nama}:${b.nominal}`).join("|"));
  if (rencana.catatan?.trim()) bagian.push(rencana.catatan.trim());
  return bagian.length > 0 ? bagian.join(" · ") : null;
}

/**
 * Mengubah pesanan jahit yang sudah tersimpan (BU-56).
 *
 * Yang berubah: nama pemesan, kontak, item (nama/harga/jumlah/ukuran), biaya
 * lain, perkiraan selesai, catatan, dan total. Yang TIDAK berubah: nomor KC,
 * tanggal pesanan, pembayaran yang sudah masuk, dan jurnal (jurnal hanya
 * mencatat uang yang benar-benar diterima, jadi tidak ikut berubah).
 *
 * Penjaga: total baru tidak boleh kurang dari yang sudah terbayar — kalau
 * kurang, ubah ditolak supaya sisa tidak jadi negatif. Semua tulisan dalam
 * satu transaksi IndexedDB: berhasil bersama atau tidak sama sekali.
 */
export async function ubahPesananJahit(id: UUID, rencana: RencanaJahitan): Promise<HasilSimpanJahitan> {
  const cek = periksaRencanaJahitan(rencana);
  if (!cek.ok) return { ok: false, pesan: cek.pesan };

  const db = await getDB();
  const lama = await db.get("transactions", id);
  if (!lama || lama.jenisDokumen !== "jasa") {
    return { ok: false, pesan: "Pesanan tidak ditemukan." };
  }
  const pembayaran = await db.getAllFromIndex("payments", "by-transaksi", id);
  const terbayar = pembayaran.reduce((n, p) => n + p.nominal, 0);
  if (cek.total < terbayar) {
    return {
      ok: false,
      pesan: `Total baru (${formatRupiahSingkat(cek.total)}) kurang dari yang sudah dibayar (${formatRupiahSingkat(terbayar)}).`,
    };
  }

  const itemsBersih: ItemJahitanInput[] = rencana.items
    .filter((i) => i.nama.trim().length >= 2 && Number.isInteger(i.harga) && i.harga > 0)
    .map((i) => ({
      nama: i.nama.trim().slice(0, 60),
      harga: i.harga,
      kuantitas: Number.isInteger(i.kuantitas) && i.kuantitas >= 1 ? i.kuantitas : 1,
      ukuran: i.ukuran?.trim().slice(0, 40) || null,
    }));

  const biayaLainBersih: BiayaLainInput[] = rencana.biayaLain
    .filter((b) => b.nama.trim().length > 0 && b.nominal > 0)
    .map((b) => ({ nama: b.nama.trim().slice(0, 40), nominal: b.nominal }));

  const sekarang = new Date().toISOString();
  // SATU transaksi tulis (BU-56): semua perubahan berhasil bersama atau tidak
  // sama sekali — pesanan tidak bisa tinggal setengah diubah kalau HP mati di
  // tengah simpan. Yang ditulis hanya pesanan ini; pesanan lain, pembayaran,
  // dan jurnal tidak disentuh.
  const tx = db.transaction(["transactions", "pelanggan", "transaction_items"], "readwrite");
  await tx.objectStore("transactions").put({
    ...lama,
    namaPemesan: rencana.namaPemesan.trim(),
    kontak: rencana.kontak?.trim() || null,
    perkiraanSiap: rencana.perkiraanSelesai || null,
    catatanPesanan: susunCatatanJahitan(rencana, itemsBersih, biayaLainBersih),
    subtotalAwal: cek.total,
    total: cek.total,
    updatedAt: sekarang,
  });

  if (lama.pelangganId) {
    const pelanggan = await tx.objectStore("pelanggan").get(lama.pelangganId);
    if (pelanggan) {
      await tx.objectStore("pelanggan").put({
        ...pelanggan,
        nama: rencana.namaPemesan.trim(),
        kontak: rencana.kontak?.trim() || null,
      });
    }
  }

  // Ganti baris item lama dengan yang baru (nomor + pembayaran tidak tersentuh).
  const barisLama = await tx.objectStore("transaction_items").index("by-transaksi").getAll(id);
  for (const baris of barisLama) await tx.objectStore("transaction_items").delete(baris.id);
  for (const [idx, item] of itemsBersih.entries()) {
    await tx.objectStore("transaction_items").put({
      id: buatId(),
      transaksiId: id,
      produkId: null,
      namaSnapshot: item.nama,
      hargaSatuan: item.harga,
      kuantitas: item.kuantitas,
      diskonPerUnit: 0,
      subtotalBersih: item.harga * item.kuantitas,
      ukuran: item.ukuran,
      urutan: idx,
    });
  }
  await tx.done;

  // Antrean sinkronisasi (Fase 2B): pesanan yang diubah harus sampai ke
  // perangkat lain.
  try {
    const { tandaiUntukSync } = await import("../sync/mesin.ts");
    await tandaiUntukSync("transaksi", id);
  } catch {
    // Sengaja diam: perubahan lokal sudah sah.
  }

  for (const b of biayaLainBersih) simpanBiayaLainTersimpan(b.nama, b.nominal);

  return {
    ok: true,
    pesanan: {
      id,
      nomor: lama.nomorResi,
      namaPemesan: rencana.namaPemesan.trim(),
      total: cek.total,
      items: itemsBersih,
      biayaLain: biayaLainBersih,
      pelangganId: lama.pelangganId,
    },
  };
}

function formatRupiahSingkat(v: Rupiah): string {
  return `Rp${v.toLocaleString("id-ID")}`;
}

/**
 * Urai catatan pesanan format LAMA (BU-56): "model · ukuran · biayaLain · catatan".
 *
 * Pesanan baru tidak lagi menyimpan ukuran di catatan (ukuran ada di baris item),
 * tapi pesanan yang disimpan sebelum BU-56 masih punya segmen ukuran di [1].
 * `ukuranDiCatatan` benar hanya bila tidak ada baris item yang membawa ukuran
 * (pesanan lama); untuk pesanan baru segmen [1] tanpa ":" adalah catatan bebas.
 *
 * Batas yang diketahui: pesanan lama TANPA ukuran tapi DENGAN catatan bebas
 * ("Gaun · tolong cepat") tidak bisa dibedakan dari pesanan lama dengan ukuran —
 * segmen [1]-nya terbaca sebagai ukuran (cacat yang sama seperti
 * ukuranDariCatatan lama). Teksnya tidak hilang, hanya pindah ke kolom ukuran
 * item pertama, dan Tante bisa memperbaikinya saat ubah.
 */
export function uraiCatatanLama(
  catatan: string | null,
  opsi: { ukuranDiCatatan: boolean },
): { ukuranLama: string | null; catatanBebas: string | null } {
  const bagian = (catatan ?? "")
    .split(" · ")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (bagian.length === 0) return { ukuranLama: null, catatanBebas: null };
  let ukuranLama: string | null = null;
  const bebas: string[] = [];
  // [0] selalu nama item pertama.
  for (let i = 1; i < bagian.length; i++) {
    const seg = bagian[i]!;
    if (opsi.ukuranDiCatatan && i === 1 && !seg.includes(":")) {
      ukuranLama = seg;
      continue;
    }
    if (adalahSegmenBiayaLain(seg)) continue;
    bebas.push(seg);
  }
  return { ukuranLama, catatanBebas: bebas.length > 0 ? bebas.join(" · ") : null };
}

/** Satu segmen biaya lain: "nama:nominal", atau beberapa dipisah "|". */
function adalahSegmenBiayaLain(seg: string): boolean {
  return seg.split("|").every((piece) => {
    const idx = piece.indexOf(":");
    if (idx <= 0) return false;
    const nominal = Number(piece.slice(idx + 1));
    return Number.isInteger(nominal) && nominal > 0;
  });
}

export async function daftarPesananJahit(): Promise<RingkasanJahitan[]> {
  const db = await getDB();
  const semua = await db.getAll("transactions");
  const jasa = semua.filter((t) => t.jenisDokumen === "jasa");

  const hasil: RingkasanJahitan[] = [];
  for (const t of jasa) {
    const pembayaran = await db.getAllFromIndex("payments", "by-transaksi", t.id);
    const terbayar = pembayaran.reduce((n, p) => n + p.nominal, 0);
    const kiriman = await db.getAllFromIndex("pengiriman", "by-dokumen", t.id);
    hasil.push({
      id: t.id,
      nomor: t.nomorResi,
      namaPemesan: t.namaPemesan ?? "(tanpa nama)",
      kontak: t.kontak,
      model: modelDariTransaksi(t),
      ukuran: null,
      perkiraanSelesai: t.perkiraanSiap,
      createdPada: t.waktu,
      total: t.total,
      terbayar,
      sisa: hitungSisa(t.total, terbayar),
      status: statusJahitan(t),
      sudahDikirim: kiriman.length > 0,
    });
  }

  return hasil.sort((a, b) => b.createdPada.localeCompare(a.createdPada));
}

export async function ambilPesananJahit(id: UUID): Promise<PesananJahitLengkap | undefined> {
  const db = await getDB();
  const t = await db.get("transactions", id);
  if (!t || t.jenisDokumen !== "jasa") return undefined;

  const [pembayaran, kiriman, pelanggan, itemRows] = await Promise.all([
    db.getAllFromIndex("payments", "by-transaksi", id),
    db.getAllFromIndex("pengiriman", "by-dokumen", id),
    t.pelangganId ? db.get("pelanggan", t.pelangganId) : Promise.resolve(undefined),
    db.getAllFromIndex("transaction_items", "by-transaksi", id),
  ]);
  const terbayar = pembayaran.reduce((n, p) => n + p.nominal, 0);

  // Ukuran/catatan khusus dari baris item (BU-56). Pesanan lama (sebelum BU-56)
  // tidak punya ukuran di baris — pakai segmen ukuran lama dari catatan untuk
  // item pertama, supaya tampilannya tidak hilang.
  const adaUkuranBaris = itemRows.some((r) => (r.ukuran ?? null) !== null);
  const uraian = uraiCatatanLama(t.catatanPesanan, { ukuranDiCatatan: !adaUkuranBaris });
  // Urutkan baris sesuai urutan input (BU-56); baris lama tanpa urutan tetap
  // di belakang dengan urutan baca apa adanya.
  const itemTerurut = [...itemRows].sort(
    (a, b) => (a.urutan ?? Number.MAX_SAFE_INTEGER) - (b.urutan ?? Number.MAX_SAFE_INTEGER),
  );
  const items: ItemJahitanInput[] = itemTerurut.map((r, i) => ({
    nama: r.namaSnapshot,
    harga: r.hargaSatuan,
    kuantitas: r.kuantitas,
    ukuran: (r.ukuran ?? null) || (i === 0 ? uraian.ukuranLama : null),
  }));

  return {
    transaksi: t,
    items,
    biayaLain: biayaLainDariTransaksi(t),
    catatan: uraian.catatanBebas,
    pelanggan: pelanggan ?? null,
    terbayar,
    sisa: hitungSisa(t.total, terbayar),
    status: statusJahitan(t),
    sudahDikirim: kiriman.length > 0,
  };
}

export async function daftarPerluDitagih(sekarang: Date = new Date()): Promise<RingkasanJahitan[]> {
  const daftar = await daftarPesananJahit();
  const hariIni = tanggalHariIni(sekarang);
  return daftar.filter((p) => {
    if (p.status !== "terbuka") return false;
    if (!p.perkiraanSelesai) return false;
    return p.perkiraanSelesai < hariIni;
  });
}

export function statusJahitan(
  t: Pick<TransaksiRecord, "statusBayar" | "dibatalkanPada" | "statusPesanan">,
): "terbuka" | "lunas" | "batal" {
  if (t.dibatalkanPada !== null || t.statusPesanan === "dibatalkan") return "batal";
  return t.statusBayar === "lunas" ? "lunas" : "terbuka";
}

export function labelStatusJahitan(s: "terbuka" | "lunas" | "batal"): string {
  switch (s) {
    case "lunas":
      return "Lunas";
    case "batal":
      return "Batal";
    case "terbuka":
      return "Belum lunas";
  }
}

export async function catatPengiriman(
  dokumenId: UUID,
  pelangganId: UUID | null,
  jenis: "invoice" | "resi",
  tujuan: string,
): Promise<void> {
  const db = await getDB();
  await db.put("pengiriman", {
    id: buatId(),
    dokumenId,
    pelangganId: pelangganId ?? "",
    waktu: new Date().toISOString(),
    jenis,
    tujuan,
  });
}

function tanggalHariIni(sekarang: Date): string {
  const y = sekarang.getFullYear();
  const m = String(sekarang.getMonth() + 1).padStart(2, "0");
  const d = String(sekarang.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function modelDariTransaksi(t: TransaksiRecord): string {
  const catatan = t.catatanPesanan ?? "";
  const nama = catatan.split(" · ")[0]?.trim();
  return nama && nama.length > 0 ? nama : "Jasa jahit";
}

export function biayaLainDariTransaksi(t: Pick<TransaksiRecord, "catatanPesanan">): BiayaLainInput[] {
  const catatan = t.catatanPesanan ?? "";
  const hasil: BiayaLainInput[] = [];
  for (const potong of catatan.split(" · ")) {
    // Satu segmen mungkin memuat beberapa biaya lain, dipisah "|".
    for (const piece of potong.split("|")) {
      const idx = piece.indexOf(":");
      if (idx <= 0) continue;
      const nama = piece.slice(0, idx).trim();
      const nominal = Number(piece.slice(idx + 1));
      if (nama && Number.isInteger(nominal) && nominal > 0) {
        hasil.push({ nama, nominal });
      }
    }
  }
  return hasil;
}