/**
 * Jurnal turunan (BU-02, BU-06, BU-08) — fungsi MURNI, tanpa IndexedDB/React.
 *
 * Asas kunci:
 *  - `journal` satu-arah, merupakan TURUNAN/recompute dari dokumen, bukan ditulis manual.
 *  - Jurnal HANYA mencatat uang yang benar-benar bergerak (nominal diterima); piutang,
 *    total, dan sisa tagihan TIDAK masuk jurnal (BU-08.A).
 *  - Pemasukan (penjualan/dp/pelunasan) hanya lewat kasir; jurnal manual hanya untuk
 *    pengeluaran/titipan/ambil pribadi (BU-08.B).
 *
 * Semua nominal integer Rupiah. Tidak ada floating point.
 */
import type { Rupiah } from "./money.ts";
import type { JournalRecord, UUID } from "../db/schema.ts";

/**
 * Kategori jurnal bawaan (BU-06). Daftar deklaratif + dukungan "isi sendiri":
 * kategori kustom berupa string bebas yang pernah disimpan ikut ditawarkan kembali.
 */
export const KATEGORI_JURNAL = [
  "penjualan",
  "dp",
  "pelunasan",
  "biaya_bahan",
  "upah",
  "listrik",
  "lain_lain",
] as const;

export type KategoriBawaan = (typeof KATEGORI_JURNAL)[number];

/**
 * Kategori yang tersimpan. `string` (bukan union tertutup) karena mendukung
 * "isi sendiri" (BU-06): kategori kustom disimpan dan dipakai ulang, bukan
 * free-text setiap kali.
 */
export type KategoriJurnal = string;

/** True bila kategori adalah salah satu bawaan. */
export function isKategoriBawaan(kategori: KategoriJurnal): kategori is KategoriBawaan {
  return (KATEGORI_JURNAL as readonly string[]).includes(kategori);
}

/** Label tampilan kategori; bawaan diberi nama Indonesia, kustom ditampilkan apa adanya. */
export function labelKategori(kategori: KategoriJurnal): string {
  switch (kategori) {
    case "penjualan":
      return "Penjualan";
    case "dp":
      return "DP";
    case "pelunasan":
      return "Pelunasan";
    case "biaya_bahan":
      return "Biaya bahan";
    case "upah":
      return "Upah";
    case "listrik":
      return "Listrik";
    case "lain_lain":
      return "Lain-lain";
    default:
      return kategori;
  }
}

/**
 * Sisa tagihan = total − terbayar, tidak pernah negatif.
 * Bila terbayar melebihi total, sisa dipatok 0 (kelebihan itu kembalian, bukan sisa).
 */
export function hitungSisa(total: Rupiah, terbayar: Rupiah): Rupiah {
  const sisa = total - terbayar;
  return sisa > 0 ? sisa : 0;
}

/** Kembalian = kelebihan terbayar di atas total; 0 bila tidak ada kelebihan (BU-17.B). */
export function hitungKembalian(total: Rupiah, terbayar: Rupiah): Rupiah {
  const lebih = terbayar - total;
  return lebih > 0 ? lebih : 0;
}

/**
 * Baris jurnal turunan BELUM ber-`id` (id dibuat di lapisan penyimpanan, idempoten),
 * persis pola `PembayaranRecord` di `penjualan.ts` yang baru diberi `id` saat disimpan.
 */
export type BarisJurnalTurunan = Omit<JournalRecord, "id">;

/**
 * Membuat satu baris jurnal PEMASUKAN (uang diterima) dari pembayaran dokumen (BU-02).
 * Selalu `arah: "masuk"`, `pemilik: "usaha"`, `sumber: "usaha"` (BU-07: otomatis tidak
 * bisa diubah). `nominal` adalah uang yang benar-benar diterima — bukan total/sisa.
 */
export function buatBarisJurnalPembayaran(
  dokumenId: UUID,
  nominal: Rupiah,
  kategori: KategoriJurnal,
  waktu: string,
): BarisJurnalTurunan {
  return {
    arah: "masuk",
    kategori,
    nominal,
    waktu,
    dokumenId,
    pemilik: "usaha",
    sumber: "usaha",
    catatan: null,
  };
}

/** Bentuk minimal dokumen yang dibutuhkan jurnal turunan. */
export interface DokumenUntukJurnal {
  id: UUID;
  total: Rupiah;
}

/** Bentuk minimal satu baris pembayaran untuk jurnal turunan. */
export interface PembayaranUntukJurnal {
  nominal: Rupiah;
  waktu: string;
}

/**
 * Menghitung ulang (recompute) seluruh baris jurnal dari sebuah dokumen dan daftar
 * pembayarannya — MURNI, TIDAK menulis ke database (BU-02: jurnal = turunan).
 *
 * Satu pembayaran = satu baris "masuk". Kategori tiap baris ditentukan dari konteks:
 * "dp" selama terbayar belum mencapai total, "pelunasan" mulai saat total terlunasi
 * (termasuk saat bayar lebih). Total & sisa TIDAK pernah dicatat sebagai baris jurnal.
 */
export function recomputeJurnalDariDokumen(
  dokumen: DokumenUntukJurnal,
  payments: readonly PembayaranUntukJurnal[],
): BarisJurnalTurunan[] {
  const baris: BarisJurnalTurunan[] = [];
  let terbayar = 0;
  for (const p of payments) {
    terbayar += p.nominal;
    const kategori: KategoriJurnal = terbayar >= dokumen.total ? "pelunasan" : "dp";
    baris.push(buatBarisJurnalPembayaran(dokumen.id, p.nominal, kategori, p.waktu));
  }
  return baris;
}