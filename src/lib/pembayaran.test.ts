import { describe, expect, it } from "vitest";
import { labelStatusPembayaran, terimaPembayaran } from "./pembayaran.ts";

describe("terimaPembayaran", () => {
  it("DP pertama: sebagian dibayar, sisa berkurang, status terbuka", () => {
    const h = terimaPembayaran(100000, 0, 40000);
    expect(h).toEqual({
      ok: true,
      ringkasan: { terbayarBaru: 40000, sisaBaru: 60000, kembalian: 0, statusBaru: "terbuka" },
    });
  });

  it("terbayar dijumlahkan (cicilan bertahap)", () => {
    const h = terimaPembayaran(100000, 40000, 30000);
    expect(h.ok && h.ringkasan.terbayarBaru).toBe(70000);
    expect(h.ok && h.ringkasan.sisaBaru).toBe(30000);
  });

  it("pelunasan pas: status lunas, sisa 0, kembalian 0", () => {
    const h = terimaPembayaran(100000, 70000, 30000);
    expect(h.ok && h.ringkasan).toEqual({
      terbayarBaru: 100000,
      sisaBaru: 0,
      kembalian: 0,
      statusBaru: "lunas",
    });
  });

  it("boleh bayar LEBIH: kembalian dihitung, status lunas (BU-17.B)", () => {
    const h = terimaPembayaran(100000, 70000, 50000);
    expect(h.ok && h.ringkasan).toEqual({
      terbayarBaru: 120000,
      sisaBaru: 0,
      kembalian: 20000,
      statusBaru: "lunas",
    });
  });

  it("bayar lebih langsung tanpa DP: kembalian penuh kelebihan", () => {
    const h = terimaPembayaran(100000, 0, 100000);
    expect(h.ok && h.ringkasan.kembalian).toBe(0);
    const h2 = terimaPembayaran(100000, 0, 120000);
    expect(h2.ok && h2.ringkasan.kembalian).toBe(20000);
    expect(h2.ok && h2.ringkasan.sisaBaru).toBe(0);
    expect(h2.ok && h2.ringkasan.statusBaru).toBe("lunas");
  });

  it("menolak nominal 0 atau negatif", () => {
    expect(terimaPembayaran(100000, 0, 0)).toEqual({ ok: false, pesan: "Nominal harus lebih dari 0." });
    expect(terimaPembayaran(100000, 0, -5000)).toEqual({ ok: false, pesan: "Nominal harus lebih dari 0." });
  });

  it("menolak nominal pecahan (uang integer Rupiah)", () => {
    expect(terimaPembayaran(100000, 0, 2500.5)).toEqual({ ok: false, pesan: "Nominal harus lebih dari 0." });
  });
});

describe("labelStatusPembayaran", () => {
  it("nama Indonesia", () => {
    expect(labelStatusPembayaran("lunas")).toBe("Lunas");
    expect(labelStatusPembayaran("terbuka")).toBe("Belum lunas");
  });
});