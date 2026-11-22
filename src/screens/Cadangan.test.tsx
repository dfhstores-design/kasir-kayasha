/**
 * Tes layar Cadangan (F2, tes klik 22 Nov 2026).
 *
 * Yang dikunci:
 *  - Tombol "Pulihkan sekarang" TIDAK memakai window.confirm lagi
 *    (browser otomatis menutup dialog itu diam-diam → restore tidak
 *    pernah jalan). Klik pertama menampilkan panel konfirmasi di dalam
 *    aplikasi; klik kedua ("Ya, Pulihkan") yang benar-benar memulihkan.
 *  - Mode "ganti" dengan cadangan kosong benar-benar mengosongkan data.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import Cadangan from "./Cadangan.tsx";
import { buatCadangan } from "../db/cadangan.ts";
import { getDB, resetKoneksiDB, type ProdukRecord } from "../db/schema.ts";
import { simpanProduk } from "../db/repositori.ts";
import { simpanPenjualan } from "../lib/penjualan.ts";

function resetDB() {
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  resetKoneksiDB();
}

describe("Cadangan — pulihkan dua langkah (F2)", () => {
  beforeEach(resetDB);
  afterEach(cleanup);

  it("klik pertama hanya menampilkan konfirmasi; klik 'Ya, Pulihkan' mengosongkan data (ganti)", async () => {
    const db = await getDB();
    // Cadangan kosong dulu (DB masih kosong).
    const kosong = await buatCadangan();
    expect(kosong.ok).toBe(true);
    if (!kosong.ok) return;
    const teksKosong = await kosong.blob.text();

    // Lalu isi data: 1 barang + 1 penjualan.
    const now = new Date().toISOString();
    const p: ProdukRecord = {
      id: crypto.randomUUID(),
      nama: "Blus F2",
      kode: null,
      hargaJual: 180000,
      stokGudang: 10,
      catatan: null,
      arsip: false,
      createdAt: now,
      updatedAt: now,
    };
    await simpanProduk(p);
    const jual = await simpanPenjualan(
      {
        items: [{ produkId: p.id, nama: p.nama, hargaSatuan: 180000, kuantitas: 1, diskonPerUnit: 0 }],
        diskonTotal: 0,
        ongkir: { mode: "ambil_sendiri", nominal: 0 },
        jenisBayar: "tunai",
        statusBayar: "lunas",
        dibayarSekarang: 0,
        bazarId: null,
      },
      { rekening: [] },
    );
    expect(jual.ok).toBe(true);
    expect(await db.count("transactions")).toBe(1);

    const onDipulihkan = vi.fn();
    render(<Cadangan onDipulihkan={onDipulihkan} />);

    // Pilih berkas cadangan kosong.
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const berkas = new File([teksKosong], "cadangan-kosong.json", { type: "application/json" });
    fireEvent.change(input, { target: { files: [berkas] } });
    expect(await screen.findByText("Pulihkan sekarang")).toBeDefined();

    // Centang "Ganti semua data".
    fireEvent.click(screen.getByLabelText(/Ganti semua data/));

    // Klik pertama: panel konfirmasi muncul, data BELUM berubah.
    fireEvent.click(screen.getByRole("button", { name: "Pulihkan sekarang" }));
    expect(await screen.findByText("Ya, Pulihkan")).toBeDefined();
    expect(await db.count("transactions")).toBe(1);

    // Klik kedua: restore jalan, data kosong, pesan sukses tampil.
    fireEvent.click(screen.getByRole("button", { name: "Ya, Pulihkan" }));
    expect(await screen.findByText("Cadangan berhasil dipulihkan.")).toBeDefined();
    expect(await db.count("transactions")).toBe(0);
    expect(await db.count("products")).toBe(0);
    expect(onDipulihkan).toHaveBeenCalledTimes(1);
  });

  it("tombol 'Batal' pada panel konfirmasi membatalkan tanpa mengubah data", async () => {
    const db = await getDB();
    const kosong = await buatCadangan();
    expect(kosong.ok).toBe(true);
    if (!kosong.ok) return;
    const teksKosong = await kosong.blob.text();
    const now = new Date().toISOString();
    await simpanProduk({
      id: crypto.randomUUID(),
      nama: "Blus F2",
      kode: null,
      hargaJual: 180000,
      stokGudang: 10,
      catatan: null,
      arsip: false,
      createdAt: now,
      updatedAt: now,
    });

    render(<Cadangan onDipulihkan={vi.fn()} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File([teksKosong], "c.json", { type: "application/json" })] } });
    expect(await screen.findByText("Pulihkan sekarang")).toBeDefined();
    fireEvent.click(screen.getByLabelText(/Ganti semua data/));
    fireEvent.click(screen.getByRole("button", { name: "Pulihkan sekarang" }));
    expect(await screen.findByText("Ya, Pulihkan")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Batal" }));
    expect(screen.queryByText("Ya, Pulihkan")).toBeNull();
    expect(await db.count("products")).toBe(1);
  });
});
