/**
 * Tes Ringkasan (F7, tes klik 22 Nov 2026): sesudah satu penjualan
 * dibatalkan, ringkasan harus tetap menunjukkan angka yang benar TANPA
 * reload — bukan nol semua + "Belum ada data ringkasan."
 *
 * Akar masalah F7: muat yang gagal disamarkan jadi "tidak ada data"
 * (catch diam-diam → state kosong). Perbaikannya di layar (panel galat +
 * "Coba lagi" bila muat gagal); tes ini mengunci sisi datanya: muat
 * sesudah batal harus mengembalikan angka yang benar.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import Ringkasan, { muatDataRingkasan } from "./Ringkasan.tsx";
import { resetKoneksiDB, type ProdukRecord } from "../db/schema.ts";
import { simpanProduk } from "../db/repositori.ts";
import { batalkanTransaksi } from "../db/pesananOperasi.ts";
import { simpanPenjualan, type ItemPilihan, type RencanaPenjualan } from "../lib/penjualan.ts";
import { hitungRingkasanKeuangan, metodeBayarSah } from "../lib/bazar.ts";
import { tanggalHariIni } from "../lib/tanggal.ts";

function resetDB() {
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  resetKoneksiDB();
}

async function produkBaru(nama: string, hargaJual: number, stokGudang: number): Promise<ProdukRecord> {
  const now = new Date().toISOString();
  const p: ProdukRecord = {
    id: crypto.randomUUID(),
    nama,
    kode: null,
    hargaJual,
    stokGudang,
    catatan: null,
    arsip: false,
    createdAt: now,
    updatedAt: now,
  };
  await simpanProduk(p);
  return p;
}

function rencanaJual(p: ProdukRecord, kuantitas: number, jenisBayar: "tunai" | "transfer" | "qris"): RencanaPenjualan {
  const item: ItemPilihan = { produkId: p.id, nama: p.nama, hargaSatuan: p.hargaJual, kuantitas, diskonPerUnit: 0 };
  return {
    items: [item],
    diskonTotal: 0,
    ongkir: { mode: "ambil_sendiri", nominal: 0 },
    jenisBayar,
    statusBayar: "lunas",
    dibayarSekarang: 0,
    bazarId: null,
  };
}

async function siapkanDuaPenjualanSatuBatal(): Promise<void> {
  const blus = await produkBaru("Blus Linen", 180000, 10);
  const rok = await produkBaru("Rok Batik", 150000, 10);
  const satu = await simpanPenjualan(rencanaJual(blus, 1, "tunai"), { rekening: [] });
  const dua = await simpanPenjualan(rencanaJual(rok, 1, "qris"), { rekening: [] });
  if (!satu.ok || !dua.ok) throw new Error("gagal membuat penjualan");
  // Batalkan penjualan tunai — persis skenario F7 (08:34).
  expect((await batalkanTransaksi(satu.transaksi.id, "Pelanggan membatalkan")).ok).toBe(true);
}

describe("Ringkasan (F7)", () => {
  beforeEach(resetDB);
  afterEach(cleanup);

  it("data: muatDataRingkasan sesudah batal mengembalikan angka benar (bukan nol)", async () => {
    await siapkanDuaPenjualanSatuBatal();
    const data = await muatDataRingkasan(null);
    expect(data.trx).toHaveLength(2);

    // Pemetaan yang sama seperti yang dipakai layar Ringkasan.
    const daftarTrx = data.trx.map((t) => ({
      total: t.total,
      jenisBayar: t.jenisBayar,
      dibatalkan: t.dibatalkanPada !== null,
      waktu: t.waktu,
      jenisDokumen: t.jenisDokumen,
      pembayaran: (data.bayarPerTrx.get(t.id) ?? []).map((p) => ({
        nominal: p.nominal,
        metode: metodeBayarSah(p.metode),
        waktu: p.waktu,
      })),
    }));
    const harian = hitungRingkasanKeuangan(daftarTrx, [], tanggalHariIni());
    // Hanya penjualan QRIS yang masih jalan; tunai kembali sebagai pengembalian.
    expect(harian.jumlahTransaksi).toBe(1);
    expect(harian.omzet).toBe(150000);
    expect(harian.uangMasuk).toBe(150000);
    expect(harian.qris).toBe(150000);
    expect(harian.tunai).toBe(0);
    expect(harian.pengembalianBatal).toBe(180000);
  });

  it("layar: sesudah batal, ringkasan menampilkan angka benar — bukan 'Belum ada data'", async () => {
    await siapkanDuaPenjualanSatuBatal();
    render(<Ringkasan bazar={null} />);
    await waitFor(() => expect(screen.getByText("Uang masuk hari itu")).toBeTruthy());
    // "Rp 150.000" muncul di beberapa baris (uang masuk harian + total +
    // QRIS + riwayat) — yang penting angkanya ada, bukan nol.
    expect(screen.getAllByText("Rp 150.000").length).toBeGreaterThan(0);
    expect(screen.queryByText("Belum ada data ringkasan.")).toBeNull();
    expect(screen.getByText("Pengembalian penjualan batal hari itu")).toBeTruthy();
  });
});
