/**
 * Tes peran Fase 2A (BU-32): admin tidak boleh membuka laporan keuangan,
 * owner bisa semua yang admin bisa + laporan owner.
 */
import { describe, expect, it } from "vitest";
import {
  bazarIdPenjualan,
  bazarPenjualan,
  bolehAdmin,
  bolehJualBarang,
  bolehLaporanOwner,
  khususAdmin,
  labelLokasiKasir,
} from "./peran.ts";
import type { BazarRecord } from "../db/schema.ts";

function bazar(id: string, nama: string): BazarRecord {
  return {
    id,
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

describe("peran — Fase 2A", () => {
  it("kasir tidak boleh membuka fitur admin", () => {
    expect(bolehAdmin("kasir")).toBe(false);
    expect(khususAdmin("ringkasan")).toBe(true);
    expect(khususAdmin("daftar-jahit")).toBe(false);
  });

  it("admin boleh membuka fitur admin, tapi TIDAK laporan owner", () => {
    expect(bolehAdmin("admin")).toBe(true);
    expect(bolehLaporanOwner("admin")).toBe(false);
  });

  it("owner boleh membuka fitur admin DAN laporan owner", () => {
    expect(bolehAdmin("owner")).toBe(true);
    expect(bolehLaporanOwner("owner")).toBe(true);
  });

  it("label lokasi kasir", () => {
    expect(labelLokasiKasir({ jenis: "toko" })).toBe("Toko");
    expect(labelLokasiKasir({ jenis: "bazar", bazarId: "b1", nama: "Bazar A" })).toBe("Bazar A");
  });
});

describe("bolehJualBarang / bazarPenjualan (F14, BU-66)", () => {
  const b = bazar("b1", "Bazar A");

  it("kasir toko selalu boleh jualan — dari gudang, dengan atau tanpa bazar aktif", () => {
    expect(bolehJualBarang("kasir", { jenis: "toko" }, false)).toBe(true);
    expect(bolehJualBarang("kasir", { jenis: "toko" }, true)).toBe(true);
    // Penjualan kasir toko selalu bazarId null (stok gudang).
    expect(bazarPenjualan({ jenis: "toko" }, null)).toBeNull();
    expect(bazarPenjualan({ jenis: "toko" }, b)).toBeNull();
    expect(bazarIdPenjualan({ jenis: "toko" }, b)).toBeNull();
  });

  it("kasir bazar hanya boleh jualan bila ada bazar aktif", () => {
    const lokasi = { jenis: "bazar" as const, bazarId: "b1", nama: "Bazar A" };
    expect(bolehJualBarang("kasir", lokasi, false)).toBe(false);
    expect(bolehJualBarang("kasir", lokasi, true)).toBe(true);
    expect(bazarIdPenjualan(lokasi, b)).toBe("b1");
    expect(bazarIdPenjualan(lokasi, null)).toBeNull();
  });

  it("kasir tanpa lokasi tetap perlu bazar aktif", () => {
    expect(bolehJualBarang("kasir", null, false)).toBe(false);
    expect(bolehJualBarang("kasir", null, true)).toBe(true);
  });

  it("admin/owner selalu boleh jualan; tanpa bazar memakai gudang", () => {
    expect(bolehJualBarang("admin", null, false)).toBe(true);
    expect(bolehJualBarang("owner", null, false)).toBe(true);
    expect(bazarIdPenjualan(null, null)).toBeNull();
    expect(bazarIdPenjualan(null, b)).toBe("b1");
  });
});
