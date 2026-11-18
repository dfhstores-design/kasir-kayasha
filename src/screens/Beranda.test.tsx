/**
 * Tes Beranda: gerbang pemuatan awal (quirk first-load 17 Nov 2026) dan
 * tampilan multi-bazar.
 *
 * - Selama memuatAwal, Beranda TIDAK boleh menyimpulkan "Belum ada bazar
 *   aktif": yang tampil "Memuat bazar…" dan Penjualan nonaktif.
 * - Setelah selesai dimuat tanpa bazar, banner "Belum ada bazar aktif"
 *   baru boleh tampil.
 * - Bila ada lebih dari satu bazar aktif, nama yang tampil adalah bazar
 *   penjualan (terakhir dibuka) beserta jumlahnya.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { cleanup, render, screen } from "@testing-library/react";
import Beranda from "./Beranda.tsx";
import { resetKoneksiDB, type BazarRecord } from "../db/schema.ts";

function resetDB() {
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  resetKoneksiDB();
}

function bazar(nama: string): BazarRecord {
  return {
    id: crypto.randomUUID(),
    nama,
    mulai: null,
    selesai: null,
    lokasi: null,
    catatan: null,
    status: "aktif",
    ringkasanTerjual: null,
    ringkasanDibawa: null,
    ringkasanSisa: null,
    ditutupPada: null,
    createdAt: new Date().toISOString(),
  };
}

describe("Beranda — pemuatan awal", () => {
  beforeEach(resetDB);
  afterEach(cleanup);

  it("selama memuat, tidak ada klaim 'belum ada bazar' dan Penjualan nonaktif", () => {
    render(
      <Beranda
        settings={null}
        storagePermanen={null}
        bazar={null}
        jumlahBazarAktif={0}
        memuatAwal
        peran="kasir"
        onMintaAdmin={() => {}}
        onKeluarAdmin={() => {}}
        onBiayaBazar={() => {}}
        buka={vi.fn()}
      />,
    );
    expect(screen.getByText("Memuat bazar…")).toBeTruthy();
    expect(screen.queryByText(/Belum ada bazar aktif/)).toBeNull();
    expect(screen.getByRole("button", { name: "Penjualan" }).hasAttribute("disabled")).toBe(true);
  });

  it("setelah selesai dimuat tanpa bazar, banner 'belum ada bazar' tampil", () => {
    render(
      <Beranda
        settings={null}
        storagePermanen={null}
        bazar={null}
        jumlahBazarAktif={0}
        memuatAwal={false}
        peran="kasir"
        onMintaAdmin={() => {}}
        onKeluarAdmin={() => {}}
        onBiayaBazar={() => {}}
        buka={vi.fn()}
      />,
    );
    expect(screen.getByText(/Belum ada bazar aktif/)).toBeTruthy();
    expect(screen.queryByText("Memuat bazar…")).toBeNull();
  });
});

describe("Beranda — multi-bazar", () => {
  beforeEach(resetDB);
  afterEach(cleanup);

  it("menampilkan nama bazar penjualan dan jumlah bazar aktif", () => {
    render(
      <Beranda
        settings={null}
        storagePermanen={null}
        bazar={bazar("Bazar 2 — Pameran")}
        jumlahBazarAktif={2}
        memuatAwal={false}
        peran="admin"
        onMintaAdmin={() => {}}
        onKeluarAdmin={() => {}}
        onBiayaBazar={() => {}}
        buka={vi.fn()}
      />,
    );
    expect(screen.getByText("Bazar 2 — Pameran")).toBeTruthy();
    expect(screen.getByText(/Ada 2 bazar aktif/)).toBeTruthy();
    expect(screen.getByText(/terakhir dibuka/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Penjualan" }).hasAttribute("disabled")).toBe(false);
  });
});
