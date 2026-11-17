import { describe, expect, it } from "vitest";
import {
  BATAS_RIWAYAT_AWAL,
  batasiRiwayat,
  labelJenisDokumen,
  labelMetodeBayar,
  ringkasItem,
  urutRiwayatBaruDulu,
} from "./Ringkasan.tsx";

describe("labelJenisDokumen", () => {
  it("memberi label Indonesia untuk tiap jenis dokumen", () => {
    expect(labelJenisDokumen("penjualan")).toBe("Penjualan");
    expect(labelJenisDokumen("pesanan")).toBe("Pesanan");
    expect(labelJenisDokumen("jasa")).toBe("Jahit");
  });
});

describe("ringkasItem", () => {
  it("tanpa item → —", () => {
    expect(ringkasItem([])).toBe("—");
  });

  it("satu dan dua item disebut semua dengan kuantitas", () => {
    expect(ringkasItem([{ namaSnapshot: "Kemeja", kuantitas: 2 }])).toBe("Kemeja ×2");
    expect(
      ringkasItem([
        { namaSnapshot: "Kemeja", kuantitas: 2 },
        { namaSnapshot: "Celana", kuantitas: 1 },
      ]),
    ).toBe("Kemeja ×2, Celana ×1");
  });

  it("lebih dari dua item dipotong dengan hitungan sisa", () => {
    expect(
      ringkasItem([
        { namaSnapshot: "A", kuantitas: 1 },
        { namaSnapshot: "B", kuantitas: 1 },
        { namaSnapshot: "C", kuantitas: 3 },
      ]),
    ).toBe("A ×1, B ×1 dan 1 barang lain");
  });
});

describe("labelMetodeBayar", () => {
  it("memakai jenisBayar bila ada", () => {
    expect(labelMetodeBayar("tunai", [])).toBe("Tunai");
    expect(labelMetodeBayar("transfer", [])).toBe("Transfer");
    expect(labelMetodeBayar("qris", [])).toBe("QRIS");
  });

  it("tanpa jenisBayar memakai metode pembayaran terakhir (pesanan jahit / PO)", () => {
    expect(
      labelMetodeBayar(null, [
        { metode: "tunai", waktu: "2026-11-10T10:00:00.000Z" },
        { metode: "transfer", waktu: "2026-11-11T10:00:00.000Z" },
      ]),
    ).toBe("Transfer");
  });

  it("tanpa jenisBayar dan tanpa pembayaran → —", () => {
    expect(labelMetodeBayar(null, [])).toBe("—");
  });
});

describe("urutRiwayatBaruDulu", () => {
  it("mengurutkan terbaru dulu", () => {
    const daftar = [
      { waktu: "2026-11-10T10:00:00.000Z", id: "lama" },
      { waktu: "2026-11-12T10:00:00.000Z", id: "baru" },
    ];
    expect(urutRiwayatBaruDulu(daftar).map((t) => t.id)).toEqual(["baru", "lama"]);
  });
});

describe("batasiRiwayat", () => {
  const daftar = Array.from({ length: 25 }, (_, i) => i);

  it("tampilan awal dibatasi 20 terbaru", () => {
    expect(BATAS_RIWAYAT_AWAL).toBe(20);
    expect(batasiRiwayat(daftar, false)).toHaveLength(20);
    expect(batasiRiwayat(daftar, false)[0]).toBe(0);
  });

  it("tampilkan semua mengembalikan seluruh daftar", () => {
    expect(batasiRiwayat(daftar, true)).toHaveLength(25);
  });
});
