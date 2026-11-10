import { describe, expect, it } from "vitest";
import { formatSapaan, sapaanDariMenit, sapaanDariWaktu } from "./sapaan.ts";

/** Membuat Date lokal pada jam:menit tertentu. */
function jam(h: number, m = 0): Date {
  return new Date(2026, 10, 10, h, m, 0);
}

describe("sapaanDariMenit — batas", () => {
  it("03:59 masih Malam", () => {
    expect(sapaanDariMenit(3 * 60 + 59)).toBe("Malam");
    expect(sapaanDariMenit(0)).toBe("Malam");
  });

  it("04:00 mulai Pagi", () => {
    expect(sapaanDariMenit(4 * 60)).toBe("Pagi");
  });

  it("10:59 masih Pagi, 11:00 mulai Siang", () => {
    expect(sapaanDariMenit(10 * 60 + 59)).toBe("Pagi");
    expect(sapaanDariMenit(11 * 60)).toBe("Siang");
  });

  it("14:59 masih Siang, 15:00 mulai Sore", () => {
    expect(sapaanDariMenit(14 * 60 + 59)).toBe("Siang");
    expect(sapaanDariMenit(15 * 60)).toBe("Sore");
  });

  it("18:29 masih Sore, 18:30 mulai Malam", () => {
    expect(sapaanDariMenit(18 * 60 + 29)).toBe("Sore");
    expect(sapaanDariMenit(18 * 60 + 30)).toBe("Malam");
  });

  it("23:59 tetap Malam", () => {
    expect(sapaanDariMenit(23 * 60 + 59)).toBe("Malam");
  });

  it("menangani menit di luar rentang dengan membungkus", () => {
    expect(sapaanDariMenit(1440 + 9 * 60)).toBe("Pagi");
    expect(sapaanDariMenit(-60)).toBe("Malam"); // -1 jam = 23:00
  });

  it("menolak nilai tidak valid", () => {
    expect(() => sapaanDariMenit(Number.NaN)).toThrow(RangeError);
  });
});

describe("sapaanDariWaktu", () => {
  it("mengikuti jam lokal objek Date", () => {
    expect(sapaanDariWaktu(jam(9, 15))).toBe("Pagi");
    expect(sapaanDariWaktu(jam(12, 0))).toBe("Siang");
    expect(sapaanDariWaktu(jam(16, 45))).toBe("Sore");
    expect(sapaanDariWaktu(jam(20, 0))).toBe("Malam");
  });
});

describe("formatSapaan", () => {
  it("mengikuti bentuk resi contoh", () => {
    expect(formatSapaan("Sore")).toBe("- Sore -");
  });
});
