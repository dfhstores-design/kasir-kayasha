/**
 * Tes peran Fase 2A (BU-32): admin tidak boleh membuka laporan keuangan,
 * owner bisa semua yang admin bisa + laporan owner.
 */
import { describe, expect, it } from "vitest";
import { bolehAdmin, bolehLaporanOwner, khususAdmin, labelLokasiKasir } from "./peran.ts";

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
