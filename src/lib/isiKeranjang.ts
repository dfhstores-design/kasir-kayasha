import type { ProdukRecord } from "../db/repositori.ts";
import type { UUID } from "../db/schema.ts";

/** Satu baris keranjang di UI (bukan record database). */
export interface IsiKeranjang {
  produkId: UUID;
  nama: string;
  hargaSatuan: number;
  /** Batas jumlah yang boleh dipilih: stok gudang (atau saldo bazar bila di bazar). */
  stokTersedia: number;
  kuantitas: number;
  diskonPerUnit: number;
}

/** Membuat baris keranjang dari produk katalog. */
export function bikinIsiKeranjang(produk: ProdukRecord, kuantitas = 1): IsiKeranjang {
  return {
    produkId: produk.id,
    nama: produk.nama,
    hargaSatuan: produk.hargaJual,
    stokTersedia: produk.stokGudang,
    kuantitas,
    diskonPerUnit: 0,
  };
}
