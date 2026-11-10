/**
 * Ringkasan bazar & hitung ulang sisa (ROLE-BIAYA-RINGKASAN.md bagian 4–5).
 *
 * Fungsi murni: tidak menyentuh IndexedDB. Semua nominal integer Rupiah.
 */
import type { Rupiah } from "./money.ts";
import type { KategoriBiaya } from "../db/schema.ts";

export interface BiayaRingkas {
  kategori: KategoriBiaya;
  judul: string;
  nominal: Rupiah;
  tanggal: string;
}

export const LABEL_KATEGORI: Record<KategoriBiaya, string> = {
  sewa_booth: "Sewa booth",
  transport: "Transport",
  konsumsi: "Konsumsi",
  perlengkapan: "Perlengkapan",
  lainnya: "Lainnya",
};

export function labelKategori(k: KategoriBiaya): string {
  return LABEL_KATEGORI[k];
}

export type MetodeBayar = "tunai" | "transfer" | "qris" | null;

export interface TransaksiRingkas {
  total: Rupiah;
  jenisBayar: MetodeBayar;
  dibatalkan: boolean;
  waktu: string;
}

export interface RingkasanKeuangan {
  jumlahTransaksi: number;
  omzet: Rupiah;
  tunai: Rupiah;
  transfer: Rupiah;
  qris: Rupiah;
  tanpaMetode: Rupiah;
  totalBiaya: Rupiah;
  /** omzet − totalBiaya. Boleh negatif. */
  laba: Rupiah;
  biayaPerKategori: Array<{ kategori: KategoriBiaya; total: Rupiah }>;
}

/**
 * Menghitung omzet, biaya, dan laba.
 * Transaksi yang DIBATALKAN tidak dihitung sebagai omzet.
 */
export function hitungRingkasanKeuangan(
  transaksi: readonly TransaksiRingkas[],
  biaya: readonly BiayaRingkas[],
): RingkasanKeuangan {
  const sah = transaksi.filter((t) => !t.dibatalkan);

  let omzet = 0;
  let tunai = 0;
  let transfer = 0;
  let qris = 0;
  let tanpaMetode = 0;

  for (const t of sah) {
    omzet += t.total;
    switch (t.jenisBayar) {
      case "tunai":
        tunai += t.total;
        break;
      case "transfer":
        transfer += t.total;
        break;
      case "qris":
        qris += t.total;
        break;
      default:
        tanpaMetode += t.total;
    }
  }

  const perKategori = new Map<KategoriBiaya, number>();
  let totalBiaya = 0;
  for (const b of biaya) {
    totalBiaya += b.nominal;
    perKategori.set(b.kategori, (perKategori.get(b.kategori) ?? 0) + b.nominal);
  }

  return {
    jumlahTransaksi: sah.length,
    omzet,
    tunai,
    transfer,
    qris,
    tanpaMetode,
    totalBiaya,
    // Laba boleh negatif dan tidak boleh dibulatkan ke nol.
    laba: omzet - totalBiaya,
    biayaPerKategori: [...perKategori.entries()].map(([kategori, total]) => ({ kategori, total })),
  };
}

/** Hanya transaksi pada tanggal lokal tertentu ("YYYY-MM-DD"). */
export function transaksiPadaHari(transaksi: readonly TransaksiRingkas[], hari: string): TransaksiRingkas[] {
  return transaksi.filter((t) => t.waktu.slice(0, 10) === hari);
}

export function biayaPadaHari(biaya: readonly BiayaRingkas[], hari: string): BiayaRingkas[] {
  return biaya.filter((b) => b.tanggal === hari);
}

/* ------------------------------------------------- hitung ulang sisa */

export interface BarisHitungUlang {
  produkId: string;
  nama: string;
  /** Sisa menurut catatan sistem (dibawa − terjual − ditarik). */
  tercatat: number;
  /** Angka fisik yang diketik admin. */
  fisik: number;
}

export interface HasilHitungUlang {
  produkId: string;
  nama: string;
  tercatat: number;
  fisik: number;
  /** fisik − tercatat. Negatif = kurang, positif = lebih. */
  selisih: number;
  /** Yang dikembalikan ke gudang = fisik (bila tidak diubah admin). */
  dikembalikan: number;
}

export type HasilRekap =
  | { ok: true; baris: HasilHitungUlang[]; adaSelisih: boolean; totalSelisih: number }
  | { ok: false; pesan: string };

/**
 * Membandingkan hitungan fisik dengan catatan sistem.
 * Fisik tidak boleh negatif; selisih NEGATIF tidak boleh membuat pengembalian < 0.
 */
export function hitungUlangSisa(data: readonly BarisHitungUlang[]): HasilRekap {
  const baris: HasilHitungUlang[] = [];

  for (const b of data) {
    if (!Number.isInteger(b.fisik) || b.fisik < 0) {
      return { ok: false, pesan: `Perbaiki: hitungan ${b.nama} harus angka 0 atau lebih.` };
    }
    const selisih = b.fisik - b.tercatat;
    baris.push({
      produkId: b.produkId,
      nama: b.nama,
      tercatat: b.tercatat,
      fisik: b.fisik,
      selisih,
      // Yang kembali ke gudang adalah barang fisik yang benar-benar ada.
      dikembalikan: Math.max(0, b.fisik),
    });
  }

  const totalSelisih = baris.reduce((n, b) => n + Math.abs(b.selisih), 0);
  return {
    ok: true,
    baris,
    adaSelisih: baris.some((b) => b.selisih !== 0),
    totalSelisih,
  };
}

/** Pesan peringatan sebelum menutup bazar. */
export function pesanSelisih(hasil: HasilHitungUlang[]): string | null {
  const beda = hasil.filter((b) => b.selisih !== 0);
  if (beda.length === 0) return null;
  return `${beda.length} barang selisih. Periksa lagi sebelum menutup.`;
}
