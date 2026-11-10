import { describe, expect, it } from "vitest";
import { buatOngkir, labelOngkirResi, ongkirBelumDitentukan, ongkirDitagihkanButik, ONGKIR_GRATIS } from "./ongkir.ts";

describe("buatOngkir", () => {
  it("ambil sendiri wajib 0", () => {
    expect(buatOngkir("ambil_sendiri", 0)).toEqual({ ok: true, value: { mode: "ambil_sendiri", nominal: 0 } });
    expect(buatOngkir("ambil_sendiri", 5000)).toEqual({ ok: false, error: "nominal_tidak_kosong" });
  });

  it("kurir wajib 0 (dibayar langsung ke kurir)", () => {
    expect(buatOngkir("kurir", 0)).toEqual({ ok: true, value: { mode: "kurir", nominal: 0 } });
    expect(buatOngkir("kurir", 20000)).toEqual({ ok: false, error: "nominal_tidak_kosong" });
  });

  it("butik boleh nominal berapa pun >= 0", () => {
    expect(buatOngkir("butik", 0)).toEqual({ ok: true, value: { mode: "butik", nominal: 0 } });
    expect(buatOngkir("butik", 25000)).toEqual({ ok: true, value: { mode: "butik", nominal: 25000 } });
    expect(buatOngkir("butik", -1)).toEqual({ ok: false, error: "nominal_negatif" });
  });

  it("belum_ditentukan wajib null — tidak boleh disamakan dengan Rp 0", () => {
    expect(buatOngkir("belum_ditentukan", null)).toEqual({
      ok: true,
      value: { mode: "belum_ditentukan", nominal: null },
    });
    expect(buatOngkir("belum_ditentukan", 0)).toEqual({ ok: false, error: "nominal_tidak_kosong" });
  });

  it("menolak mode tidak dikenal", () => {
    // @ts-expect-error sengaja menguji nilai di luar tipe
    expect(buatOngkir("gratis_ongkir", 0)).toEqual({ ok: false, error: "mode_tidak_dikenal" });
  });
});

describe("ongkirDitagihkanButik", () => {
  it("hanya mode butik yang masuk tagihan", () => {
    expect(ongkirDitagihkanButik({ mode: "butik", nominal: 25000 })).toBe(25000);
    expect(ongkirDitagihkanButik({ mode: "ambil_sendiri", nominal: 0 })).toBe(0);
    expect(ongkirDitagihkanButik({ mode: "kurir", nominal: 0 })).toBe(0);
    expect(ongkirDitagihkanButik({ mode: "belum_ditentukan", nominal: null })).toBe(0);
    expect(ongkirDitagihkanButik(ONGKIR_GRATIS)).toBe(0);
  });
});

describe("ongkirBelumDitentukan", () => {
  it("membedakan 'belum ditentukan' dari Rp 0", () => {
    expect(ongkirBelumDitentukan({ mode: "belum_ditentukan", nominal: null })).toBe(true);
    expect(ongkirBelumDitentukan({ mode: "ambil_sendiri", nominal: 0 })).toBe(false);
    expect(ongkirBelumDitentukan({ mode: "butik", nominal: 0 })).toBe(false);
  });
});

describe("labelOngkirResi", () => {
  it("empat keadaan punya tulisan berbeda", () => {
    expect(labelOngkirResi({ mode: "ambil_sendiri", nominal: 0 })).toBe("Rp0");
    expect(labelOngkirResi({ mode: "kurir", nominal: 0 })).toBe("Dibayar langsung ke kurir");
    expect(labelOngkirResi({ mode: "belum_ditentukan", nominal: null })).toBe("Belum ditentukan");
    expect(labelOngkirResi({ mode: "butik", nominal: 25000 })).toBe("Rp25.000");
  });
});
