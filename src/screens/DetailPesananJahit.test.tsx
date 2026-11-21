/**
 * Tes DetailPesananJahit: pesanan batal tanpa sisa tagihan dan tanpa
 * tombol Terima Pembayaran (C8). Tes klik 22 Nov 2026.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { cleanup, render, screen } from "@testing-library/react";
import DetailPesananJahit from "./DetailPesananJahit.tsx";
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
      biayaLain: [],
    },
    { rekening: [rekening] },
  );
  if (!h.ok) throw new Error("gagal membuat pesanan");
  return h.pesanan.id;
}

describe("DetailPesananJahit — pesanan batal (C8)", () => {
  beforeEach(resetDB);
  afterEach(cleanup);

  it("pesanan batal menampilkan 'Dibatalkan', tanpa SISA Rp 300.000 dan tanpa tombol bayar", async () => {
    const id = await pesananBaru();
    const { terimaPembayaranKasir } = await import("../db/kasirOperasi.ts");
    expect((await terimaPembayaranKasir(id, 50000, "tunai")).ok).toBe(true);
    expect((await batalkanTransaksi(id, "Pelanggan batal")).ok).toBe(true);

    render(
      <DetailPesananJahit
        id={id}
        segarkan={0}
        onTerimaPembayaran={vi.fn()}
        onUbah={vi.fn()}
        onKembali={vi.fn()}
      />,
    );
    expect(await screen.findByText("Dibatalkan")).toBeTruthy();
    expect(screen.queryByText("SISA")).toBeNull();
    expect(screen.queryByRole("button", { name: "Terima Pembayaran" })).toBeNull();
    // Dokumen pesanan batal adalah resi, bukan invoice.
    expect(screen.getByRole("button", { name: /Lihat & Bagikan Resi/ })).toBeTruthy();
  });

  it("pesanan terbuka masih menampilkan SISA dan tombol Terima Pembayaran", async () => {
    const id = await pesananBaru();
    render(
      <DetailPesananJahit
        id={id}
        segarkan={0}
        onTerimaPembayaran={vi.fn()}
        onUbah={vi.fn()}
        onKembali={vi.fn()}
      />,
    );
    expect(await screen.findByText("SISA")).toBeTruthy();
    // "Rp 300.000" muncul tiga kali: harga item, TOTAL, dan SISA (belum
    // ada pembayaran).
    expect(await screen.findAllByText("Rp 300.000")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Terima Pembayaran" })).toBeTruthy();
  });
});
