import { describe, expect, it } from "vitest";
import {
  formatRupiah,
  formatRupiahResi,
  formatRupiahTanpaRp,
  parseRupiah,
  tambahRupiah,
} from "./money.ts";

describe("parseRupiah", () => {
  it("menerima angka bulat", () => {
    expect(parseRupiah(0)).toEqual({ ok: true, value: 0 });
    expect(parseRupiah(250000)).toEqual({ ok: true, value: 250000 });
  });

  it("menerima format Indonesia dengan titik ribuan", () => {
    expect(parseRupiah("10.000")).toEqual({ ok: true, value: 10000 });
    expect(parseRupiah("1.250.000")).toEqual({ ok: true, value: 1250000 });
  });

  it("menerima awalan Rp dan spasi", () => {
    expect(parseRupiah("Rp 25.000")).toEqual({ ok: true, value: 25000 });
    expect(parseRupiah("  12 500 ")).toEqual({ ok: true, value: 12500 });
    expect(parseRupiah("rp10000")).toEqual({ ok: true, value: 10000 });
  });

  it("menolak pecahan, bukan dibulatkan diam-diam", () => {
    expect(parseRupiah("1000,50")).toEqual({ ok: false, error: "pecahan" });
    expect(parseRupiah(10.5)).toEqual({ ok: false, error: "pecahan" });
  });

  it("menolak negatif", () => {
    expect(parseRupiah(-1)).toEqual({ ok: false, error: "negatif" });
    expect(parseRupiah("-500")).toEqual({ ok: false, error: "bukan_angka" });
  });

  it("menolak kosong dan bukan angka", () => {
    expect(parseRupiah("")).toEqual({ ok: false, error: "bukan_angka" });
    expect(parseRupiah(null)).toEqual({ ok: false, error: "bukan_angka" });
    expect(parseRupiah("abc")).toEqual({ ok: false, error: "bukan_angka" });
    expect(parseRupiah("Rp")).toEqual({ ok: false, error: "bukan_angka" });
  });

  it("menolak nominal terlalu besar", () => {
    expect(parseRupiah("9999999999")).toEqual({ ok: false, error: "terlalu_besar" });
  });
});

describe("format", () => {
  it("formatRupiah memakai pemisah ribuan Indonesia", () => {
    expect(formatRupiah(1250000)).toBe("Rp 1.250.000");
    expect(formatRupiah(0)).toBe("Rp 0");
    expect(formatRupiah(-20000)).toBe("−Rp 20.000");
  });

  it("formatRupiahResi mengikuti contoh pemilik (tanpa spasi)", () => {
    expect(formatRupiahResi(359000)).toBe("Rp359.000");
    expect(formatRupiahResi(0)).toBe("Rp0");
  });

  it("formatRupiahTanpaRp untuk baris barang", () => {
    expect(formatRupiahTanpaRp(250000)).toBe("250.000");
  });
});

describe("tambahRupiah", () => {
  it("menjumlahkan banyak nilai", () => {
    expect(tambahRupiah(1000, 2000, 3000)).toBe(6000);
  });

  it("melempar bila melewati batas aman", () => {
    expect(() => tambahRupiah(Number.MAX_SAFE_INTEGER, 1)).toThrow(RangeError);
  });
});
