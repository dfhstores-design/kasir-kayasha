/**
 * Aturan stok — ditegakkan di SATU tempat, dipakai UI dan repository.
 *
 * Aturan pemilik (10 Nov 2026):
 *   1. Stok gudang berkurang ketika barang DIBawa ke bazar (alokasi).
 *   2. Stok bazar berkurang ketika terjadi PENJUALAN.
 *   3. Penjualan bazar TIDAK mengubah stok gudang.
 *
 * Konsekuensi yang dijaga oleh tipe di bawah: transaksi yang berjalan di bazar
 * HARUS memakai `tipe: "bazar"`. Repository akan menolak `tipe: "gudang"` bila
 * transaksi tersebut berjalan di bazar.
 */
import type { UUID } from "../db/schema.ts";

export const LAINNYA = "lainnya" as const;

/** Sumber pengurangan stok saat transaksi disimpan. */
export type SumberStok =
  /** Penjualan di luar bazar: mengurangi stok gudang. */
  | { tipe: "gudang"; produkId: UUID; jumlah: number }
  /** Penjualan di bazar: mengurangi saldo bazar, TIDAK menyentuh gudang. */
  | { tipe: "bazar"; produkId: UUID; bazarId: UUID; jumlah: number };

export type StokErrorKode =
  | "stok_gudang_tidak_cukup"
  | "saldo_bazar_tidak_cukup"
  | "tidak_ada_bazar_aktif"
  | "penjualan_bazar_tidak_boleh_mengurangi_gudang"
  | "jumlah_tidak_valid";

/**
 * Menyusun sumber stok untuk sebuah transaksi.
 *
 * `bazarId` = null  → transaksi di luar bazar, memakai stok gudang
 * `bazarId` = uuid → transaksi bazar WAJIB memakai saldo bazar
 */
export function sumberStokUntuk(
  item: ReadonlyArray<{ produkId: UUID; kuantitas: number }>,
  bazarId: UUID | null,
): SumberStok[] {
  return item.map((i) =>
    bazarId
      ? { tipe: "bazar" as const, produkId: i.produkId, bazarId, jumlah: i.kuantitas }
      : { tipe: "gudang" as const, produkId: i.produkId, jumlah: i.kuantitas },
  );
}

/**
 * Memeriksa apakah semua sumber stok sah untuk transaksi ini.
 * Dipakai sebelum menulis, agar tidak ada pengurangan sebagian.
 */
export function validasiSumberStok(
  sumber: readonly SumberStok[],
  bazarIdTransaksi: UUID | null,
): { ok: true } | { ok: false; kode: StokErrorKode; produkId?: UUID } {
  for (const s of sumber) {
    if (!Number.isInteger(s.jumlah) || s.jumlah < 1) {
      return { ok: false, kode: "jumlah_tidak_valid", produkId: s.produkId };
    }
    if (bazarIdTransaksi === null && s.tipe === "bazar") {
      // Transaksi tanpa bazar tidak boleh memotong saldo bazar.
      return { ok: false, kode: "tidak_ada_bazar_aktif", produkId: s.produkId };
    }
    if (bazarIdTransaksi !== null) {
      if (s.tipe === "gudang") {
        // Inilah aturan pemilik: penjualan bazar TIDAK mengurangi gudang.
        return { ok: false, kode: "penjualan_bazar_tidak_boleh_mengurangi_gudang", produkId: s.produkId };
      }
      if (s.bazarId !== bazarIdTransaksi) {
        return { ok: false, kode: "tidak_ada_bazar_aktif", produkId: s.produkId };
      }
    }
  }
  return { ok: true };
}

/** Pesan pengguna dalam Bahasa Indonesia sehari-hari. */
export function pesanStok(kode: StokErrorKode): string {
  switch (kode) {
    case "stok_gudang_tidak_cukup":
      return "Stok gudang tidak cukup.";
    case "saldo_bazar_tidak_cukup":
      return "Stok bazar tidak cukup.";
    case "tidak_ada_bazar_aktif":
      return "Tidak ada bazar aktif.";
    case "penjualan_bazar_tidak_boleh_mengurangi_gudang":
      return "Penjualan bazar hanya mengurangi stok bazar, bukan stok gudang.";
    case "jumlah_tidak_valid":
      return "Jumlah barang tidak valid.";
  }
}
