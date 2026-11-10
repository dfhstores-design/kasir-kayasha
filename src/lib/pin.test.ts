import { describe, expect, it } from "vitest";
import {
  MAKS_PERCOBAAN_PIN,
  JEDA_SETELAH_GAGAL_MS,
  batasPercobaan,
  buatHashPin,
  cocokPin,
  validasiPinBaru,
} from "./pin.ts";

describe("validasiPinBaru", () => {
  it("menerima 4–6 angka", () => {
    expect(validasiPinBaru("2468")).toEqual({ ok: true });
    expect(validasiPinBaru("135790")).toEqual({ ok: true });
  });

  it("menolak bukan angka", () => {
    expect(validasiPinBaru("12ab")).toMatchObject({ ok: false });
  });

  it("menolak kurang dari 4 atau lebih dari 6 digit", () => {
    expect(validasiPinBaru("123")).toMatchObject({ ok: false });
    expect(validasiPinBaru("1234567")).toMatchObject({ ok: false });
  });

  it("menolak angka sama semua", () => {
    expect(validasiPinBaru("0000")).toMatchObject({ ok: false });
    expect(validasiPinBaru("777777")).toMatchObject({ ok: false });
  });

  it("menolak PIN yang terlalu mudah ditebak", () => {
    expect(validasiPinBaru("1234")).toMatchObject({ ok: false, pesan: "PIN terlalu mudah ditebak." });
    expect(validasiPinBaru("123456")).toMatchObject({ ok: false });
  });
});

describe("buatHashPin & cocokPin", () => {
  it("hash tidak berisi PIN asli", async () => {
    const h = await buatHashPin("246813");
    expect(h).not.toContain("246813");
    expect(h.startsWith("sha256$")).toBe(true);
  });

  it("dua hash untuk PIN sama berbeda (salt acak)", async () => {
    const a = await buatHashPin("246813");
    const b = await buatHashPin("246813");
    expect(a).not.toBe(b);
  });

  it("cocok dengan PIN benar, tidak cocok dengan PIN salah", async () => {
    const h = await buatHashPin("246813");
    expect(await cocokPin("246813", h)).toBe(true);
    expect(await cocokPin("246814", h)).toBe(false);
  });

  it("tanpa PIN tersimpan, tidak ada yang cocok", async () => {
    expect(await cocokPin("246813", null)).toBe(false);
    expect(await cocokPin("246813", "rusak")).toBe(false);
  });

  it("menolak membuat hash dari PIN tidak sah", async () => {
    await expect(buatHashPin("1234")).rejects.toBeInstanceOf(RangeError);
  });
});

describe("batasPercobaan", () => {
  it("belum terkunci sebelum 5 kali", () => {
    expect(batasPercobaan(4, 1000, 1000)).toEqual({ terkunci: false, sisaDetik: 0 });
  });

  it("terkunci setelah 5 kali gagal", () => {
    const r = batasPercobaan(MAKS_PERCOBAAN_PIN, 1000, 1000);
    expect(r.terkunci).toBe(true);
    expect(r.sisaDetik).toBe(30);
  });

  it("terbuka lagi setelah jeda habis", () => {
    const r = batasPercobaan(MAKS_PERCOBAAN_PIN, 1000, 1000 + JEDA_SETELAH_GAGAL_MS);
    expect(r.terkunci).toBe(false);
  });

  it("menampilkan sisa detik yang menurun", () => {
    const r = batasPercobaan(5, 1000, 1000 + 10_000);
    expect(r.sisaDetik).toBe(20);
  });
});
