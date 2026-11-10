/**
 * Menyusun & menyimpan transaksi penjualan langsung (Phase 3).
 *
 * Satu tempat yang memegang urutan:
 *   1. hitung keranjang  → validasi diskon/ongkir
 *   2. hitung pembayaran → validasi status bayar
 *   3. susun snapshot (nama, harga, rekening, sapaan, nomor resi)
 *   4. pilih sumber stok (gudang/bazar) lewat aturan Phase 2B
 *   5. tulis ke IndexedDB dalam satu transaksi DB
 *
 * Fungsi hitung & susun di sini MURNI; hanya `simpanPenjualan` yang menyentuh database.
 */
import type { Rupiah } from "./money.ts";
import type { Ongkir } from "./ongkir.ts";
import { hitungKeranjang, hitungPembayaran, type BarisKeranjang, type StatusBayar } from "./keranjang.ts";
import { sapaanDariWaktu, type Sapaan } from "./sapaan.ts";
import { sumberStokUntuk } from "./sumberStok.ts";
import {
  buatId,
  daftarTransaksi,
  simpanTransaksi,
} from "../db/repositori.ts";
import type { ItemTransaksiRecord, PembayaranRecord, Rekening, TransaksiRecord, UUID } from "../db/schema.ts";

export type JenisBayar = "tunai" | "transfer" | "qris";

export const JENIS_BAYAR: readonly JenisBayar[] = ["tunai", "transfer", "qris"] as const;

export function labelJenisBayar(j: JenisBayar): string {
  switch (j) {
    case "tunai":
      return "Tunai";
    case "transfer":
      return "Transfer";
    case "qris":
      return "QRIS";
  }
}

export interface ItemPilihan {
  produkId: UUID;
  nama: string;
  hargaSatuan: Rupiah;
  kuantitas: number;
  diskonPerUnit: Rupiah;
}

export interface RencanaPenjualan {
  items: readonly ItemPilihan[];
  diskonTotal: Rupiah;
  ongkir: Ongkir;
  jenisBayar: JenisBayar | null;
  statusBayar: StatusBayar;
  /** Nominal yang benar-benar diterima sekarang (hanya untuk DP/belum dibayar). */
  dibayarSekarang: Rupiah;
  bazarId: UUID | null;
}

export type HasilRencana =
  | {
      ok: true;
      total: Rupiah;
      subtotalAwal: Rupiah;
      diskonItem: Rupiah;
      diskonTotal: Rupiah;
      ongkirDitagihkan: Rupiah;
      sudahDibayar: Rupiah;
      sisa: Rupiah;
      status: StatusBayar;
      totalBelumTermasukOngkir: boolean;
    }
  | { ok: false; pesan: string };

/** Memeriksa rencana sebelum disimpan; pesan dalam Bahasa Indonesia. */
export function periksaRencana(rencana: RencanaPenjualan): HasilRencana {
  if (rencana.items.length === 0) {
    return { ok: false, pesan: "Keranjang belum ada barang." };
  }

  const baris: BarisKeranjang[] = rencana.items.map((i) => ({
    nama: i.nama,
    hargaSatuan: i.hargaSatuan,
    kuantitas: i.kuantitas,
    diskonPerUnit: i.diskonPerUnit,
  }));

  const hasil = hitungKeranjang(baris, rencana.diskonTotal, rencana.ongkir);
  if (!hasil.ok) {
    switch (hasil.error.kode) {
      case "diskon_melebihi_harga":
        return {
          ok: false,
          pesan: `Diskon tidak boleh lebih dari harga ${rencana.items[hasil.error.index]?.nama ?? "barang"}.`,
        };
      case "diskon_total_melebihi_subtotal":
        return { ok: false, pesan: "Diskon total melebihi sisa subtotal." };
      case "kuantitas_tidak_valid":
        return { ok: false, pesan: "Jumlah barang harus minimal 1." };
      case "diskon_total_negatif":
        return { ok: false, pesan: "Diskon tidak boleh negatif." };
      case "harga_negatif":
        return { ok: false, pesan: "Harga tidak boleh negatif." };
      case "total_negatif":
        return { ok: false, pesan: "Total tidak boleh negatif." };
    }
  }

  const r = hasil.ringkasan;

  // Pembayaran sesuai status yang dipilih.
  const pembayaran =
    rencana.statusBayar === "lunas" ? [r.total] : rencana.statusBayar === "belum_dibayar" ? [] : [rencana.dibayarSekarang];

  const bayar = hitungPembayaran(r.total, pembayaran);
  if (!bayar.ok) {
    return { ok: false, pesan: "Nominal melebihi total." };
  }

  if (rencana.statusBayar === "dp" && (rencana.dibayarSekarang <= 0 || rencana.dibayarSekarang >= r.total)) {
    return { ok: false, pesan: "DP harus lebih dari 0 dan kurang dari total." };
  }

  return {
    ok: true,
    total: r.total,
    subtotalAwal: r.subtotalAwal,
    diskonItem: r.diskonItem,
    diskonTotal: r.diskonTotal,
    ongkirDitagihkan: r.ongkirDitagihkan,
    sudahDibayar: bayar.ringkasan.sudahDibayar,
    sisa: bayar.ringkasan.sisa,
    status: bayar.ringkasan.status,
    totalBelumTermasukOngkir: r.totalBelumTermasukOngkir,
  };
}

/** Nomor resi mudah dibaca: KYS-0001, berurutan per perangkat. */
export function formatNomorResi(urut: number): string {
  return `KYS-${String(urut).padStart(4, "0")}`;
}

/** Nomor urut = jumlah transaksi yang sudah ada + 1. */
export function nomorUrutBerikutnya(jumlahTransaksi: number): number {
  return jumlahTransaksi + 1;
}

export interface TransaksiTersimpan {
  id: UUID;
  nomorResi: string;
  nomorUrutHari: number;
  total: Rupiah;
  sisa: Rupiah;
  status: StatusBayar;
  sapaan: Sapaan;
  namaBarang: string[];
}

export type HasilSimpan =
  | { ok: true; transaksi: TransaksiTersimpan }
  | { ok: false; pesan: string };

/**
 * Menyimpan penjualan langsung. Idempoten: `id` dibuat sekali di sini, jadi
 * menekan "Simpan" dua kali tidak akan membuat dua transaksi asalkan pemanggil
 * memakai id yang sama (UI menonaktifkan tombol saat menyimpan).
 */
export async function simpanPenjualan(
  rencana: RencanaPenjualan,
  konteks: { rekening: readonly Rekening[]; waktu?: Date; idTransaksi?: UUID },
): Promise<HasilSimpan> {
  const cek = periksaRencana(rencana);
  if (!cek.ok) return { ok: false, pesan: cek.pesan };

  const waktu = konteks.waktu ?? new Date();
  const id = konteks.idTransaksi ?? buatId();
  const hari = waktu.toISOString().slice(0, 10);

  const semua = await daftarTransaksi();
  const urutHariIni = semua.filter((t) => t.waktu.slice(0, 10) === hari).length + 1;

  const pembayaran: PembayaranRecord[] =
    cek.sudahDibayar > 0
      ? [
          {
            id: buatId(),
            transaksiId: id,
            nominal: cek.sudahDibayar,
            waktu: waktu.toISOString(),
            metode: rencana.jenisBayar,
            catatan: null,
          },
        ]
      : [];

  const items: ItemTransaksiRecord[] = rencana.items.map((i) => ({
    id: buatId(),
    transaksiId: id,
    produkId: i.produkId,
    namaSnapshot: i.nama,
    hargaSatuan: i.hargaSatuan,
    kuantitas: i.kuantitas,
    diskonPerUnit: i.diskonPerUnit,
    subtotalBersih: i.hargaSatuan * i.kuantitas - i.diskonPerUnit * i.kuantitas,
  }));

  const trx: TransaksiRecord = {
    id,
    nomorResi: formatNomorResi(nomorUrutBerikutnya(semua.length)),
    nomorUrutHari: urutHariIni,
    waktu: waktu.toISOString(),
    jenis: "langsung",
    statusPesanan: "selesai",
    bazarId: rencana.bazarId,
    namaPemesan: null,
    kontak: null,
    perkiraanSiap: null,
    alamat: null,
    catatanPesanan: null,
    riwayatTotal: [],
    ongkirMode: rencana.ongkir.mode,
    ongkirNominal: rencana.ongkir.nominal,
    subtotalAwal: cek.subtotalAwal,
    diskonItem: cek.diskonItem,
    diskonTotal: cek.diskonTotal,
    total: cek.total,
    sapaan: sapaanDariWaktu(waktu),
    rekeningSnapshot: [...konteks.rekening],
    jenisBayar: rencana.jenisBayar,
    statusBayar: cek.status,
    dibatalkanPada: null,
    createdAt: waktu.toISOString(),
    updatedAt: waktu.toISOString(),
  };

  try {
    await simpanTransaksi(
      trx,
      items,
      pembayaran,
      sumberStokUntuk(
        rencana.items.map((i) => ({ produkId: i.produkId, kuantitas: i.kuantitas })),
        rencana.bazarId,
      ),
    );
  } catch (e) {
    return { ok: false, pesan: e instanceof Error ? e.message : "Transaksi belum tersimpan." };
  }

  return {
    ok: true,
    transaksi: {
      id,
      nomorResi: trx.nomorResi,
      nomorUrutHari: urutHariIni,
      total: cek.total,
      sisa: cek.sisa,
      status: cek.status,
      sapaan: trx.sapaan,
      namaBarang: rencana.items.map((i) => i.nama),
    },
  };
}
