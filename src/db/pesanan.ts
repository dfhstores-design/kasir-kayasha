/**
 * Persistensi pre-order (Phase 4).
 *
 * Berbeda dari `simpanPenjualan` (Phase 3):
 *  - PO **TIDAK** mengurangi stok saat dibuat (`stokBaru: []`).
 *  - Stok baru berkurang ketika pesanan berubah status ke **selesai**.
 *  - Pembatalan TIDAK menghapus pembayaran; hanya menandai.
 */
import { buatId, daftarTransaksi, simpanTransaksi } from "./repositori.ts";
import type { ItemTransaksiRecord, PembayaranRecord, Rekening, TransaksiRecord } from "./schema.ts";
import type { Rupiah } from "../lib/money.ts";
import { sapaanDariWaktu } from "../lib/sapaan.ts";
import { sumberStokUntuk } from "../lib/sumberStok.ts";
import {
  periksaRencanaPO,
  transisiSah,
  type RencanaPO,
  type StatusPesanan,
} from "../lib/pesanan.ts";


export interface POTersimpan {
  id: string;
  nomorResi: string;
  total: Rupiah;
  sisa: Rupiah;
  namaPemesan: string;
}

export type HasilSimpanPO = { ok: true; pesanan: POTersimpan } | { ok: false; pesan: string };

/** Nomor PO mudah dibaca: KYS-PO-0001. */
export function formatNomorPO(urut: number): string {
  return `KYS-PO-${String(urut).padStart(4, "0")}`;
}

/** Menyimpan PO baru. Stok TIDAK berubah. */
export async function simpanPO(
  rencana: RencanaPO,
  konteks: { rekening: readonly Rekening[]; waktu?: Date },
): Promise<HasilSimpanPO> {
  const cek = periksaRencanaPO(rencana);
  if (!cek.ok) return { ok: false, pesan: cek.pesan };

  const waktu = konteks.waktu ?? new Date();
  const id = buatId();
  const hari = waktu.toISOString().slice(0, 10);

  const semua = await daftarTransaksi();
  const urutPO = semua.filter((t) => t.jenis === "po").length + 1;

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

  const pembayaran: PembayaranRecord[] =
    cek.sudahDibayar > 0
      ? [
          {
            id: buatId(),
            transaksiId: id,
            nominal: cek.sudahDibayar,
            waktu: waktu.toISOString(),
            metode: rencana.jenisBayar,
            catatan: "DP",
          },
        ]
      : [];

  const subtotalAwal = rencana.items.reduce((n, i) => n + i.hargaSatuan * i.kuantitas, 0);
  const diskonItem = rencana.items.reduce((n, i) => n + i.diskonPerUnit * i.kuantitas, 0);

  const trx: TransaksiRecord = {
    id,
    nomorResi: formatNomorPO(urutPO),
    nomorUrutHari: semua.filter((t) => t.waktu.slice(0, 10) === hari).length + 1,
    waktu: waktu.toISOString(),
    jenis: "po",
    statusPesanan: "diproses",
    bazarId: rencana.bazarId,
    namaPemesan: rencana.namaPemesan.trim(),
    kontak: rencana.kontak?.trim() || null,
    perkiraanSiap: rencana.perkiraanSiap || null,
    alamat: rencana.alamat?.trim() || null,
    catatanPesanan: rencana.catatan?.trim() || null,
    riwayatTotal: [],
    ongkirMode: rencana.ongkir.mode,
    ongkirNominal: rencana.ongkir.nominal,
    subtotalAwal,
    diskonItem,
    diskonTotal: rencana.diskonTotal,
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
    // stokBaru kosong: PO tidak mengurangi stok.
    await simpanTransaksi(trx, items, pembayaran, []);
  } catch (e) {
    return { ok: false, pesan: e instanceof Error ? e.message : "Pesanan belum tersimpan." };
  }

  return {
    ok: true,
    pesanan: { id, nomorResi: trx.nomorResi, total: cek.total, sisa: cek.sisa, namaPemesan: trx.namaPemesan ?? "" },
  };
}

/** Memastikan transisi status sah sebelum menulis. */
export function cekTransisi(dari: StatusPesanan, ke: StatusPesanan): boolean {
  return transisiSah(dari, ke);
}

/**
 * Sumber stok saat PO diselesaikan: memakai bazar bila PO milik bazar,
 * selain itu gudang. Dipakai `selesaikanPO`.
 */
export function sumberStokSelesaiPO(
  trx: TransaksiRecord,
  item: ReadonlyArray<{ produkId: string; kuantitas: number }>,
) {
  return sumberStokUntuk(
    item.filter((i) => i.produkId).map((i) => ({ produkId: i.produkId, kuantitas: i.kuantitas })),
    trx.bazarId,
  );
}
