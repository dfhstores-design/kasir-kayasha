import { describe, expect, it } from "vitest";
import { sumberStokUntuk, validasiSumberStok } from "./sumberStok.ts";

const P = "produk-1";
const B = "bazar-1";

describe("sumberStokUntuk", () => {
  it("tanpa bazar → memakai stok gudang", () => {
    expect(sumberStokUntuk([{ produkId: P, kuantitas: 2 }], null)).toEqual([
      { tipe: "gudang", produkId: P, jumlah: 2 },
    ]);
  });

  it("dengan bazar → memakai saldo bazar, bukan gudang", () => {
    expect(sumberStokUntuk([{ produkId: P, kuantitas: 2 }], B)).toEqual([
      { tipe: "bazar", produkId: P, bazarId: B, jumlah: 2 },
    ]);
  });
});

describe("validasiSumberStok", () => {
  it("menolak penjualan bazar yang mencoba mengurangi gudang", () => {
    const hasil = validasiSumberStok([{ tipe: "gudang", produkId: P, jumlah: 1 }], B);
    expect(hasil).toEqual({
      ok: false,
      kode: "penjualan_bazar_tidak_boleh_mengurangi_gudang",
      produkId: P,
    });
  });

  it("menolak saldo bazar dipotong saat tidak ada bazar", () => {
    const hasil = validasiSumberStok([{ tipe: "bazar", produkId: P, bazarId: B, jumlah: 1 }], null);
    expect(hasil).toEqual({ ok: false, kode: "tidak_ada_bazar_aktif", produkId: P });
  });

  it("menolak bazar yang berbeda dari transaksi", () => {
    const hasil = validasiSumberStok([{ tipe: "bazar", produkId: P, bazarId: "lain", jumlah: 1 }], B);
    expect(hasil).toEqual({ ok: false, kode: "tidak_ada_bazar_aktif", produkId: P });
  });

  it("menolak jumlah 0 atau negatif", () => {
    expect(validasiSumberStok([{ tipe: "gudang", produkId: P, jumlah: 0 }], null)).toEqual({
      ok: false,
      kode: "jumlah_tidak_valid",
      produkId: P,
    });
  });

  it("menerima kombinasi yang benar", () => {
    expect(validasiSumberStok(sumberStokUntuk([{ produkId: P, kuantitas: 3 }], B), B)).toEqual({ ok: true });
    expect(validasiSumberStok(sumberStokUntuk([{ produkId: P, kuantitas: 3 }], null), null)).toEqual({ ok: true });
  });
});
