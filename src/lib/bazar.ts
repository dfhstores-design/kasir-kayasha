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

/**
 * Metode bayar yang sah. Nilai lain (mis. data lama berisi string bebas)
 * dihitung sebagai tanpa metode — jangan sampai merusak hitungan per-metode.
 */
export function metodeBayarSah(metode: string | null): MetodeBayar {
  return metode === "tunai" || metode === "transfer" || metode === "qris" ? metode : null;
}

/** Satu baris pembayaran yang sudah diterima untuk sebuah transaksi. */
export interface PembayaranRingkas {
  nominal: Rupiah;
  metode: MetodeBayar;
  waktu: string;
}

export interface TransaksiRingkas {
  total: Rupiah;
  /**
   * Metode bayar TERAKHIR (hanya untuk label di riwayat). Perhitungan uang
   * per metode di hitungRingkasanKeuangan memakai `pembayaran`, BUKAN kolom
   * ini — pesanan yang dibayar bertahap (DP tunai + pelunasan transfer)
   * tidak boleh dibebankan penuh ke satu metode (F2, trial 21 Nov 2026).
   */
  jenisBayar: MetodeBayar;
  dibatalkan: boolean;
  waktu: string;
  /** Semua pembayaran yang sudah diterima untuk transaksi ini. */
  pembayaran: readonly PembayaranRingkas[];
}

export interface RingkasanKeuangan {
  jumlahTransaksi: number;
  /** Nilai pesanan (Σ total). Bisa lebih besar dari uangMasuk bila ada
   *  pesanan yang baru DP — omzet BUKAN uang di tangan kasir. */
  omzet: Rupiah;
  /** Uang yang benar-benar sudah diterima (Σ baris pembayaran).
   *  Inilah yang dipakai tutup harian: "uang tunai yang seharusnya ada
   *  di tangan kasir" dihitung dari pembayaran tunai di sini (BU-34). */
  uangMasuk: Rupiah;
  tunai: Rupiah;
  transfer: Rupiah;
  qris: Rupiah;
  tanpaMetode: Rupiah;
  /** Total DP yang dikembalikan karena pembatalan (F8/BU-63), sebagai
   *  angka positif. uangMasuk di atas SUDAH bersih dari pengembalian ini
   *  (diterima lalu dikembalikan = net 0) — baris ini hanya penjelasnya,
   *  supaya kasir/owner melihat kenapa uang masuk berkurang. */
  pengembalian: Rupiah;
  totalBiaya: Rupiah;
  /** omzet − totalBiaya. Boleh negatif. */
  laba: Rupiah;
  biayaPerKategori: Array<{ kategori: KategoriBiaya; total: Rupiah }>;
}

/**
 * Menghitung omzet, uang masuk, biaya, dan laba — dari baris PEMBAYARAN,
 * bukan dari total pesanan (F2, trial 21 Nov 2026).
 * - Omzet = Σ total pesanan (nilai pesanan, termasuk yang baru DP).
 * - Uang masuk & per-metode = Σ baris pembayaran (uang yang benar-benar
 *   diterima). Pesanan DP tunai + pelunasan transfer dihitung terpisah
 *   per metode, bukan dibebankan penuh ke metode terakhir.
 * - `hari` ("YYYY-MM-DD", opsional): bila diisi, yang dihitung sebagai
 *   uang masuk hari itu HANYA pembayaran bertanggal hari itu — jadi DP
 *   yang dibayar Senin dan pelunasannya Rabu tidak menumpuk di Senin,
 *   dan pengembalian DP yang dibatalkan Selasa muncul di Selasa, bukan
 *   di hari pesanan dibuat. Tanpa `hari`: hitung semua (tampilan total).
 * Transaksi yang DIBATALKAN tidak masuk omzet. Uangnya dihitung BILA
 * pembatalannya mengikuti BU-63 (ada baris pengembalian DP, F8): uang
 * yang diterima dan pengembaliannya saling meniadakan, jadi uang masuk
 * bersih. Transaksi batal TANPA baris pengembalian (data lama sebelum
 * BU-63, nasib DP tidak diketahui) tidak dihitung sama sekali.
 */
export function hitungRingkasanKeuangan(
  transaksi: readonly TransaksiRingkas[],
  biaya: readonly BiayaRingkas[],
  hari?: string,
): RingkasanKeuangan {
  const padaHari = (waktu: string) => hari === undefined || waktu.slice(0, 10) === hari;

  let jumlahTransaksi = 0;
  let omzet = 0;
  let uangMasuk = 0;
  let tunai = 0;
  let transfer = 0;
  let qris = 0;
  let tanpaMetode = 0;
  let pengembalian = 0;

  const tambahBayar = (p: PembayaranRingkas) => {
    uangMasuk += p.nominal;
    if (p.nominal < 0) pengembalian += -p.nominal;
    switch (p.metode) {
      case "tunai":
        tunai += p.nominal;
        break;
      case "transfer":
        transfer += p.nominal;
        break;
      case "qris":
        qris += p.nominal;
        break;
      default:
        tanpaMetode += p.nominal;
    }
  };

  for (const t of transaksi) {
    // Pesanan batal ikut alur BU-63 (ada baris pengembalian) → uangnya
    // dihitung apa adanya (diterima lalu dikembalikan = net 0). Pesanan
    // batal TANPA baris pengembalian (data lama) → uangnya tidak dihitung.
    const adaPengembalian = t.pembayaran.some((p) => p.nominal < 0);
    if (!t.dibatalkan) {
      if (padaHari(t.waktu)) {
        jumlahTransaksi += 1;
        omzet += t.total;
      }
      for (const p of t.pembayaran) {
        if (padaHari(p.waktu)) tambahBayar(p);
      }
    } else if (adaPengembalian) {
      for (const p of t.pembayaran) {
        if (padaHari(p.waktu)) tambahBayar(p);
      }
    }
  }

  const perKategori = new Map<KategoriBiaya, number>();
  let totalBiaya = 0;
  for (const b of biaya) {
    totalBiaya += b.nominal;
    perKategori.set(b.kategori, (perKategori.get(b.kategori) ?? 0) + b.nominal);
  }

  return {
    jumlahTransaksi,
    omzet,
    uangMasuk,
    tunai,
    transfer,
    qris,
    tanpaMetode,
    pengembalian,
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
