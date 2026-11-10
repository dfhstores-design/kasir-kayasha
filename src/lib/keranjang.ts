/**
 * Perhitungan keranjang & transaksi (docs/design/BAZAR-PARKIR-RESI.md, PROJECT-BRIEF bagian 4).
 *
 * Rumus sumber kebenaran:
 *   subtotal_awal  = Σ (harga_satuan × kuantitas)
 *   diskon_item    = Σ (diskon_per_unit × kuantitas)
 *   subtotal_setelah = subtotal_awal − diskon_item
 *   diskon_total   ≤ subtotal_setelah
 *   ongkir_ditagihkan_butik = 0 kecuali mode "butik"
 *   total          = subtotal_awal − diskon_item − diskon_total + ongkir_ditagihkan_butik
 *   sudah_dibayar  = Σ pembayaran
 *   sisa_tagihan   = total − sudah_dibayar
 *
 * Semua nominal integer Rupiah. Fungsi di sini MURNI: tidak menyentuh IndexedDB/DOM.
 */
import type { Rupiah } from "./money.ts";
import { ongkirDitagihkanButik, type Ongkir, ONGKIR_GRATIS } from "./ongkir.ts";

export interface BarisKeranjang {
  /** Snapshot nama saat masuk keranjang. */
  nama: string;
  hargaSatuan: Rupiah;
  kuantitas: number;
  /** Diskon Rupiah PER UNIT (bukan persen). */
  diskonPerUnit: Rupiah;
}

export interface RingkasanKeranjang {
  subtotalAwal: Rupiah;
  diskonItem: Rupiah;
  subtotalSetelahDiskonItem: Rupiah;
  diskonTotal: Rupiah;
  ongkirDitagihkan: Rupiah;
  total: Rupiah;
  totalBelumTermasukOngkir: boolean;
}

export type KeranjangError =
  | { kode: "kuantitas_tidak_valid"; index: number }
  | { kode: "harga_negatif"; index: number }
  | { kode: "diskon_melebihi_harga"; index: number }
  | { kode: "diskon_total_melebihi_subtotal" }
  | { kode: "diskon_total_negatif" }
  | { kode: "total_negatif" };

export type HasilPerhitungan =
  | { ok: true; ringkasan: RingkasanKeranjang }
  | { ok: false; error: KeranjangError };

/** Diskon baris = diskon per unit × kuantitas. */
export function diskonBaris(baris: BarisKeranjang): Rupiah {
  return baris.diskonPerUnit * baris.kuantitas;
}

/** Subtotal baris (sebelum diskon). */
export function subtotalBaris(baris: BarisKeranjang): Rupiah {
  return baris.hargaSatuan * baris.kuantitas;
}

/** Subtotal baris setelah diskon item. */
export function subtotalBersihBaris(baris: BarisKeranjang): Rupiah {
  return subtotalBaris(baris) - diskonBaris(baris);
}

/**
 * Menghitung ringkasan keranjang beserta validasinya.
 * Mengembalikan error spesifik, bukan angka yang sudah diam-diam dikoreksi.
 */
export function hitungKeranjang(
  baris: readonly BarisKeranjang[],
  diskonTotal: Rupiah = 0,
  ongkir: Ongkir = ONGKIR_GRATIS,
): HasilPerhitungan {
  for (let i = 0; i < baris.length; i++) {
    const b = baris[i];
    if (!Number.isInteger(b.kuantitas) || b.kuantitas < 1) {
      return { ok: false, error: { kode: "kuantitas_tidak_valid", index: i } };
    }
    if (!Number.isInteger(b.hargaSatuan) || b.hargaSatuan < 0) {
      return { ok: false, error: { kode: "harga_negatif", index: i } };
    }
    if (!Number.isInteger(b.diskonPerUnit) || b.diskonPerUnit < 0) {
      return { ok: false, error: { kode: "diskon_melebihi_harga", index: i } };
    }
    // Diskon per unit tidak boleh melebihi harga jual per unit.
    if (b.diskonPerUnit > b.hargaSatuan) {
      return { ok: false, error: { kode: "diskon_melebihi_harga", index: i } };
    }
  }

  if (!Number.isInteger(diskonTotal) || diskonTotal < 0) {
    return { ok: false, error: { kode: "diskon_total_negatif" } };
  }

  let subtotalAwal = 0;
  let diskonItem = 0;
  for (const b of baris) {
    subtotalAwal += subtotalBaris(b);
    diskonItem += diskonBaris(b);
  }

  const subtotalSetelahDiskonItem = subtotalAwal - diskonItem;

  if (diskonTotal > subtotalSetelahDiskonItem) {
    return { ok: false, error: { kode: "diskon_total_melebihi_subtotal" } };
  }

  const ongkirDitagihkan = ongkirDitagihkanButik(ongkir);
  const total =
    subtotalAwal - diskonItem - diskonTotal + ongkirDitagihkan;

  if (total < 0) {
    return { ok: false, error: { kode: "total_negatif" } };
  }

  return {
    ok: true,
    ringkasan: {
      subtotalAwal,
      diskonItem,
      subtotalSetelahDiskonItem,
      diskonTotal,
      ongkirDitagihkan,
      total,
      // Resi wajib menyebut total belum final (BAZAR-PARKIR-RESI 4a).
      totalBelumTermasukOngkir: ongkir.mode === "belum_ditentukan",
    },
  };
}

export type StatusBayar = "lunas" | "dp" | "belum_dibayar";

export interface RingkasanPembayaran {
  total: Rupiah;
  sudahDibayar: Rupiah;
  sisa: Rupiah;
  status: StatusBayar;
}

/**
 * Status pembayaran diturunkan dari total dan jumlah pembayaran.
 * Pembayaran melebihi total DITOLAK (bukan dikoreksi diam-diam).
 */
export function hitungPembayaran(
  total: Rupiah,
  pembayaran: readonly Rupiah[],
): { ok: true; ringkasan: RingkasanPembayaran } | { ok: false; kode: "pembayaran_melebihi_total" } {
  let sudahDibayar = 0;
  for (const p of pembayaran) {
    if (!Number.isInteger(p) || p < 0) {
      return { ok: false, kode: "pembayaran_melebihi_total" };
    }
    sudahDibayar += p;
  }
  if (sudahDibayar > total) {
    return { ok: false, kode: "pembayaran_melebihi_total" };
  }
  const sisa = total - sudahDibayar;
  const status: StatusBayar =
    sudahDibayar === 0 ? "belum_dibayar" : sisa === 0 ? "lunas" : "dp";

  return { ok: true, ringkasan: { total, sudahDibayar, sisa, status } };
}

export function labelStatusBayar(status: StatusBayar): string {
  switch (status) {
    case "lunas":
      return "Lunas";
    case "dp":
      return "DP";
    case "belum_dibayar":
      return "Belum dibayar";
  }
}
