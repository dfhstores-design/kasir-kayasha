import { describe, expect, it } from "vitest";
import { bacaModeInput, layarAwalDariUrl } from "./modeInput.ts";

describe("bacaModeInput", () => {
  it("param URL menang atas simpanan dan bawaan", () => {
    expect(bacaModeInput("?mode=satu-layar", "wizard")).toBe("satu-layar");
    expect(bacaModeInput("?mode=wizard", "satu-layar")).toBe("wizard");
  });

  it("tanpa param URL memakai simpanan", () => {
    expect(bacaModeInput("", "satu-layar")).toBe("satu-layar");
    expect(bacaModeInput("?layar=pesanan-jahit", "wizard")).toBe("wizard");
  });

  it("tanpa param dan simpanan memakai wizard", () => {
    expect(bacaModeInput("", null)).toBe("wizard");
    expect(bacaModeInput("?mode=aneh", null)).toBe("wizard");
    expect(bacaModeInput("?mode=aneh", "juga-aneh")).toBe("wizard");
  });
});

describe("layarAwalDariUrl", () => {
  it("?layar=pesanan-jahit membuka form input", () => {
    expect(layarAwalDariUrl("?layar=pesanan-jahit")).toBe("wizard-jahit");
    expect(layarAwalDariUrl("?layar=pesanan-jahit&mode=satu-layar")).toBe("wizard-jahit");
  });

  it("tanpa param itu kembalikan null (beranda)", () => {
    expect(layarAwalDariUrl("")).toBeNull();
    expect(layarAwalDariUrl("?mode=satu-layar")).toBeNull();
    expect(layarAwalDariUrl("?layar=beranda")).toBeNull();
  });
});
