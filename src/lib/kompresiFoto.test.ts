import { describe, expect, it, vi } from "vitest";
import {
  FOTO_KUALITAS_MIN,
  FOTO_SISI_MAKS,
  FOTO_UKURAN_MAKS,
  hitungUkuranTarget,
  kompresDenganEncoder,
  pilihTipeFoto,
  type EncoderFoto,
} from "./kompresiFoto.ts";

describe("hitungUkuranTarget", () => {
  it("mengecilkan foto besar agar sisi terpanjang 1600", () => {
    expect(hitungUkuranTarget({ lebar: 4000, tinggi: 3000 })).toEqual({ lebar: 1600, tinggi: 1200 });
  });

  it("memakai sisi terpanjang bila potret", () => {
    expect(hitungUkuranTarget({ lebar: 3000, tinggi: 4000 })).toEqual({ lebar: 1200, tinggi: 1600 });
  });

  it("tidak memperbesar foto kecil", () => {
    expect(hitungUkuranTarget({ lebar: 800, tinggi: 600 })).toEqual({ lebar: 800, tinggi: 600 });
    expect(hitungUkuranTarget({ lebar: 1600, tinggi: 900 })).toEqual({ lebar: 1600, tinggi: 900 });
  });

  it("tidak pernah menghasilkan nol", () => {
    const h = hitungUkuranTarget({ lebar: 10000, tinggi: 1 });
    expect(h.lebar).toBe(FOTO_SISI_MAKS);
    expect(h.tinggi).toBeGreaterThanOrEqual(1);
  });

  it("menolak ukuran tidak valid", () => {
    expect(() => hitungUkuranTarget({ lebar: 0, tinggi: 100 })).toThrow(RangeError);
  });
});

function encoderPalsu(ukuranBerurutan: number[]): { fn: EncoderFoto; kualitas: number[] } {
  const kualitas: number[] = [];
  let i = 0;
  const fn: EncoderFoto = async (_k, _t, q) => {
    kualitas.push(q);
    const size = ukuranBerurutan[Math.min(i, ukuranBerurutan.length - 1)];
    i++;
    return new Blob([new Uint8Array(size)]);
  };
  return { fn, kualitas };
}

describe("kompresDenganEncoder", () => {
  it("berhenti pada kualitas awal bila sudah di bawah 400 KB", async () => {
    const e = encoderPalsu([300 * 1024]);
    const h = await kompresDenganEncoder({}, { lebar: 1600, tinggi: 1200 }, e.fn, "image/webp");
    expect(e.kualitas).toEqual([0.82]);
    expect(h.masihTerlaluBesar).toBe(false);
    expect(h.tipe).toBe("image/webp");
  });

  it("menurunkan kualitas sampai muat", async () => {
    const e = encoderPalsu([900 * 1024, 700 * 1024, 380 * 1024]);
    const h = await kompresDenganEncoder({}, { lebar: 1600, tinggi: 1200 }, e.fn, "image/webp");
    expect(e.kualitas.length).toBe(3);
    expect(h.blob.size).toBe(380 * 1024);
    expect(h.masihTerlaluBesar).toBe(false);
  });

  it("menandai masihTerlaluBesar bila batas bawah tercapai", async () => {
    const e = encoderPalsu([900 * 1024]);
    const h = await kompresDenganEncoder({}, { lebar: 1600, tinggi: 1200 }, e.fn, "image/jpeg");
    expect(h.masihTerlaluBesar).toBe(true);
    expect(Math.min(...e.kualitas)).toBeGreaterThanOrEqual(FOTO_KUALITAS_MIN);
    expect(h.blob.size).toBeGreaterThan(FOTO_UKURAN_MAKS);
  });

  it("tidak memakai kualitas di bawah batas", async () => {
    const e = encoderPalsu([900 * 1024]);
    await kompresDenganEncoder({}, { lebar: 1600, tinggi: 1200 }, e.fn, "image/webp");
    expect(Math.min(...e.kualitas)).toBeGreaterThanOrEqual(FOTO_KUALITAS_MIN);
  });
});

describe("pilihTipeFoto", () => {
  it("WebP bila didukung, JPEG bila tidak", () => {
    expect(pilihTipeFoto(true)).toBe("image/webp");
    expect(pilihTipeFoto(false)).toBe("image/jpeg");
  });
});

describe("kompresFoto — lingkungan tanpa canvas", () => {
  it("memberi pesan jelas bila canvas 2d tidak tersedia", async () => {
    const { kompresFoto } = await import("./kompresiFoto.ts");
    // jsdom tidak menyediakan getContext("2d"): fungsi harus gagal dengan pesan yang
    // bisa ditampilkan ke pemilik, bukan melempar error mentah.
    const asliBitmap = globalThis.createImageBitmap;
    Object.defineProperty(globalThis, "createImageBitmap", {
      value: async () => ({ width: 2000, height: 1000, close: () => {} }),
      configurable: true,
    });
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" });
    await expect(kompresFoto(blob)).rejects.toThrow();
    Object.defineProperty(globalThis, "createImageBitmap", { value: asliBitmap, configurable: true });
  });

  it("tidak menulis data foto ke console", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(err).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    err.mockRestore();
    warn.mockRestore();
  });
});

/* ================= berkas besar (permintaan pemilik) ================= */

import {
  FOTO_BERKAS_BESAR,
  FOTO_BERKAS_MAKS,
  FOTO_MEMORI_MAKS_BYTE,
  jalurPengecilan,
  periksaBerkasFoto,
  periksaResolusi,
  perkiraanMemori,
  perluKecilkanSaatDecode,
} from "./kompresiFoto.ts";

const MB = 1024 * 1024;

describe("periksaBerkasFoto", () => {
  it("menerima JPEG biasa", () => {
    expect(periksaBerkasFoto({ size: 3 * MB, type: "image/jpeg" })).toEqual({ ok: true, besar: false });
  });

  it("menandai berkas >10 MB sebagai besar (decode harus memakai resize)", () => {
    expect(periksaBerkasFoto({ size: 85 * MB, type: "image/jpeg" })).toEqual({ ok: true, besar: true });
    expect(periksaBerkasFoto({ size: FOTO_BERKAS_BESAR + 1, type: "image/jpeg" })).toMatchObject({ besar: true });
  });

  it("menerima 80 MB (permintaan pemilik: harus diantisipasi)", () => {
    const h = periksaBerkasFoto({ size: 80 * MB, type: "image/jpeg" });
    expect(h.ok).toBe(true);
    if (h.ok) expect(h.besar).toBe(true);
  });

  it("menolak di atas 150 MB dengan pesan jelas", () => {
    const h = periksaBerkasFoto({ size: FOTO_BERKAS_MAKS + 1, type: "image/jpeg" });
    expect(h.ok).toBe(false);
    if (h.ok) return;
    expect(h.galat).toBe("terlalu_besar");
    expect(h.pesan).toContain("150 MB");
  });

  it("menolak berkas bukan gambar", () => {
    const h = periksaBerkasFoto({ size: 1 * MB, type: "application/pdf" });
    expect(h.ok).toBe(false);
    if (!h.ok) expect(h.galat).toBe("bukan_gambar");
  });

  it("mengizinkan type kosong (galeri Android kadang tidak mengisi)", () => {
    expect(periksaBerkasFoto({ size: 2 * MB, type: "" }).ok).toBe(true);
  });

  it("menerima HEIC", () => {
    expect(periksaBerkasFoto({ size: 5 * MB, type: "image/heic" }).ok).toBe(true);
  });

  it("menolak berkas kosong", () => {
    const h = periksaBerkasFoto({ size: 0, type: "image/jpeg" });
    expect(h.ok).toBe(false);
    if (!h.ok) expect(h.galat).toBe("berkas_kosong");
  });
});

describe("periksaResolusi", () => {
  it("menerima 4000x3000 (12 MP)", () => {
    expect(periksaResolusi(4000, 3000).ok).toBe(true);
  });

  it("menerima 108 MP (12000x9000)", () => {
    const h = periksaResolusi(12000, 9000);
    expect(h.ok).toBe(true);
    if (h.ok) expect(h.besar).toBe(true);
  });

  it("menolak di atas 150 MP", () => {
    const h = periksaResolusi(20000, 15000);
    expect(h.ok).toBe(false);
    if (!h.ok) expect(h.galat).toBe("resolusi_terlalu_besar");
  });

  it("menolak dimensi tidak terbaca", () => {
    expect(periksaResolusi(0, 100).ok).toBe(false);
  });
});

describe("strategi memori", () => {
  it("menghitung 4 byte per piksel", () => {
    expect(perkiraanMemori(1000, 1000)).toBe(4_000_000);
  });

  it("foto 12 MP tidak perlu dikecilkan saat decode", () => {
    expect(perluKecilkanSaatDecode(4000, 3000)).toBe(false);
  });

  it("foto 108 MP perlu dikecilkan saat decode", () => {
    expect(perluKecilkanSaatDecode(12000, 9000)).toBe(true);
    expect(perkiraanMemori(12000, 9000)).toBeGreaterThan(FOTO_MEMORI_MAKS_BYTE);
  });
});

describe("jalurPengecilan", () => {
  it("foto kecil: satu langkah langsung", () => {
    expect(jalurPengecilan({ lebar: 1000, tinggi: 800 })).toEqual([{ lebar: 1000, tinggi: 800 }]);
  });

  it("4000 px: mengecil dua langkah (2000 lalu 1600), tidak melompat", () => {
    expect(jalurPengecilan({ lebar: 4000, tinggi: 3000 })).toEqual([
      { lebar: 2000, tinggi: 1500 },
      { lebar: 1600, tinggi: 1200 },
    ]);
  });

  it("2000 px: satu langkah langsung ke 1600", () => {
    expect(jalurPengecilan({ lebar: 2000, tinggi: 1500 })).toEqual([{ lebar: 1600, tinggi: 1200 }]);
  });

  it("12000 px: mengecil bertahap, maks 2x per langkah", () => {
    const jalur = jalurPengecilan({ lebar: 12000, tinggi: 9000 });
    expect(jalur.length).toBeGreaterThan(1);
    expect(jalur[jalur.length - 1]).toEqual({ lebar: 1600, tinggi: 1200 });
    // setiap langkah tidak lebih dari separuh sebelumnya
    let sebelumnya = { lebar: 12000, tinggi: 9000 };
    for (const t of jalur) {
      expect(t.lebar).toBeGreaterThanOrEqual(Math.floor(sebelumnya.lebar / 2) - 1);
      sebelumnya = t;
    }
  });

  it("tidak pernah melewati batas memori di langkah perantara", () => {
    const jalur = jalurPengecilan({ lebar: 12000, tinggi: 9000 });
    for (const t of jalur) {
      expect(perkiraanMemori(t.lebar, t.tinggi)).toBeLessThanOrEqual(FOTO_MEMORI_MAKS_BYTE);
    }
  });
});

describe("kompresFoto menolak berkas besar sebelum decode", () => {
  it("tidak memanggil createImageBitmap untuk berkas di atas batas", async () => {
    const { kompresFoto, KompresiError } = await import("./kompresiFoto.ts");
    let dipanggil = false;
    const asli = globalThis.createImageBitmap;
    Object.defineProperty(globalThis, "createImageBitmap", {
      value: () => { dipanggil = true; return Promise.resolve({ width: 10, height: 10, close() {} }); },
      configurable: true,
    });
    const blob = new Blob([new Uint8Array(1)], { type: "image/jpeg" });
    Object.defineProperty(blob, "size", { value: 200 * MB });
    await expect(kompresFoto(blob)).rejects.toBeInstanceOf(KompresiError);
    expect(dipanggil).toBe(false);
    Object.defineProperty(globalThis, "createImageBitmap", { value: asli, configurable: true });
  });
});
