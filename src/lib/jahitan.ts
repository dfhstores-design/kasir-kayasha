/**
 * Pesanan jahit (BU-12, BU-13, BU-14, BU-15, BU-22, BU-28) — fungsi murni + persistensi.
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
 * Bagian murni (tanpa IndexedDB) bisa diuji lepas; hanya `simpanPesananJahit` yang
 * menyentuh database. Skema TIDAK diubah di sini — dipakai apa adanya dari schema.ts.
 */
import { getDB, type JournalRecord, type PelangganRecord, type Rekening, type TransaksiRecord, type UUID } from "../db/schema.ts";
import { buatId, daftarTransaksi } from "../db/repositori.ts";
import { nomorPlaceholder } from "./dokumen.ts";
import type { Rupiah } from "./money.ts";
import { sapaanDariWaktu } from "./sapaan.ts";
import { recomputeJurnalDariDokumen, hitungSisa } from "./jurnal.ts";

/** Satu baris "biaya lain" (BU-15): nama + nominal. Nominal boleh 0 (tidak dicetak). */
export interface BiayaLainInput {
  nama: string;
  nominal: Rupiah;
}

/** Masukan wizard pesanan jahit (BU-22.A: langkah pemesan → jahitan → biaya → simpan). */
export interface RencanaJahitan {
  namaPemesan: string;
  kontak: string | null;
  model: string;
  ukuran: string | null;
  perkiraanSelesai: string | null;
  catatan: string | null;
  biayaJasa: Rupiah;
  biayaLain: readonly BiayaLainInput[];
}

export type HasilRencanaJahitan =
  | { ok: true; total: Rupiah; biayaJasa: Rupiah; biayaLainTotal: Rupiah }
  | { ok: false; pesan: string };

/**
 * Validasi rencana pesanan jahit (BU-14): wajib `namaPemesan`, `model`, `biayaJasa`.
 * `biayaJasa` integer Rupiah > 0. Biaya lain opsional, nominal integer >= 0.
 */
export function periksaRencanaJahitan(rencana: RencanaJahitan): HasilRencanaJahitan {
  if (rencana.namaPemesan.trim().length < 2) {
    return { ok: false, pesan: "Isi nama pemesan." };
  }
  if (rencana.model.trim().length < 2) {
    return { ok: false, pesan: "Isi model atau jenis jahitan." };
  }
  if (!Number.isInteger(rencana.biayaJasa) || rencana.biayaJasa <= 0) {
    return { ok: false, pesan: "Biaya jasa harus lebih dari 0." };
  }

  let biayaLainTotal = 0;
  for (const b of rencana.biayaLain) {
    if (!Number.isInteger(b.nominal) || b.nominal < 0) {
      return { ok: false, pesan: `Nominal "${b.nama || "biaya lain"}" tidak valid.` };
    }
    biayaLainTotal += b.nominal;
  }

  const total = rencana.biayaJasa + biayaLainTotal;
  if (!Number.isSafeInteger(total) || total <= 0) {
    return { ok: false, pesan: "Total tidak valid." };
  }

  return { ok: true, total, biayaJasa: rencana.biayaJasa, biayaLainTotal };
}

export interface PesananJahitTersimpan {
  id: UUID;
  nomor: string;
  namaPemesan: string;
  total: Rupiah;
  biayaJasa: Rupiah;
  biayaLain: readonly BiayaLainInput[];
  pelangganId: UUID;
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
  biayaLain: readonly BiayaLainInput[];
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
  konteks: { rekening: readonly Rekening[]; waktu?: Date },
): Promise<HasilSimpanJahitan> {
  const cek = periksaRencanaJahitan(rencana);
  if (!cek.ok) return { ok: false, pesan: cek.pesan };

  const waktu = konteks.waktu ?? new Date();
  const iso = waktu.toISOString();
  const hari = iso.slice(0, 10);
  // Nomor urut pesanan jahit hari itu (hanya jenisDokumen "jasa" yang dihitung,
  // supaya penjualan barang tidak ikut menggeser nomor pesanan).
  const semua = await daftarTransaksi();
  const urutHariIni = semua.filter((t) => t.waktu.slice(0, 10) === hari && t.jenisDokumen === "jasa").length + 1;
  const id = buatId();
  const pelangganId = buatId();

  const pelanggan: PelangganRecord = {
    id: pelangganId,
    nama: rencana.namaPemesan.trim(),
    kontak: rencana.kontak?.trim() || null,
  };

  const biayaLainBersih: BiayaLainInput[] = rencana.biayaLain
    .filter((b) => b.nama.trim().length > 0 && b.nominal > 0)
    .map((b) => ({ nama: b.nama.trim().slice(0, 40), nominal: b.nominal }));

  const trx: TransaksiRecord = {
    id,
    nomorResi: nomorPlaceholder(waktu, urutHariIni),
    nomorUrutHari: urutHariIni,
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
    catatanPesanan: susunCatatanJahitan(rencana, biayaLainBersih),
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

  db.put("pelanggan", pelanggan);
  db.put("transactions", trx);
  db.put("transaction_items", {
    id: buatId(),
    transaksiId: id,
    produkId: null,
    namaSnapshot: rencana.model.trim(),
    hargaSatuan: cek.biayaJasa,
    kuantitas: 1,
    diskonPerUnit: 0,
    subtotalBersih: cek.biayaJasa,
  });

  for (const b of recomputeJurnalDariDokumen({ id, total: cek.total }, [])) {
    const baris: JournalRecord = { ...b, id: buatId() };
    db.put("journal", baris);
  }

  for (const b of biayaLainBersih) simpanBiayaLainTersimpan(b.nama, b.nominal);

  return {
    ok: true,
    pesanan: {
      id,
      nomor: trx.nomorResi,
      namaPemesan: trx.namaPemesan ?? "",
      total: cek.total,
      biayaJasa: cek.biayaJasa,
      biayaLain: biayaLainBersih,
      pelangganId,
    },
  };
}

function susunCatatanJahitan(rencana: RencanaJahitan, biayaLainBersih: readonly BiayaLainInput[]): string | null {
  const bagian: string[] = [];
  bagian.push(rencana.model.trim());
  if (rencana.ukuran?.trim()) bagian.push(rencana.ukuran.trim());
  if (biayaLainBersih.length > 0) bagian.push(biayaLainBersih.map((b) => `${b.nama}:${b.nominal}`).join("|"));
  if (rencana.catatan?.trim()) bagian.push(rencana.catatan.trim());
  return bagian.length > 0 ? bagian.join(" · ") : null;
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

  const [pembayaran, kiriman, pelanggan] = await Promise.all([
    db.getAllFromIndex("payments", "by-transaksi", id),
    db.getAllFromIndex("pengiriman", "by-dokumen", id),
    t.pelangganId ? db.get("pelanggan", t.pelangganId) : Promise.resolve(undefined),
  ]);
  const terbayar = pembayaran.reduce((n, p) => n + p.nominal, 0);

  return {
    transaksi: t,
    biayaLain: biayaLainDariTransaksi(t),
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