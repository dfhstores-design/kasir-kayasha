/**
 * Tes layar Tutup Bazar (Fase 2C, BU-34): rekonsiliasi per metode, konfirmasi
 * ulang pesanan, dan peringatan bila biaya belum tercatat.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import TutupBazar from "./TutupBazar.tsx";
import {
  alokasikanKeBazar,
  buatBazar,
  simpanProduk,
  simpanTransaksi,
  tambahBiaya,
  daftarBazar,
  type BazarRecord,
  type ProdukRecord,
} from "../db/repositori.ts";
import { resetKoneksiDB } from "../db/schema.ts";
import { sumberStokUntuk } from "../lib/sumberStok.ts";
import { sapaanDariWaktu } from "../lib/sapaan.ts";
import { simpanPesananJahit } from "../lib/jahitan.ts";

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

async function siapkanBazarDenganPenjualan(): Promise<BazarRecord> {
  const p = await produkBaru("Blus", 40);
  const b = await buatBazar("Pameran", null, null);
  await alokasikanKeBazar(b.id, p.id, 10);
  const now = new Date();
  const t = {
    id: crypto.randomUUID(),
    nomorResi: "KYS-0001",
    nomorUrutHari: 1,
    waktu: now.toISOString(),
    jenis: "langsung" as const,
    jenisDokumen: "penjualan" as const,
    arahStok: "keluar" as const,
    pelangganId: null,
    statusPesanan: "selesai" as const,
    bazarId: b.id,
    namaPemesan: null,
    kontak: null,
    perkiraanSiap: null,
    alamat: null,
    catatanPesanan: null,
    riwayatTotal: [],
    ongkirMode: "ambil_sendiri" as const,
    ongkirNominal: 0,
    subtotalAwal: 300000,
    diskonItem: 0,
    diskonTotal: 0,
    total: 300000,
    sapaan: sapaanDariWaktu(now),
    rekeningSnapshot: [],
    jenisBayar: "tunai" as const,
    statusBayar: "lunas" as const,
    dibatalkanPada: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  // DP tunai 100rb + pelunasan transfer 200rb: rekonsiliasi harus memisahnya.
  await simpanTransaksi(
    t,
    [],
    [
      { id: crypto.randomUUID(), transaksiId: t.id, nominal: 100000, waktu: now.toISOString(), metode: "tunai" as const, catatan: null },
      { id: crypto.randomUUID(), transaksiId: t.id, nominal: 200000, waktu: now.toISOString(), metode: "transfer" as const, catatan: null },
    ],
    sumberStokUntuk([{ produkId: p.id, kuantitas: 3 }], b.id),
  );
  return b;
}

describe("TutupBazar — rekonsiliasi & konfirmasi (Fase 2C, BU-34)", () => {
  beforeEach(resetDB);
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("menampilkan uang per metode dari baris pembayaran + total biaya", async () => {
    const b = await siapkanBazarDenganPenjualan();
    await tambahBiaya(b.id, { kategori: "sewa_booth", judul: "Sewa booth", nominal: 50000, tanggal: "2026-11-21", catatan: null });

    render(<TutupBazar bazar={b} onSelesai={vi.fn()} />);
    expect(await screen.findByText("Pameran")).toBeTruthy();
    expect(await screen.findByText("Rp 300.000")).toBeTruthy();
    expect(await screen.findByText("Rp 100.000")).toBeTruthy();
    expect(await screen.findByText("Rp 200.000")).toBeTruthy();
    expect(await screen.findByText(/Rp 50\.000/)).toBeTruthy();
    expect(screen.queryByText(/Belum ada biaya bazar/)).toBeNull();
  });

  it("memperingatkan bila belum ada biaya tercatat", async () => {
    const b = await siapkanBazarDenganPenjualan();

    render(<TutupBazar bazar={b} onSelesai={vi.fn()} />);
    expect(await screen.findByText(/Belum ada biaya bazar yang tercatat/)).toBeTruthy();
  });

  it("menolak tutup sebelum pesanan yang belum selesai dikonfirmasi", async () => {
    const b = await siapkanBazarDenganPenjualan();
    await simpanPesananJahit(
      {
        namaPemesan: "Ibu Sari",
        kontak: null,
        items: [{ nama: "Gaun pesta", harga: 300000, kuantitas: 1, ukuran: null }],
        perkiraanSelesai: null,
        catatan: null,
        biayaLain: [],
      },
      { rekening: [] },
    );
    const selesai = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<TutupBazar bazar={b} onSelesai={selesai} />);
    expect(await screen.findByText("Ibu Sari")).toBeTruthy();
    expect(await screen.findByText(/Pesanan yang belum selesai/)).toBeTruthy();

    fireEvent.click(await screen.findByRole("button", { name: "Tutup Bazar" }));
    expect(await screen.findByText(/Konfirmasi dulu pesanan yang belum selesai/)).toBeTruthy();
    expect(selesai).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText(/Pesanan di atas sudah dikonfirmasi/));
    fireEvent.click(screen.getByRole("button", { name: "Tutup Bazar" }));
    // Bazar tertutup dan tercatat selesai; onSelesai dipanggil setelah tutupBazar selesai.
    await waitFor(() => expect(selesai).toHaveBeenCalled());
    const daftar = await daftarBazar();
    expect(daftar.find((x) => x.id === b.id)?.status).toBe("selesai");
  });
});
