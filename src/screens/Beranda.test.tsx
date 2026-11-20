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
    pinKasirHash: null,
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
        lokasiKasir={null}
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
        lokasiKasir={null}
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
        lokasiKasir={null}
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

describe("Beranda — Fase 2A (role & PIN, BU-32/34)", () => {
  beforeEach(resetDB);
  afterEach(cleanup);

  function renderBeranda(peran: "kasir" | "admin" | "owner", lokasiKasir: { jenis: "toko" } | { jenis: "bazar"; bazarId: string; nama: string } | null = null) {
    render(
      <Beranda
        settings={null}
        storagePermanen={null}
        bazar={null}
        jumlahBazarAktif={0}
        memuatAwal={false}
        peran={peran}
        lokasiKasir={lokasiKasir}
        onMintaAdmin={() => {}}
        onKeluarAdmin={() => {}}
        onBiayaBazar={() => {}}
        buka={vi.fn()}
      />,
    );
  }

  it("kasir melihat Masuk Admin, Masuk Owner, dan Masuk Kasir", () => {
    renderBeranda("kasir");
    expect(screen.getByRole("button", { name: "Masuk Admin" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Masuk Owner" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Masuk Kasir" })).toBeTruthy();
  });

  it("kasir yang sudah terikat lokasi melihat nama lokasinya", () => {
    renderBeranda("kasir", { jenis: "toko" });
    expect(screen.getByRole("button", { name: "Kasir: Toko" })).toBeTruthy();
  });

  it("admin TIDAK melihat Laporan Keuangan; owner melihatnya", () => {
    renderBeranda("admin");
    expect(screen.queryByText("Laporan Keuangan")).toBeNull();
    expect(screen.queryByText("Laporan Owner")).toBeNull();
    expect(screen.getByRole("button", { name: "Atur PIN Admin" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Atur PIN Kasir Toko" })).toBeTruthy();
    expect(screen.queryByText("Atur PIN Owner")).toBeNull();
    cleanup();

    renderBeranda("owner");
    expect(screen.getByText("Laporan Owner")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Laporan Keuangan/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Atur PIN Owner" })).toBeTruthy();
    expect(screen.queryByText("Atur PIN Admin")).toBeNull();
  });
});
