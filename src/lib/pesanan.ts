/**
 * Pre-order (PO), pembayaran, dan ongkir menyusul — Phase 4.
 *
 * Aturan kunci (BAZAR-PARKIR-RESI.md bagian 4–5, screens/07–08):
 * 1. PO **tidak** mengurangi stok. Stok berkurang saat barang diserahkan (status selesai).
 * 2. Status pembayaran (lunas/dp/belum_dibayar) TERPISAH dari status pesanan
 *    (diproses/siap/selesai/dibatalkan).
 * 3. Ongkir "belum ditentukan" boleh diisi kemudian; total dihitung ulang dan
 *    setiap perubahan TOTAL dicatat sebagai riwayat (audit).
 * 4. Pembatalan TIDAK menghapus pembayaran.
 *
 * Fungsi di sini murni (tanpa IndexedDB) kecuali dinyatakan lain.
 */
import type { Rupiah } from "./money.ts";
import type { Ongkir } from "./ongkir.ts";
import { hitungKeranjang, hitungPembayaran, type BarisKeranjang, type StatusBayar } from "./keranjang.ts";
import { ONGKIR_GRATIS, ongkirDitagihkanButik } from "./ongkir.ts";

export type StatusPesanan = "diproses" | "siap" | "selesai" | "dibatalkan";

export const STATUS_PESANAN: readonly StatusPesanan[] = [
  "diproses",
  "siap",
  "selesai",
  "dibatalkan",
] as const;

export function labelStatusPesanan(s: StatusPesanan): string {
  switch (s) {
    case "diproses":
      return "Diproses";
    case "siap":
      return "Siap diambil atau dikirim";
    case "selesai":
      return "Selesai";
    case "dibatalkan":
      return "Dibatalkan";
  }
}

/** Urutan kelompok pada daftar pesanan. */
export const URUTAN_KELOMPOK: readonly StatusPesanan[] = ["siap", "diproses", "selesai", "dibatalkan"] as const;

export interface ItemPO {
  produkId: string;
  nama: string;
  hargaSatuan: Rupiah;
  kuantitas: number;
  diskonPerUnit: Rupiah;
}

export interface RencanaPO {
  items: readonly ItemPO[];
  diskonTotal: Rupiah;
  ongkir: Ongkir;
  namaPemesan: string;
  kontak: string | null;
  perkiraanSiap: string | null;
  alamat: string | null;
  catatan: string | null;
  /** DP yang dibayar saat PO dibuat (0 = belum dibayar). */
  dibayarSekarang: Rupiah;
  jenisBayar: "tunai" | "transfer" | "qris" | null;
  bazarId: string | null;
}

export type HasilRencanaPO =
  | { ok: true; total: Rupiah; sudahDibayar: Rupiah; sisa: Rupiah; status: StatusBayar }
  | { ok: false; pesan: string };

/** Memvalidasi rencana PO sebelum disimpan. */
export function periksaRencanaPO(rencana: RencanaPO): HasilRencanaPO {
  if (rencana.items.length === 0) {
    return { ok: false, pesan: "Pilih barang dulu." };
  }
  if (rencana.namaPemesan.trim().length < 2) {
    return { ok: false, pesan: "Isi nama pemesan." };
  }

  const baris: BarisKeranjang[] = rencana.items.map((i) => ({
    nama: i.nama,
    hargaSatuan: i.hargaSatuan,
    kuantitas: i.kuantitas,
    diskonPerUnit: i.diskonPerUnit,
  }));

  const hasil = hitungKeranjang(baris, rencana.diskonTotal, rencana.ongkir);
  if (!hasil.ok) {
    switch (hasil.error.kode) {
      case "diskon_melebihi_harga":
        return {
          ok: false,
          pesan: `Diskon tidak boleh lebih dari harga ${rencana.items[hasil.error.index]?.nama ?? "barang"}.`,
        };
      case "diskon_total_melebihi_subtotal":
        return { ok: false, pesan: "Diskon total melebihi sisa subtotal." };
      default:
        return { ok: false, pesan: "Ada isian yang tidak valid." };
    }
  }

  const total = hasil.ringkasan.total;
  if (!Number.isInteger(rencana.dibayarSekarang) || rencana.dibayarSekarang < 0) {
    return { ok: false, pesan: "DP harus angka 0 atau lebih." };
  }
  if (rencana.dibayarSekarang > total) {
    return { ok: false, pesan: "DP tidak boleh melebihi total." };
  }

  const bayar = hitungPembayaran(total, rencana.dibayarSekarang > 0 ? [rencana.dibayarSekarang] : []);
  if (!bayar.ok) return { ok: false, pesan: "Nominal melebihi total." };

  return {
    ok: true,
    total,
    sudahDibayar: bayar.ringkasan.sudahDibayar,
    sisa: bayar.ringkasan.sisa,
    status: bayar.ringkasan.status,
  };
}

/** Alamat hanya relevan bila pesanan dikirim. */
export function alamatWajib(ongkir: Ongkir): boolean {
  return ongkir.mode === "butik" || ongkir.mode === "kurir";
}

/* ------------------------------------------------------- pembayaran */

export type HasilPembayaran =
  | { ok: true; sudahDibayar: Rupiah; sisa: Rupiah; status: StatusBayar }
  | { ok: false; pesan: string };

/**
 * Menghitung efek pencatatan pembayaran baru.
 * Pembayaran melebihi sisa DITOLAK (tidak dikoreksi diam-diam).
 */
export function hitungPembayaranBaru(
  total: Rupiah,
  pembayaranSebelum: readonly Rupiah[],
  nominalBaru: Rupiah,
): HasilPembayaran {
  if (!Number.isInteger(nominalBaru) || nominalBaru <= 0) {
    return { ok: false, pesan: "Nominal harus lebih dari 0." };
  }
  const sebelum = hitungPembayaran(total, pembayaranSebelum);
  if (!sebelum.ok) return { ok: false, pesan: "Ada pembayaran yang melebihi total." };

  const sisa = sebelum.ringkasan.sisa;
  if (nominalBaru > sisa) {
    return { ok: false, pesan: `Nominal melebihi sisa tagihan Rp ${sisa.toLocaleString("id-ID")}.` };
  }

  const sesudah = hitungPembayaran(total, [...pembayaranSebelum, nominalBaru]);
  if (!sesudah.ok) return { ok: false, pesan: "Nominal melebihi total." };

  return {
    ok: true,
    sudahDibayar: sesudah.ringkasan.sudahDibayar,
    sisa: sesudah.ringkasan.sisa,
    status: sesudah.ringkasan.status,
  };
}

/* --------------------------------------------- ongkir menyusul */

export interface CatatanPerubahanTotal {
  waktu: string;
  totalLama: Rupiah;
  totalBaru: Rupiah;
  alasan: string;
}

export type HasilIsiOngkir =
  | {
      ok: true;
      totalBaru: Rupiah;
      ongkirDitagihkan: Rupiah;
      statusBerubah: boolean;
      status: StatusBayar;
      sisa: Rupiah;
      catatan: CatatanPerubahanTotal;
    }
  | { ok: false; pesan: string };

/**
 * Mengisi ongkir yang tadinya "belum ditentukan".
 * Total dihitung ulang; bila sebelumnya LUNAS, status kembali menjadi DP.
 * Setiap perubahan total WAJIB dikembalikan sebagai catatan riwayat.
 */
export function hitungIsiOngkir(
  args: {
    subtotalAwal: Rupiah;
    diskonItem: Rupiah;
    diskonTotal: Rupiah;
    totalSekarang: Rupiah;
    ongkirBaru: Ongkir;
    pembayaran: readonly Rupiah[];
    statusSekarang: StatusBayar;
  },
  waktuIso: string,
): HasilIsiOngkir {
  const { subtotalAwal, diskonItem, diskonTotal, totalSekarang, ongkirBaru, pembayaran, statusSekarang } = args;

  if (ongkirBaru.mode === "belum_ditentukan") {
    return { ok: false, pesan: "Isi nominal atau pilih cara ongkir." };
  }

  const ongkirDitagihkan = ongkirDitagihkanButik(ongkirBaru);
  const totalBaru = subtotalAwal - diskonItem - diskonTotal + ongkirDitagihkan;

  if (totalBaru < 0) return { ok: false, pesan: "Total tidak boleh negatif." };

  const bayar = hitungPembayaran(totalBaru, pembayaran);
  if (!bayar.ok) {
    return { ok: false, pesan: "Pembayaran yang sudah ada melebihi total baru." };
  }

  return {
    ok: true,
    totalBaru,
    ongkirDitagihkan,
    statusBerubah: bayar.ringkasan.status !== statusSekarang,
    status: bayar.ringkasan.status,
    sisa: bayar.ringkasan.sisa,
    catatan: {
      waktu: waktuIso,
      totalLama: totalSekarang,
      totalBaru,
      alasan: ongkirDitagihkan > 0 ? `ongkir Rp${ongkirDitagihkan.toLocaleString("id-ID")}` : "ongkir diperbarui",
    },
  };
}

/** Teks riwayat total, contoh: "Total diubah 12 Nov: Rp 850.000 → Rp 875.000 (ongkir Rp 25.000)". */
export function formatCatatanPerubahanTotal(c: CatatanPerubahanTotal): string {
  const f = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;
  return `Total diubah: ${f(c.totalLama)} → ${f(c.totalBaru)} (${c.alasan})`;
}

/* ------------------------------------------------------ pembatalan */

/** Transisi status pesanan yang diizinkan. */
export function transisiSah(dari: StatusPesanan, ke: StatusPesanan): boolean {
  if (dari === ke) return false;
  // Status final: tidak bisa berubah lagi.
  if (dari === "dibatalkan" || dari === "selesai") return false;
  if (ke === "dibatalkan") return true;
  if (dari === "diproses") return ke === "siap";
  if (dari === "siap") return ke === "selesai" || ke === "diproses";
  return false;
}

/** Pesan konfirmasi pembatalan. Pembayaran TIDAK dihapus. */
export function pesanKonfirmasiBatal(nomor: string): string {
  return `Batalkan pesanan ${nomor}? Riwayat pembayaran tetap disimpan.`;
}

/** PO yang dibatalkan menyisakan sisa tagihan tetapi tidak boleh ditagih lagi. */
export function masihBisaDitagih(statusPesanan: StatusPesanan): boolean {
  return statusPesanan !== "dibatalkan";
}

/* ------------------------------------------------------ daftar */

export interface RingkasanPesanan {
  id: string;
  nomorResi: string;
  namaPemesan: string;
  waktu: string;
  total: Rupiah;
  sudahDibayar: Rupiah;
  sisa: Rupiah;
  statusPesanan: StatusPesanan;
  statusBayar: StatusBayar;
}

/** Mengelompokkan pesanan mengikuti urutan layar 07. */
export function kelompokkanPesanan(
  daftar: readonly RingkasanPesanan[],
): Array<{ status: StatusPesanan; pesanan: RingkasanPesanan[] }> {
  return URUTAN_KELOMPOK.map((status) => ({
    status,
    pesanan: daftar.filter((p) => p.statusPesanan === status),
  })).filter((g) => g.pesanan.length > 0);
}

/** Pencarian sederhana berdasarkan nama pemesan atau nomor. */
export function cariPesanan(daftar: readonly RingkasanPesanan[], kata: string): RingkasanPesanan[] {
  const q = kata.trim().toLowerCase();
  if (!q) return [...daftar];
  return daftar.filter(
    (p) => p.namaPemesan.toLowerCase().includes(q) || p.nomorResi.toLowerCase().includes(q),
  );
}

/** Total sisa tagihan SEMUA PO yang belum lunas dan belum dibatalkan. */
export function totalSisaPO(daftar: readonly RingkasanPesanan[]): Rupiah {
  return daftar
    .filter((p) => p.statusPesanan !== "dibatalkan" && p.statusBayar !== "lunas")
    .reduce((n, p) => n + p.sisa, 0);
}

/** Ongkir default untuk PO baru (ambil sendiri). */
export const ONGKIR_PO_AWAL: Ongkir = ONGKIR_GRATIS;
