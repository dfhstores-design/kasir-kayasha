import { describe, expect, it } from "vitest";
import {
  DAFTAR_TEMA,
  LABEL_SKALA,
  LABEL_TEMA,
  SKALA_FONT,
  terapkanSkalaFont,
  terapkanTampilan,
  terapkanTema,
} from "./tampilan.ts";

describe("SKALA_FONT / DAFTAR_TEMA", () => {
  it("punya 4 skala dengan label sejajar", () => {
    expect(SKALA_FONT).toEqual([0.9, 1, 1.15, 1.3]);
    expect(LABEL_SKALA).toEqual(["Kecil", "Normal", "Besar", "Sangat besar"]);
    expect(SKALA_FONT.length).toBe(LABEL_SKALA.length);
  });

  it("punya 3 tema dengan label lengkap", () => {
    expect(DAFTAR_TEMA).toEqual(["terang", "gelap", "krem"]);
    expect(LABEL_TEMA).toEqual({ terang: "Terang", gelap: "Gelap", krem: "Krem" });
  });
});

describe("terapkanSkalaFont / terapkanTema", () => {
  it("setel font-size root sesuai skala", () => {
    terapkanSkalaFont(1.3);
    expect(document.documentElement.style.fontSize).toBe("130%");
    terapkanSkalaFont(1);
    expect(document.documentElement.style.fontSize).toBe("100%");
  });

  it("nilai skala tidak sah kembali ke 1", () => {
    terapkanSkalaFont(2);
    expect(document.documentElement.style.fontSize).toBe("100%");
  });

  it("setel data-tema", () => {
    terapkanTema("gelap");
    expect(document.documentElement.getAttribute("data-tema")).toBe("gelap");
    terapkanTema("krem");
    expect(document.documentElement.getAttribute("data-tema")).toBe("krem");
  });

  it("tema tidak sah kembali ke terang", () => {
    terapkanTema("biru" as "terang" | "gelap" | "krem");
    expect(document.documentElement.getAttribute("data-tema")).toBe("terang");
  });

  it("terapkanTampilan setel keduanya sekaligus", () => {
    terapkanTampilan(1, "krem");
    expect(document.documentElement.style.fontSize).toBe("100%");
    expect(document.documentElement.getAttribute("data-tema")).toBe("krem");
  });
});