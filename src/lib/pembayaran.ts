/**
 * Logika DP / cicilan / pelunasan / kembalian (BU-13, BU-17.B, BU-23) — fungsi MURNI.
 *
 * Berbeda dari `keranjang.hitungPembayaran` (yang MENOLAK bayar lebih), fungsi di sini
 * sesuai BU-17.B: kasir boleh MENERIMA lebih dari total; nominal diterima dicatat utuh,
 * kelebihan ditampilkan sebagai KEMBALIAN. Terbayar dijumlah; status jadi "lunas" saat
 * terbayar >= total.
 *
 * Semua nominal integer Rupiah. Tidak ada floating point.
 */
import type { Rupiah } from "./money.ts";

/** Status pembayaran dokumen (BU-20): belum lunas vs lunas. */
export type StatusPembayaran = "terbuka" | "lunas";

export const STATUS_PEMBAYARAN: readonly StatusPembayaran[] = ["terbuka", "lunas"] as const;

export function labelStatusPembayaran(s: StatusPembayaran): string {
  return s === "lunas" ? "Lunas" : "Belum lunas";
}

export interface RingkasanPenerimaan {
  /** Total terbayar setelah penerimaan ini. */
  terbayarBaru: Rupiah;
  /** Sisa tagihan setelah penerimaan ini (tidak pernah negatif). */
  sisaBaru: Rupiah;
  /** Uang kembali ke pelanggan (kelebihan di atas total); 0 bila tidak ada. */
  kembalian: Rupiah;
  /** "lunas" bila terbayar >= total, selain itu "terbuka". */
  statusBaru: StatusPembayaran;
}

export type HasilTerimaPembayaran =
  | { ok: true; ringkasan: RingkasanPenerimaan }
  | { ok: false; pesan: string };

/**
 * Mencatat satu penerimaan pembayaran (BU-23): DP/cicilan/pelunasan/lebih.
 *
 * Aturan:
 *  - nominalDiterima wajib integer > 0.
 *  - Boleh bayar lebih; kembalian dihitung, but nominal diterima TETAP dicatat utuh.
 *  - terbayar dijumlah; status lunas saat terbayar >= total.
 */
export function terimaPembayaran(
  total: Rupiah,
  terbayarSebelumnya: Rupiah,
  nominalDiterima: Rupiah,
  _metode: string | null,
): HasilTerimaPembayaran {
  if (!Number.isInteger(nominalDiterima) || nominalDiterima <= 0) {
    return { ok: false, pesan: "Nominal harus lebih dari 0." };
  }
  if (!Number.isInteger(total) || total < 0) {
    return { ok: false, pesan: "Total tidak valid." };
  }
  if (!Number.isInteger(terbayarSebelumnya) || terbayarSebelumnya < 0) {
    return { ok: false, pesan: "Terbayar sebelumnya tidak valid." };
  }

  const terbayarBaru = terbayarSebelumnya + nominalDiterima;
  const sisaBaru = total - terbayarBaru > 0 ? total - terbayarBaru : 0;
  const kembalian = terbayarBaru - total > 0 ? terbayarBaru - total : 0;
  const statusBaru: StatusPembayaran = terbayarBaru >= total ? "lunas" : "terbuka";

  return { ok: true, ringkasan: { terbayarBaru, sisaBaru, kembalian, statusBaru } };
}