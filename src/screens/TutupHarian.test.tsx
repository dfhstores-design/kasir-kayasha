/**
 * Tes layar Tutup Harian kasir (Fase 2C, BU-34): kasir melihat uang tunai
 * yang seharusnya ada di tangan, dari baris pembayaran (F2).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { cleanup, render, screen } from "@testing-library/react";
import TutupHarian from "./TutupHarian.tsx";
import {
  alokasikanKeBazar,
  buatBazar,
  simpanProduk,
  simpanTransaksi,
  type BazarRecord,
  type ProdukRecord,
} from "../db/repositori.ts";
import { resetKoneksiDB } from "../db/schema.ts";
import { sumberStokUntuk } from "../lib/sumberStok.ts";
import { sapaanDariWaktu } from "../lib/sapaan.ts";

function resetDB() {
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  resetKoneksiDB();
}

async function produkBaru(nama: string, stok: number): Promise<ProdukRecord> {
  const now = new Date().toISOString();
  const p: ProdukRecord = {
    id: crypto.randomUUID(),
    nama,
    kode: null,
    hargaJual: 100000,
    stokGudang: stok,
    catatan: null,
    arsip: false,
    createdAt: now,
    updatedAt: now,
  };
  await simpanProduk(p);
  return p;
}

function trxJual(id: string, bazarId: string | null, total: number, metode: "tunai" | "transfer" | "qris") {
  const now = new Date();
  return {
    trx: {
      id,
      nomorResi: `KYS-${id.slice(0, 4)}`,
      nomorUrutHari: 1,
      waktu: now.toISOString(),
      jenis: "langsung" as const,
      jenisDokumen: "penjualan" as const,
      arahStok: "keluar" as const,
      pelangganId: null,
      statusPesanan: "selesai" as const,
      bazarId,
      namaPemesan: null,
      kontak: null,
      perkiraanSiap: null,
      alamat: null,
      catatanPesanan: null,
      riwayatTotal: [],
      ongkirMode: "ambil_sendiri" as const,
      ongkirNominal: 0,
      subtotalAwal: total,
      diskonItem: 0,
      diskonTotal: 0,
      total,
      sapaan: sapaanDariWaktu(now),
      rekeningSnapshot: [],
      jenisBayar: metode,
      statusBayar: "lunas" as const,
      dibatalkanPada: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    bayar: {
      id: crypto.randomUUID(),
      transaksiId: id,
      nominal: total,
      waktu: now.toISOString(),
      metode,
      catatan: null,
    },
  };
}

describe("TutupHarian — uang tunai di tangan kasir (Fase 2C, BU-34)", () => {
  beforeEach(resetDB);
  afterEach(cleanup);

  it("kasir bazar melihat tunai hari ini dari baris pembayaran, hanya untuk bazarnya", async () => {
    const p = await produkBaru("Blus", 40);
    const b: BazarRecord = await buatBazar("Pameran", null, null);
    await alokasikanKeBazar(b.id, p.id, 10);
    const jualBazar = trxJual(crypto.randomUUID(), b.id, 150000, "tunai");
    await simpanTransaksi(jualBazar.trx, [], [jualBazar.bayar], sumberStokUntuk([{ produkId: p.id, kuantitas: 1 }], b.id));
    // Penjualan toko (bazarId null) TIDAK boleh masuk hitungan kasir bazar.
    const jualToko = trxJual(crypto.randomUUID(), null, 999000, "tunai");
    await simpanTransaksi(jualToko.trx, [], [jualToko.bayar], sumberStokUntuk([{ produkId: p.id, kuantitas: 1 }], null));

    render(<TutupHarian bazarId={b.id} label="Pameran" />);
    expect(await screen.findByText("Tutup Harian — Pameran")).toBeTruthy();
    expect(await screen.findByText("Uang tunai di tangan")).toBeTruthy();
    // "Rp 150.000" muncul 2x: uang masuk hari ini + uang tunai di tangan.
    expect(await screen.findByText("Uang tunai di tangan")).toBeTruthy();
    expect(screen.getAllByText("Rp 150.000")).toHaveLength(2);
    expect(screen.queryByText("Rp 999.000")).toBeNull();
  });

  it("DP tunai + pelunasan transfer dihitung terpisah per metode (F2)", async () => {
    const p = await produkBaru("Blus", 40);
    const b: BazarRecord = await buatBazar("Pameran", null, null);
    await alokasikanKeBazar(b.id, p.id, 10);
    const now = new Date();
    const t = trxJual(crypto.randomUUID(), b.id, 500000, "tunai");
    // Total 500rb, tapi yang diterima: DP tunai 200rb + pelunasan transfer 300rb.
    const bayar = [
      { id: crypto.randomUUID(), transaksiId: t.trx.id, nominal: 200000, waktu: now.toISOString(), metode: "tunai" as const, catatan: null },
      { id: crypto.randomUUID(), transaksiId: t.trx.id, nominal: 300000, waktu: now.toISOString(), metode: "transfer" as const, catatan: null },
    ];
    await simpanTransaksi(
      { ...t.trx, jenisDokumen: "jasa" as const, statusBayar: "lunas" as const },
      [],
      bayar,
      sumberStokUntuk([{ produkId: p.id, kuantitas: 1 }], b.id),
    );

    render(<TutupHarian bazarId={b.id} label="Pameran" />);
    expect(await screen.findByText("Rp 200.000")).toBeTruthy();
    expect(await screen.findByText("Rp 300.000")).toBeTruthy();
    expect(await screen.findByText("Rp 500.000")).toBeTruthy();
  });

  it("tanpa transaksi hari ini menampilkan angka nol", async () => {
    render(<TutupHarian bazarId={null} label="Toko" />);
    expect(await screen.findByText("Tutup Harian — Toko")).toBeTruthy();
    // Uang masuk, tunai, transfer, QRIS semuanya Rp 0.
    expect(screen.getAllByText("Rp 0")).toHaveLength(4);
  });
});
