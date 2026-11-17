import { describe, expect, it } from "vitest";
import { TEMA_BAWAAN, temaDari, terapkanTampilan, UKURAN_FONT_BAWAAN, ukuranFontDari } from "./tampilan.ts";

describe("ukuranFontDari / temaDari — nilai lama & nilai aneh aman", () => {
  it("bawaan adalah normal / terang", () => {
    expect(UKURAN_FONT_BAWAAN).toBe("normal");
    expect(TEMA_BAWAAN).toBe("terang");
  });

  it("undefined / null / nilai aneh kembali ke bawaan", () => {
    expect(ukuranFontDari(undefined)).toBe("normal");
    expect(ukuranFontDari(null)).toBe("normal");
    expect(ukuranFontDari("kecil")).toBe("normal");
    expect(temaDari(undefined)).toBe("terang");
    expect(temaDari(null)).toBe("terang");
    expect(temaDari("biru")).toBe("terang");
  });

  it("hanya 'besar' dan 'gelap' yang diteruskan", () => {
    expect(ukuranFontDari("besar")).toBe("besar");
    expect(temaDari("gelap")).toBe("gelap");
  });
});

describe("terapkanTampilan", () => {
  it("menulis atribut data di elemen <html>", () => {
    const akar = document.createElement("html");
    terapkanTampilan("besar", "gelap", akar);
    expect(akar.dataset.ukuranFont).toBe("besar");
    expect(akar.dataset.tema).toBe("gelap");
    terapkanTampilan("normal", "terang", akar);
    expect(akar.dataset.ukuranFont).toBe("normal");
    expect(akar.dataset.tema).toBe("terang");
  });
});
