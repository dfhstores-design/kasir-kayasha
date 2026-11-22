import type { BazarRecord } from "../db/schema.ts";

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
  "reset-pin-owner",
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

/**
 * Boleh membuka Penjualan (F14, BU-66, tes klik 22 Nov 2026): kasir toko
 * (butik/gudang) adalah yang core — selalu boleh jualan dari stok butik,
 * dengan atau tanpa bazar aktif. Kasir bazar / kasir tanpa lokasi tetap
 * perlu bazar aktif. Admin/owner seperti semula: selalu boleh.
 */
export function bolehJualBarang(
  peran: Peran,
  lokasiKasir: LokasiKasir | null,
  bazarAktifAda: boolean,
): boolean {
  if (bolehAdmin(peran)) return true;
  if (lokasiKasir?.jenis === "toko") return true;
  return bazarAktifAda;
}

/**
 * Bazar yang dipakai penjualan barang (F14, BU-66): kasir toko selalu
 * menjual dari gudang (null), apa pun status bazar. Ini penjualan
 * berbasis lokasi yang jatuh keluar dari perbaikan F14 tanpa pengerjaan
 * ulang parallel-selling: stok gudang dibaca dari produk itu sendiri,
 * tidak perlu peta saldo per bazar.
 *
 * Peran lain memakai bazar aktif (perilaku lama, belum diubah). Jualan
 * toko + bazar barengan dari stok masing-masing untuk kasir BAZAR yang
 * bazarnya bukan yang terakhir dibuka tetap Tahap 3 (BU-39/BU-58):
 * saldo bazar di App hanya memuat bazar terakhir dibuka.
 */
export function bazarPenjualan(
  lokasiKasir: LokasiKasir | null,
  bazarAktif: BazarRecord | null,
): BazarRecord | null {
  if (lokasiKasir?.jenis === "toko") return null;
  return bazarAktif;
}

/** Id bazar dari `bazarPenjualan` (null = penjualan memakai stok gudang). */
export function bazarIdPenjualan(
  lokasiKasir: LokasiKasir | null,
  bazarAktif: BazarRecord | null,
): string | null {
  return bazarPenjualan(lokasiKasir, bazarAktif)?.id ?? null;
}
