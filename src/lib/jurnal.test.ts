import { describe, expect, it } from "vitest";
import {
  buatBarisJurnalPembayaran,
  hitungKembalian,
  hitungSisa,
  isKategoriBawaan,
  KATEGORI_JURNAL,
  labelKategori,
  recomputeJurnalDariDokumen,
} from "./jurnal.ts";

describe("KATEGORI_JURNAL & kategori", () => {
  it("daftar bawaan lengkap (BU-06)", () => {
    expect(KATEGORI_JURNAL).toEqual([
      "penjualan",
      "dp",
      "pelunasan",
      "biaya_bahan",
      "upah",
      "listrik",
      "lain_lain",
    ]);
  });

  it("isKategoriBawaan bedakan bawaan vs isi sendiri", () => {
    expect(isKategoriBawaan("dp")).toBe(true);
    expect(isKategoriBawaan("pelunasan")).toBe(true);
    expect(isKategoriBawaan("jahit_baju")).toBe(false); // isi sendiri (custom)
  });

  it("labelKategori: bawaan bernama Indonesia, kustom apa adanya", () => {
    expect(labelKategori("biaya_bahan")).toBe("Biaya bahan");
    expect(labelKategori("lain_lain")).toBe("Lain-lain");
    expect(labelKategori("jahit_baju")).toBe("jahit_baju");
  });
});

describe("hitungSisa & hitungKembalian", () => {
  it("sisa = total − terbayar", () => {
    expect(hitungSisa(100000, 40000)).toBe(60000);
    expect(hitungSisa(100000, 100000)).toBe(0);
  });

  it("sisa tidak pernah negatif — bayar lebih jadi sisa 0 + kembalian", () => {
    expect(hitungSisa(100000, 120000)).toBe(0);
    expect(hitungKembalian(100000, 120000)).toBe(20000);
  });

  it("kembalian 0 bila tidak ada kelebihan", () => {
    expect(hitungKembalian(100000, 100000)).toBe(0);
    expect(hitungKembalian(100000, 40000)).toBe(0);
  });
});

describe("buatBarisJurnalPembayaran", () => {
  it("baris pemasukan dengan pemilik/sumber usaha", () => {
    const b = buatBarisJurnalPembayaran("dok-1", 30000, "dp", "2026-11-16T08:00:00Z");
    expect(b).toEqual({
      arah: "masuk",
      kategori: "dp",
      nominal: 30000,
      waktu: "2026-11-16T08:00:00Z",
      dokumenId: "dok-1",
      pemilik: "usaha",
      sumber: "usaha",
      catatan: null,
    });
  });

  it("tidak memakai id (id dibuat di lapisan penyimpanan)", () => {
    const b = buatBarisJurnalPembayaran("dok-1", 30000, "dp", "2026-11-16T08:00:00Z");
    expect(Object.hasOwn(b, "id")).toBe(false);
  });
});

describe("recomputeJurnalDariDokumen", () => {
  const dokumen = { id: "dok-1", total: 100000 };

  it("tanpa pembayaran = tanpa baris jurnal (berarti tidak ada uang yang dicatat)", () => {
    expect(recomputeJurnalDariDokumen(dokumen, [])).toEqual([]);
  });

  it("satu DP → satu baris masuk kategori dp", () => {
    const baris = recomputeJurnalDariDokumen(dokumen, [{ nominal: 40000, waktu: "2026-11-16T08:00:00Z" }]);
    expect(baris).toHaveLength(1);
    expect(baris[0]).toMatchObject({ arah: "masuk", kategori: "dp", nominal: 40000 });
  });

  it("pembayaran bertahap: dp dulu, pelunasan saat total terlunasi (BU-13)", () => {
    const baris = recomputeJurnalDariDokumen(dokumen, [
      { nominal: 40000, waktu: "2026-11-16T08:00:00Z" },
      { nominal: 60000, waktu: "2026-11-20T09:00:00Z" },
    ]);
    expect(baris).toHaveLength(2);
    expect(baris[0]?.kategori).toBe("dp");
    expect(baris[1]?.kategori).toBe("pelunasan");
    expect(baris.map((b) => b.nominal)).toEqual([40000, 60000]);
  });

  it("bayar lebih: pelunasan tetap dicatat UTUH, bukan dipotong (BU-08.A, BU-17.B)", () => {
    const baris = recomputeJurnalDariDokumen(dokumen, [
      { nominal: 50000, waktu: "2026-11-16T08:00:00Z" },
      { nominal: 70000, waktu: "2026-11-20T09:00:00Z" }, // melebihi sisa 50000
    ]);
    expect(baris[1]).toMatchObject({ kategori: "pelunasan", nominal: 70000 });
  });

  it("hanya mencatat uang yang bergerak — total/sisa tidak pernah jadi baris", () => {
    const baris = recomputeJurnalDariDokumen(dokumen, [{ nominal: 40000, waktu: "t" }]);
    expect(baris.every((b) => b.nominal !== 100000 && b.nominal !== 60000)).toBe(true);
  });

  it("tiap baris menunjuk dokumen asal", () => {
    const baris = recomputeJurnalDariDokumen(dokumen, [{ nominal: 40000, waktu: "t" }]);
    expect(baris[0]?.dokumenId).toBe("dok-1");
  });
});