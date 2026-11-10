/**
 * Stok gudang & saldo bazar (BAZAR-PARKIR-RESI.md bagian 2).
 *
 * Aturan yang dijaga:
 * 1. Stok gudang TIDAK berubah karena penjualan bazar.
 * 2. Saldo bazar dihitung dari catatan alokasi, bukan diketik langsung.
 * 3. Alokasi tidak boleh melebihi stok gudang; saldo tidak boleh negatif.
 * 4. Penarikan (saat tutup bazar) mengembalikan stok ke gudang.
 */

export interface CatatanAlokasi {
  /** Pcs yang dibawa ke bazar. */
  dibawa: number;
  /** Pcs yang sudah terjual di bazar. */
  terjual: number;
  /** Pcs yang ditarik kembali ke gudang. */
  ditarik: number;
}

/**
 * Saldo bazar = dibawa − terjual − ditarik.
 * Selalu >= 0 bila catatan konsisten.
 */
export function hitungSaldoBazar(catatan: CatatanAlokasi): number {
  return catatan.dibawa - catatan.terjual - catatan.ditarik;
}

export type StokError =
  | "bukan_bilangan_bulat"
  | "negatif"
  | "melebihi_stok_gudang"
  | "saldo_tidak_cukup";

export type StokResult = { ok: true; value: number } | { ok: false; error: StokError };

/** Memvalidasi jumlah yang akan dibawa ke bazar terhadap stok gudang. */
export function validasiAlokasi(jumlah: number, stokGudang: number): StokResult {
  if (!Number.isInteger(jumlah) || !Number.isInteger(stokGudang)) {
    return { ok: false, error: "bukan_bilangan_bulat" };
  }
  if (jumlah < 0) return { ok: false, error: "negatif" };
  if (jumlah > stokGudang) return { ok: false, error: "melebihi_stok_gudang" };
  return { ok: true, value: jumlah };
}

/** Memvalidasi jumlah yang akan dijual dari saldo bazar. */
export function validasiPenjualan(jumlah: number, saldoBazar: number): StokResult {
  if (!Number.isInteger(jumlah) || !Number.isInteger(saldoBazar)) {
    return { ok: false, error: "bukan_bilangan_bulat" };
  }
  if (jumlah < 1) return { ok: false, error: "negatif" };
  if (jumlah > saldoBazar) return { ok: false, error: "saldo_tidak_cukup" };
  return { ok: true, value: jumlah };
}

/**
 * Hasil satu alokasi: gudang berkurang, bazar bertambah.
 * Mengembalikan nilai BARU, tidak memutasi masukan.
 */
export function terapkanAlokasi(
  stokGudang: number,
  jumlahDibawa: number,
): { stokGudangBaru: number; tambahanBazar: number } {
  const cek = validasiAlokasi(jumlahDibawa, stokGudang);
  if (!cek.ok) throw new RangeError(`Alokasi tidak sah: ${cek.error}`);
  return {
    stokGudangBaru: stokGudang - jumlahDibawa,
    tambahanBazar: jumlahDibawa,
  };
}

/**
 * Hasil tutup bazar: sisa yang dikembalikan menambah stok gudang.
 * Sisa yang TIDAK dikembalikan dianggap habis di bazar (tidak boleh negatif).
 */
export function terapkanTutupBazar(
  stokGudang: number,
  sisaBazar: number,
  dikembalikan: number,
): { ok: true; stokGudangBaru: number; hilang: number } | { ok: false; error: StokError } {
  if (!Number.isInteger(dikembalikan) || dikembalikan < 0 || dikembalikan > sisaBazar) {
    return { ok: false, error: "saldo_tidak_cukup" };
  }
  return {
    ok: true,
    stokGudangBaru: stokGudang + dikembalikan,
    hilang: sisaBazar - dikembalikan,
  };
}
