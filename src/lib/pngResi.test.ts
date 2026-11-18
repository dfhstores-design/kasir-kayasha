import { describe, expect, it } from "vitest";
import {
  buatPngResi,
  hitungTinggiPngResi,
  potongTeks,
  ukuranLogoPng,
  LEBAR_PNG_RESI,
} from "./pngResi.ts";
import type { BarisResi } from "./resi.ts";

const bitmap = (width: number, height: number) => ({ width, height }) as unknown as ImageBitmap;

describe("ukuranLogoPng", () => {
  it("tanpa logo -> 0x0", () => {
    expect(ukuranLogoPng(null)).toEqual({ lebar: 0, tinggi: 0 });
    expect(ukuranLogoPng(undefined)).toEqual({ lebar: 0, tinggi: 0 });
  });

  it("diskalakan ke maks 72pt seperti di PDF", () => {
    expect(ukuranLogoPng(bitmap(100, 100))).toEqual({ lebar: 106, tinggi: 106 });
    expect(ukuranLogoPng(bitmap(200, 50))).toEqual({ lebar: 106, tinggi: 27 });
  });
});

describe("potongTeks", () => {
  const ukur = (t: string) => t.length * 10;

  it("tidak memotong bila muat", () => {
    expect(potongTeks("Halo", 100, ukur)).toBe("Halo");
  });

  it("memotong + … bila melewati lebar maks", () => {
    expect(potongTeks("Halo dunia yang panjang", 100, ukur)).toBe("Halo duni…");
  });

  it("teks kosong tetap kosong", () => {
    expect(potongTeks("", 100, ukur)).toBe("");
  });
});

describe("hitungTinggiPngResi", () => {
  it("baris kosong -> hanya padding atas + bawah", () => {
    expect(hitungTinggiPngResi([])).toBe(56);
  });

  it("satu baris teks 10pt -> 56 + 15 + 6", () => {
    expect(hitungTinggiPngResi([{ jenis: "teks", teks: "Halo" }])).toBe(77);
  });

  it("garis dan kosong lebih pendek dari teks", () => {
    expect(hitungTinggiPngResi([{ jenis: "garis" }])).toBe(68);
    expect(hitungTinggiPngResi([{ jenis: "kosong" }])).toBe(65);
  });

  it("barang: nama + baris jumlah; keterangan & diskon menambah tinggi", () => {
    const polos: BarisResi[] = [
      { jenis: "barang", nama: "Blus Batik", jumlah: 2, hargaSatuan: 180000, subtotal: 360000 },
    ];
    const lengkap: BarisResi[] = [
      {
        jenis: "barang",
        nama: "Blus Batik",
        jumlah: 2,
        hargaSatuan: 180000,
        subtotal: 360000,
        keterangan: "Barang stok bazar",
        diskonPerUnit: 10000,
      },
    ];
    expect(hitungTinggiPngResi(polos)).toBe(96);
    expect(hitungTinggiPngResi(lengkap)).toBe(132);
  });

  it("kotak sorot 2 isi -> 56 + (tinggi kotak 92 + 6)", () => {
    const baris: BarisResi[] = [{ jenis: "kotak", judul: "TOTAL", isi: ["Rp365.000", "Lunas"], sorot: true }];
    expect(hitungTinggiPngResi(baris)).toBe(157);
  });

  it("kop: logo menentukan tinggi pita; tanpa logo hanya teks", () => {
    const denganLogo: BarisResi[] = [
      { jenis: "logo" },
      { jenis: "judul", teks: "KAYESA" },
      { jenis: "subjudul", teks: "KAYESA'S CLOTHING" },
    ];
    const tanpaLogo: BarisResi[] = [
      { jenis: "judul", teks: "KAYESA" },
      { jenis: "subjudul", teks: "KAYESA'S CLOTHING" },
    ];
    expect(hitungTinggiPngResi(denganLogo, { logo: bitmap(100, 100) })).toBe(174);
    expect(hitungTinggiPngResi(tanpaLogo)).toBe(110);
  });

  it("deterministik dan monoton: tambah baris -> tambah tinggi", () => {
    const baris: BarisResi[] = [
      { jenis: "logo" },
      { jenis: "judul", teks: "KAYESA" },
      { jenis: "subjudul", teks: "KAYESA'S CLOTHING" },
      { jenis: "lencana", teks: "LUNAS", varian: "status" },
      { jenis: "dokumen", judul: "RESI", subjudul: "No. KYS-0012" },
      { jenis: "teks", teks: "Terima kasih", tengah: true },
      { jenis: "garis" },
      { jenis: "kiriKanan", kiri: "Tanggal", kanan: "11 Nov 2026" },
      { jenis: "barang", nama: "Blus Batik", jumlah: 2, hargaSatuan: 180000, subtotal: 360000 },
      { jenis: "rincian", label: "Ongkir", nominal: 25000 },
      { jenis: "kotak", judul: "TOTAL", isi: ["Rp365.000"], sorot: true },
      { jenis: "metaPasangan", kiri: { label: "Kasir", nilai: "Tante" }, kanan: { label: "Metode", nilai: "Tunai" } },
      { jenis: "total", kiri: "TOTAL", kanan: "Rp365.000" },
      { jenis: "tandatangan", nama: "KAYESA'S CLOTHING" },
      { jenis: "kosong" },
    ];
    const logo = bitmap(100, 100);
    const a = hitungTinggiPngResi(baris, { logo });
    const b = hitungTinggiPngResi(baris, { logo });
    expect(a).toBe(b);
    expect(a).toBeGreaterThan(600);
    expect(hitungTinggiPngResi(baris)).toBeLessThan(a);
    expect(hitungTinggiPngResi([...baris, { jenis: "teks", teks: "Satu baris lagi" }], { logo })).toBeGreaterThan(a);
  });

  it("lebar PNG 620px", () => {
    expect(LEBAR_PNG_RESI).toBe(620);
  });
});

describe("buatPngResi", () => {
  it("menolak tanpa Canvas 2D (jsdom tidak punya kanvas)", async () => {
    await expect(buatPngResi([{ jenis: "teks", teks: "Halo" }])).rejects.toThrow("Canvas 2D tidak tersedia.");
  });
});
