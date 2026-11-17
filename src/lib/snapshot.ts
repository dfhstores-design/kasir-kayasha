/**
 * Helper snapshot nama & rekening (asas snapshot) — fungsi MURNI.
 *
 * Riwayat transaksi tidak boleh berubah saat katalog / pengaturan diedit belakangan.
 * Karena itu nama produk dan rekening yang tertera di dokumen disalin saat dibuat,
 * bukan menunjuk ke objek hidup. Pola ini mengikuti `penjualan.ts`:
 *   `namaSnapshot: i.nama`  (salinan nilai)
 *   `rekeningSnapshot: [...konteks.rekening]` (salinan elemen)
 *
 * String di JavaScript bersifat immutable, jadi salinan nama cukup nilai itu sendiri;
 * array of object perlu disalin per elemen agar perubahan elemen asli tidak merembes.
 */
import type { Rekening } from "../db/schema.ts";

/** Salinan nama untuk snapshot riwayat. Tipe string sengaja dipertahankan immutabel. */
export function snapshotNama(nama: string): string {
  return nama;
}

/**
 * Salinan daftar rekening untuk snapshot riwayat: elemen disalin satu per satu,
 * sehingga mengubah rekening asli belakangan tidak mengubah dokumen yang tersimpan.
 */
export function snapshotRekening(rekening: readonly Rekening[]): Rekening[] {
  return rekening.map((r) => ({ ...r }));
}