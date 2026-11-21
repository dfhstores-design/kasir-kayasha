/**
 * Peran aktif di aplikasi (ROLE-BIAYA-RINGKASAN.md; Fase 2A, BU-32).
 *
 * - "kasir": peran bawaan; hanya transaksi (Penjualan saat bazar aktif,
 *   Pesanan Jahit, Terima Pembayaran).
 * - "admin": SATU orang saja, tidak ada admin 2 (BU-32). Mengatur barang,
 *   bazar, biaya, ringkasan penjualan, dan PIN kasir. TIDAK bisa membuka
 *   laporan keuangan owner.
 * - "owner": saat ini Tante (dua mode di perangkat yang sama), nantinya
 *   Andri. Bisa semua yang admin bisa, DITAMBAH laporan keuangan owner
 *   (isinya masih grey/placeholder di Tahap 2 — bukan bagian Tahap 2).
 */
export type Peran = "kasir" | "admin" | "owner";

/** Fitur yang hanya boleh dibuka admin (dan owner). */
export const LAYAR_KHUSUS_ADMIN = [
  "barang",
  "form-barang",
  "bazar",
  "alokasi-bazar",
  "tutup-bazar",
  "ringkasan",
  "pengaturan",
  "biaya-bazar",
  "atur-pin",
  "cadangan",
  "sinkronisasi",
] as const;

export function khususAdmin(layar: string): boolean {
  return (LAYAR_KHUSUS_ADMIN as readonly string[]).includes(layar);
}

/** Boleh membuka fitur admin: admin dan owner (owner mencakup admin). */
export function bolehAdmin(peran: Peran): boolean {
  return peran === "admin" || peran === "owner";
}

/** Boleh membuka laporan keuangan owner: hanya owner, admin tidak boleh. */
export function bolehLaporanOwner(peran: Peran): boolean {
  return peran === "owner";
}

/**
 * Lokasi tempat kasir terikat pada sesi ini (Fase 2A, BU-34).
 * 1 lokasi = 1 kasir. Ikatan ini hanya di memori perangkat (hilang saat
 * aplikasi dimuat ulang); penegakan lintas perangkat datang bersama
 * sinkronisasi di Fase 2B.
 */
export type LokasiKasir = { jenis: "toko" } | { jenis: "bazar"; bazarId: string; nama: string };

/** Label pendek lokasi kasir untuk Beranda. */
export function labelLokasiKasir(lokasi: LokasiKasir): string {
  return lokasi.jenis === "toko" ? "Toko" : lokasi.nama;
}
