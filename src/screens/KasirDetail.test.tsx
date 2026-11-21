/**
 * Tes KasirDetail: QRIS di Terima Pembayaran (C3) dan pesanan batal
 * tanpa sisa/tanpa tombol bayar (C8). Tes klik 22 Nov 2026.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import KasirDetail from "./KasirDetail.tsx";
import { ambilTransaksi } from "../db/repositori.ts";
import { resetKoneksiDB, type Rekening } from "../db/schema.ts";
import { simpanPesananJahit } from "../lib/jahitan.ts";
import { batalkanTransaksi } from "../db/pesananOperasi.ts";

function resetDB() {
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  resetKoneksiDB();
}

const rekening: Rekening = {
  id: "rek-1",
  namaBank: "BCA",
  nomor: "676 017 885",
  namaPemilik: "NARSHITA DEWI",
  utama: true,
};

async function pesananBaru(): Promise<string> {
  const h = await simpanPesananJahit(
    {
      namaPemesan: "Ibu Sari",
      kontak: null,
      items: [{ nama: "Gaun pesta", harga: 300000, kuantitas: 1, ukuran: null }],
      perkiraanSelesai: null,
      catatan: null,
      biayaLain: [{ nama: "Bahan payet", nominal: 50000 }],
    },
    { rekening: [rekening] },
  );
  if (!h.ok) throw new Error("gagal membuat pesanan");
  return h.pesanan.id;
}

describe("KasirDetail — Terima Pembayaran (C3)", () => {
  beforeEach(resetDB);
  afterEach(cleanup);

  it("menawarkan Tunai, Transfer BCA, dan QRIS", async () => {
    const id = await pesananBaru();
    render(<KasirDetail id={id} onKembali={vi.fn()} />);
    expect(await screen.findByText("Terima Pembayaran")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tunai" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Transfer BCA" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "QRIS" })).toBeTruthy();
  });

  it("pembayaran QRIS tersimpan dengan metode qris", async () => {
    const id = await pesananBaru();
    render(<KasirDetail id={id} onKembali={vi.fn()} />);
    expect(await screen.findByText("Terima Pembayaran")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "QRIS" }));
    fireEvent.change(screen.getByLabelText("Nominal diterima"), { target: { value: "150000" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan Pembayaran" }));

    await waitFor(async () => {
      const lengkap = await ambilTransaksi(id);
      expect(lengkap?.pembayaran.some((p) => p.metode === "qris" && p.nominal === 150000)).toBe(true);
    });
  });
});

describe("KasirDetail — pesanan batal (C8)", () => {
  beforeEach(resetDB);
  afterEach(cleanup);

  it("pesanan batal menampilkan 'Dibatalkan', tanpa SISA dan tanpa Terima Pembayaran", async () => {
    const id = await pesananBaru();
    const { terimaPembayaranKasir } = await import("../db/kasirOperasi.ts");
    expect((await terimaPembayaranKasir(id, 150000, "tunai")).ok).toBe(true);
    expect((await batalkanTransaksi(id, "Pelanggan batal")).ok).toBe(true);

    render(<KasirDetail id={id} onKembali={vi.fn()} />);
    expect(await screen.findByText("Dibatalkan")).toBeTruthy();
    expect(screen.queryByText("SISA TAGIHAN")).toBeNull();
    expect(screen.queryByText("Terima Pembayaran")).toBeNull();
    expect(screen.queryByText(/Rp 200\.000/)).toBeNull();
  });
});
