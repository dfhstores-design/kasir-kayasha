/**
 * Tes Riwayat Penjualan (C5, tes klik 22 Nov 2026): riwayat penjualan
 * barang bisa dibuka dari Beranda, menampilkan penjualan terbaru dulu,
 * dan penjualan bisa dibatalkan dari layar dengan alasan (BU-63).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import RiwayatPenjualan from "./RiwayatPenjualan.tsx";
import { resetKoneksiDB, type ProdukRecord } from "../db/schema.ts";
import { simpanProduk } from "../db/repositori.ts";
import { simpanPenjualan, type ItemPilihan } from "../lib/penjualan.ts";
import { simpanPesananJahit } from "../lib/jahitan.ts";

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

async function siapkanPenjualan(): Promise<{ id1: string; id2: string }> {
  const blus = await produkBaru("Blus Linen", 150000, 20);
  const rok = await produkBaru("Rok Batik", 120000, 15);
  const item = (p: ProdukRecord, kuantitas: number): ItemPilihan => ({
    produkId: p.id,
    nama: p.nama,
    hargaSatuan: p.hargaJual,
    kuantitas,
    diskonPerUnit: 0,
  });
  const r = (items: ItemPilihan[]) => ({
    items,
    diskonTotal: 0,
    ongkir: { mode: "ambil_sendiri" as const, nominal: 0 },
    jenisBayar: "tunai" as const,
    statusBayar: "lunas" as const,
    dibayarSekarang: 0,
    bazarId: null,
  });
  const satu = await simpanPenjualan(r([item(blus, 1)]), { rekening: [] });
  const dua = await simpanPenjualan(r([item(rok, 2)]), { rekening: [] });
  if (!satu.ok || !dua.ok) throw new Error("gagal membuat penjualan");
  // Pesanan jahit TIDAK boleh muncul di riwayat penjualan barang.
  const jahit = await simpanPesananJahit(
    {
      namaPemesan: "Ibu Sari",
      kontak: null,
      items: [{ nama: "Gaun", harga: 300000, kuantitas: 1, ukuran: null }],
      perkiraanSelesai: null,
      catatan: null,
      biayaLain: [],
    },
    { rekening: [] },
  );
  if (!jahit.ok) throw new Error("gagal membuat pesanan jahit");
  return { id1: satu.transaksi.id, id2: dua.transaksi.id };
}

describe("RiwayatPenjualan (C5)", () => {
  beforeEach(resetDB);
  afterEach(cleanup);

  it("menampilkan penjualan terbaru dulu; pesanan jahit tidak ikut", async () => {
    await siapkanPenjualan();
    render(<RiwayatPenjualan onLihatResi={vi.fn()} onKembali={vi.fn()} />);
    expect(await screen.findByText("KYS-0001")).toBeTruthy();
    expect(await screen.findByText("KYS-0002")).toBeTruthy();
    expect(screen.queryByText(/KC\./)).toBeNull();
    expect(screen.getByText("Rp 150.000")).toBeTruthy();
    expect(screen.getByText("Rp 240.000")).toBeTruthy();
  });

  it("ketuk baris membuka resi penjualan itu", async () => {
    const { id1 } = await siapkanPenjualan();
    const lihat = vi.fn();
    render(<RiwayatPenjualan onLihatResi={lihat} onKembali={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /KYS-0001/ }));
    expect(lihat).toHaveBeenCalledWith(id1);
  });

  it("penjualan bisa dibatalkan dari layar dengan alasan; stok kembali", async () => {
    await siapkanPenjualan();
    render(<RiwayatPenjualan onLihatResi={vi.fn()} onKembali={vi.fn()} />);
    expect(await screen.findByText("KYS-0001")).toBeTruthy();

    // Tombol "Batalkan" ada di tiap baris yang belum dibatalkan.
    const tombolBatal = screen.getAllByRole("button", { name: "Batalkan" });
    expect(tombolBatal).toHaveLength(2);
    fireEvent.click(tombolBatal[0]!);
    fireEvent.change(screen.getByLabelText("Alasan pembatalan"), { target: { value: "Salah input" } });
    fireEvent.click(screen.getByRole("button", { name: "Ya, Batalkan" }));

    await waitFor(() => expect(screen.getByText(/Dibatalkan/)).toBeTruthy());
    // Hanya satu baris yang berubah status; yang lain tetap Lunas.
    expect(screen.getAllByText(/Lunas/)).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Batalkan" })).toHaveLength(1);
  });

  it("alasan pembatalan kurang dari 3 huruf ditolak", async () => {
    await siapkanPenjualan();
    render(<RiwayatPenjualan onLihatResi={vi.fn()} onKembali={vi.fn()} />);
    expect(await screen.findByText("KYS-0001")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Batalkan" })[0]!);
    fireEvent.change(screen.getByLabelText("Alasan pembatalan"), { target: { value: "ab" } });
    // Tombol "Ya, Batalkan" nonaktif bila alasan kurang dari 3 huruf.
    expect(screen.getByRole("button", { name: "Ya, Batalkan" }).hasAttribute("disabled")).toBe(true);
  });

  it("F6: sesudah batal berhasil, onBerubah dipanggil agar App memuat ulang saldo", async () => {
    await siapkanPenjualan();
    const berubah = vi.fn();
    render(<RiwayatPenjualan onLihatResi={vi.fn()} onKembali={vi.fn()} onBerubah={berubah} />);
    expect(await screen.findByText("KYS-0001")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Batalkan" })[0]!);
    fireEvent.change(screen.getByLabelText("Alasan pembatalan"), { target: { value: "Salah input" } });
    fireEvent.click(screen.getByRole("button", { name: "Ya, Batalkan" }));
    await waitFor(() => expect(screen.getByText(/Dibatalkan/)).toBeTruthy());
    expect(berubah).toHaveBeenCalledTimes(1);
  });

  it("tampilkan pesan bila belum ada penjualan", async () => {
    render(<RiwayatPenjualan onLihatResi={vi.fn()} onKembali={vi.fn()} />);
    expect(await screen.findByText("Belum ada penjualan.")).toBeTruthy();
  });
});
