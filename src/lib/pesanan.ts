/**
 * Operasi pesanan yang sudah ada: pembayaran, ongkir menyusul, status,
 * dan pembatalan — dipakai `db/pesananOperasi.ts` (dan Resi untuk
 * menampilkan pesanan lama, termasuk pesanan jahit).
 *
 * DULU file ini juga memuat pembuatan pre-order barang (PO: RencanaPO,
 * periksaRencanaPO, simpanPO di `db/pesanan.ts`, dan layar Pesanan /
 * FormPesanan / DetailPesanan). Fitur PO barang DIHAPUS TOTAL 18 Nov 2026
 * (Andri: "Pesanan" = barang custom = pesanan jahit; tidak ada pesanan
 * dari barang stok). Yang tersisa di sini hanya helper generik yang masih
 * dipakai operasi pesanan lama.
 *
 * Aturan kunci:
 * 1. Status pembayaran (lunas/dp/belum_dibayar) TERPISAH dari status pesanan
 *    (diproses/siap/selesai/dibatalkan).
 * 2. Ongkir "belum ditentukan" boleh diisi kemudian; total dihitung ulang dan
 *    setiap perubahan TOTAL dicatat sebagai riwayat (audit).
 * 3. Pembatalan TIDAK menghapus pembayaran.
 *
 * Fungsi di sini murni (tanpa IndexedDB) kecuali dinyatakan lain.
 */
import type { Rupiah } from "./money.ts";
import type { Ongkir } from "./ongkir.ts";
import { hitungPembayaran, type StatusBayar } from "./keranjang.ts";
import { ongkirDitagihkanButik } from "./ongkir.ts";

export type StatusPesanan = "diproses" | "siap" | "selesai" | "dibatalkan";

export function labelStatusPesanan(s: StatusPesanan): string {
  switch (s) {
    case "diproses":
      return "Diproses";
    case "siap":
      return "Siap diambil atau dikirim";
    case "selesai":
      return "Selesai";
    case "dibatalkan":
      return "Dibatalkan";
  }
}

/* ------------------------------------------------------- pembayaran */

export type HasilPembayaran =
  | { ok: true; sudahDibayar: Rupiah; sisa: Rupiah; status: StatusBayar }
  | { ok: false; pesan: string };

/**
 * Menghitung efek pencatatan pembayaran baru.
 * Pembayaran melebihi sisa DITOLAK (tidak dikoreksi diam-diam).
 */
export function hitungPembayaranBaru(
  total: Rupiah,
  pembayaranSebelum: readonly Rupiah[],
  nominalBaru: Rupiah,
): HasilPembayaran {
  if (!Number.isInteger(nominalBaru) || nominalBaru <= 0) {
    return { ok: false, pesan: "Nominal harus lebih dari 0." };
  }
  const sebelum = hitungPembayaran(total, pembayaranSebelum);
  if (!sebelum.ok) return { ok: false, pesan: "Ada pembayaran yang melebihi total." };

  const sisa = sebelum.ringkasan.sisa;
  if (nominalBaru > sisa) {
    return { ok: false, pesan: `Nominal melebihi sisa tagihan Rp ${sisa.toLocaleString("id-ID")}.` };
  }

  const sesudah = hitungPembayaran(total, [...pembayaranSebelum, nominalBaru]);
  if (!sesudah.ok) return { ok: false, pesan: "Nominal melebihi total." };

  return {
    ok: true,
    sudahDibayar: sesudah.ringkasan.sudahDibayar,
    sisa: sesudah.ringkasan.sisa,
    status: sesudah.ringkasan.status,
  };
}

/* --------------------------------------------- ongkir menyusul */

export interface CatatanPerubahanTotal {
  waktu: string;
  totalLama: Rupiah;
  totalBaru: Rupiah;
  alasan: string;
}

export type HasilIsiOngkir =
  | {
      ok: true;
      totalBaru: Rupiah;
      ongkirDitagihkan: Rupiah;
      statusBerubah: boolean;
      status: StatusBayar;
      sisa: Rupiah;
      catatan: CatatanPerubahanTotal;
    }
  | { ok: false; pesan: string };

/**
 * Mengisi ongkir yang tadinya "belum ditentukan".
 * Total dihitung ulang; bila sebelumnya LUNAS, status kembali menjadi DP.
 * Setiap perubahan total WAJIB dikembalikan sebagai catatan riwayat.
 */
export function hitungIsiOngkir(
  args: {
    subtotalAwal: Rupiah;
    diskonItem: Rupiah;
    diskonTotal: Rupiah;
    totalSekarang: Rupiah;
    ongkirBaru: Ongkir;
    pembayaran: readonly Rupiah[];
    statusSekarang: StatusBayar;
  },
  waktuIso: string,
): HasilIsiOngkir {
  const { subtotalAwal, diskonItem, diskonTotal, totalSekarang, ongkirBaru, pembayaran, statusSekarang } = args;

  if (ongkirBaru.mode === "belum_ditentukan") {
    return { ok: false, pesan: "Isi nominal atau pilih cara ongkir." };
  }

  const ongkirDitagihkan = ongkirDitagihkanButik(ongkirBaru);
  const totalBaru = subtotalAwal - diskonItem - diskonTotal + ongkirDitagihkan;

  if (totalBaru < 0) return { ok: false, pesan: "Total tidak boleh negatif." };

  const bayar = hitungPembayaran(totalBaru, pembayaran);
  if (!bayar.ok) {
    return { ok: false, pesan: "Pembayaran yang sudah ada melebihi total baru." };
  }

  return {
    ok: true,
    totalBaru,
    ongkirDitagihkan,
    statusBerubah: bayar.ringkasan.status !== statusSekarang,
    status: bayar.ringkasan.status,
    sisa: bayar.ringkasan.sisa,
    catatan: {
      waktu: waktuIso,
      totalLama: totalSekarang,
      totalBaru,
      alasan: ongkirDitagihkan > 0 ? `ongkir Rp${ongkirDitagihkan.toLocaleString("id-ID")}` : "ongkir diperbarui",
    },
  };
}

/** Teks riwayat total, contoh: "Total diubah 12 Nov: Rp 850.000 → Rp 875.000 (ongkir Rp 25.000)". */
export function formatCatatanPerubahanTotal(c: CatatanPerubahanTotal): string {
  const f = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;
  return `Total diubah: ${f(c.totalLama)} → ${f(c.totalBaru)} (${c.alasan})`;
}

/* ------------------------------------------------------ pembatalan */

/** Transisi status pesanan yang diizinkan. */
export function transisiSah(dari: StatusPesanan, ke: StatusPesanan): boolean {
  if (dari === ke) return false;
  // Status final: tidak bisa berubah lagi.
  if (dari === "dibatalkan" || dari === "selesai") return false;
  if (ke === "dibatalkan") return true;
  if (dari === "diproses") return ke === "siap";
  if (dari === "siap") return ke === "selesai" || ke === "diproses";
  return false;
}

/** Pesan konfirmasi pembatalan. Pembayaran TIDAK dihapus. */
export function pesanKonfirmasiBatal(nomor: string): string {
  return `Batalkan pesanan ${nomor}? Riwayat pembayaran tetap disimpan.`;
}

/** Pesanan yang dibatalkan menyisakan sisa tagihan tetapi tidak boleh ditagih lagi. */
export function masihBisaDitagih(statusPesanan: StatusPesanan): boolean {
  return statusPesanan !== "dibatalkan";
}
