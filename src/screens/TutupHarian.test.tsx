/**
 * Tes layar Tutup Harian kasir (Fase 2C, BU-34): kasir melihat uang tunai
 * yang seharusnya ada di tangan, dari baris pembayaran (F2).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import TutupHarian from "./TutupHarian.tsx";
import {
  alokasikanKeBazar,
  ambilTutupHarian,
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

    render(<TutupHarian bazarId={b.id} label="Pameran" peran="kasir" />);
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

    render(<TutupHarian bazarId={b.id} label="Pameran" peran="kasir" />);
    expect(await screen.findByText("Rp 200.000")).toBeTruthy();
    expect(await screen.findByText("Rp 300.000")).toBeTruthy();
    expect(await screen.findByText("Rp 500.000")).toBeTruthy();
  });

  it("tanpa transaksi hari ini menampilkan angka nol", async () => {
    render(<TutupHarian bazarId={null} label="Toko" peran="kasir" />);
    expect(await screen.findByText("Tutup Harian — Toko")).toBeTruthy();
    // Uang masuk, tunai, transfer, QRIS semuanya Rp 0.
    expect(screen.getAllByText("Rp 0")).toHaveLength(4);
  });

  it("(b) pengembalian dipisah: DP pesanan jahit vs penjualan batal", async () => {
    const p = await produkBaru("Blus", 40);
    const now = new Date();
    // Pesanan jahit batal: DP tunai 150rb dikembalikan.
    const jahit = trxJual(crypto.randomUUID(), null, 400000, "tunai");
    await simpanTransaksi(
      { ...jahit.trx, jenisDokumen: "jasa" as const, dibatalkanPada: now.toISOString() },
      [],
      [
        { id: crypto.randomUUID(), transaksiId: jahit.trx.id, nominal: 150000, waktu: now.toISOString(), metode: "tunai" as const, catatan: null },
        { id: crypto.randomUUID(), transaksiId: jahit.trx.id, nominal: -150000, waktu: now.toISOString(), metode: "tunai" as const, catatan: null },
      ],
      sumberStokUntuk([{ produkId: p.id, kuantitas: 1 }], null),
    );
    // Penjualan barang batal: 180rb dikembalikan.
    const jual = trxJual(crypto.randomUUID(), null, 180000, "tunai");
    await simpanTransaksi(
      { ...jual.trx, dibatalkanPada: now.toISOString() },
      [],
      [
        { id: crypto.randomUUID(), transaksiId: jual.trx.id, nominal: 180000, waktu: now.toISOString(), metode: "tunai" as const, catatan: null },
        { id: crypto.randomUUID(), transaksiId: jual.trx.id, nominal: -180000, waktu: now.toISOString(), metode: "tunai" as const, catatan: null },
      ],
      sumberStokUntuk([{ produkId: p.id, kuantitas: 1 }], null),
    );

    render(<TutupHarian bazarId={null} label="Toko" peran="kasir" />);
    expect(await screen.findByText("Pengembalian DP (pesanan jahit) hari ini")).toBeTruthy();
    expect(await screen.findByText("Pengembalian penjualan batal hari ini")).toBeTruthy();
    expect(await screen.findByText("− Rp 150.000")).toBeTruthy();
    expect(await screen.findByText("− Rp 180.000")).toBeTruthy();
    // Tidak ada lagi satu label "Pengembalian DP hari ini" yang mencampur keduanya.
    expect(screen.queryByText("Pengembalian DP hari ini")).toBeNull();
  });

  it("(c) tombol Tutup Harian mencatat penutupan + tampil lagi saat dibuka ulang", async () => {
    const p = await produkBaru("Blus", 40);
    const jual = trxJual(crypto.randomUUID(), null, 150000, "tunai");
    await simpanTransaksi(jual.trx, [], [jual.bayar], sumberStokUntuk([{ produkId: p.id, kuantitas: 1 }], null));

    const { unmount } = render(<TutupHarian bazarId={null} label="Toko" peran="kasir" />);
    expect(await screen.findByText("Tutup Harian — Toko")).toBeTruthy();
    // Klik pertama membuka konfirmasi dua langkah (bukan window.confirm).
    fireEvent.click(screen.getByRole("button", { name: "Tutup Harian" }));
    expect(await screen.findByText(/Tutup harian Toko hari ini?/)).toBeTruthy();
    // Klik kedua yang mencatat.
    fireEvent.click(screen.getByRole("button", { name: "Ya, Tutup Harian" }));
    await waitFor(() => expect(screen.getByText(/Sudah ditutup pukul/)).toBeTruthy());
    expect(screen.getByRole("button", { name: "Sudah Ditutup Hari Ini" }).hasAttribute("disabled")).toBe(true);

    // Record tersimpan: tanggal hari ini (WIB), lokasi toko, ringkasan hari itu.
    const { tanggalHariIni } = await import("../lib/tanggal.ts");
    const record = await ambilTutupHarian(tanggalHariIni(), null);
    expect(record).not.toBeNull();
    expect(record?.label).toBe("Toko");
    expect(record?.peran).toBe("kasir");
    expect(record?.jumlahTransaksi).toBe(1);
    expect(record?.uangMasuk).toBe(150000);
    expect(record?.tunai).toBe(150000);

    // Buka ulang: jejak penutupan tampil lagi tanpa menekan apa pun.
    unmount();
    render(<TutupHarian bazarId={null} label="Toko" peran="kasir" />);
    expect(await screen.findByText(/Sudah ditutup pukul/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sudah Ditutup Hari Ini" }).hasAttribute("disabled")).toBe(true);
  });

  it("(c) batal di panel konfirmasi tidak mencatat penutupan", async () => {
    render(<TutupHarian bazarId={null} label="Toko" peran="kasir" />);
    expect(await screen.findByText("Tutup Harian — Toko")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tutup Harian" }));
    expect(await screen.findByText(/Tutup harian Toko hari ini?/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Batal" }));
    await waitFor(() => expect(screen.queryByText(/Tutup harian Toko hari ini?/)).toBeNull());
    const { tanggalHariIni } = await import("../lib/tanggal.ts");
    expect(await ambilTutupHarian(tanggalHariIni(), null)).toBeNull();
    expect(screen.getByRole("button", { name: "Tutup Harian" }).hasAttribute("disabled")).toBe(false);
  });
});
