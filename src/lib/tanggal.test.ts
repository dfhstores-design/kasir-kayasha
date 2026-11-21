/**
 * Tes pembantu tanggal (Fase 2C, re-entry kertas, BU-34).
 */
import { describe, expect, it } from "vitest";
import { tanggalHariIni, transaksiDariKertas, waktuDariTanggal } from "./tanggal.ts";

describe("waktuDariTanggal", () => {
  it("tanggal valid menjadi jam 12 siang setempat", () => {
    const d = waktuDariTanggal("2026-11-19");
    expect(d).not.toBeNull();
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(10);
    expect(d?.getDate()).toBe(19);
    expect(d?.getHours()).toBe(12);
    // Jam 12 siang WIB = 05:00 UTC di hari yang sama (tidak geser tanggal).
    expect(d?.toISOString().slice(0, 10)).toBe("2026-11-19");
  });

  it("menolak format salah dan tanggal yang tidak ada", () => {
    expect(waktuDariTanggal("")).toBeNull();
    expect(waktuDariTanggal("19-11-2026")).toBeNull();
    expect(waktuDariTanggal("2026-13-01")).toBeNull();
    expect(waktuDariTanggal("2026-02-30")).toBeNull();
    expect(waktuDariTanggal("2026-11-32")).toBeNull();
  });

  it("tanggal kabisat 29 Feb tahun kabisat lolos, tahun biasa ditolak", () => {
    expect(waktuDariTanggal("2024-02-29")).not.toBeNull();
    expect(waktuDariTanggal("2026-02-29")).toBeNull();
  });
});

describe("tanggalHariIni", () => {
  it("format YYYY-MM-DD", () => {
    expect(tanggalHariIni()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Jam 12 siang setempat supaya tanggal ISO-nya sama (tengah malam
    // setempat masih hari sebelumnya dalam UTC).
    expect(tanggalHariIni(new Date(2026, 10, 19, 12))).toBe("2026-11-19");
  });
});

describe("transaksiDariKertas", () => {
  it("tanggal transaksi lebih lama dari tanggal masuk = dari kertas", () => {
    expect(transaksiDariKertas("2026-11-19T05:00:00.000Z", "2026-11-21T10:00:00.000Z")).toBe(true);
  });

  it("tanggal transaksi sama dengan tanggal masuk = bukan dari kertas", () => {
    expect(transaksiDariKertas("2026-11-21T05:00:00.000Z", "2026-11-21T10:00:00.000Z")).toBe(false);
    expect(transaksiDariKertas("2026-11-21T05:00:00.000Z", "2026-11-21T05:00:00.000Z")).toBe(false);
  });
});
