/**
 * Tes pembantu tanggal (Fase 2C, re-entry kertas, BU-34).
 */
import { describe, expect, it } from "vitest";
import {
  formatJam,
  formatTanggal,
  tanggalHariIni,
  tanggalWIB,
  transaksiDariKertas,
  waktuDariTanggal,
} from "./tanggal.ts";

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

describe("tanggal WIB (C9, tes klik 22 Nov 2026)", () => {
  it("tanggalWIB: 18:30 UTC = 01:30 WIB hari berikutnya", () => {
    expect(tanggalWIB("2026-11-21T18:30:00.000Z")).toBe("2026-11-22");
    expect(tanggalWIB("2026-11-21T10:00:00.000Z")).toBe("2026-11-21");
    expect(tanggalWIB("2026-11-21T16:59:59.000Z")).toBe("2026-11-21");
    expect(tanggalWIB("2026-11-21T17:00:00.000Z")).toBe("2026-11-22");
  });

  it("tanggalHariIni memakai WIB, bukan UTC", () => {
    // 23:30 UTC = 06:30 WIB keesokan harinya.
    expect(tanggalHariIni(new Date("2026-11-21T23:30:00.000Z"))).toBe("2026-11-22");
    expect(tanggalHariIni(new Date("2026-11-21T12:00:00.000Z"))).toBe("2026-11-21");
  });

  it("formatTanggal/formatJam memakai WIB", () => {
    expect(formatTanggal("2026-11-21T18:30:00.000Z")).toBe("22 Nov 2026");
    expect(formatTanggal("2026-11-21T10:00:00.000Z")).toBe("21 Nov 2026");
    // Locale id-ID memakai titik sebagai pemisah jam (konvensi yang sudah
    // dipakai resi sebelumnya).
    expect(formatJam("2026-11-21T18:30:00.000Z")).toBe("01.30");
    expect(formatJam("2026-11-21T10:00:00.000Z")).toBe("17.00");
  });

  it("transaksiDariKertas membandingkan tanggal WIB, bukan UTC", () => {
    // 18:30 UTC 21 Nov dan 02:00 UTC 22 Nov sama-sama 22 Nov WIB.
    expect(transaksiDariKertas("2026-11-21T18:30:00.000Z", "2026-11-22T02:00:00.000Z")).toBe(false);
    // 10:00 UTC = 17:00 WIB 21 Nov; 18:30 UTC = 01:30 WIB 22 Nov.
    expect(transaksiDariKertas("2026-11-21T10:00:00.000Z", "2026-11-21T18:30:00.000Z")).toBe(true);
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
