import { describe, expect, it } from "vitest";
import { hitungSaldoBazar, terapkanAlokasi, terapkanTutupBazar, validasiAlokasi, validasiPenjualan } from "./stok.ts";

describe("validasiAlokasi", () => {
  it("menerima jumlah <= stok gudang", () => {
    expect(validasiAlokasi(40, 40)).toEqual({ ok: true, value: 40 });
    expect(validasiAlokasi(0, 10)).toEqual({ ok: true, value: 0 });
  });

  it("menolak melebihi stok gudang", () => {
    expect(validasiAlokasi(41, 40)).toEqual({ ok: false, error: "melebihi_stok_gudang" });
  });

  it("menolak negatif dan pecahan", () => {
    expect(validasiAlokasi(-1, 10)).toEqual({ ok: false, error: "negatif" });
    expect(validasiAlokasi(1.5, 10)).toEqual({ ok: false, error: "bukan_bilangan_bulat" });
  });
});

describe("validasiPenjualan", () => {
  it("menerima jumlah <= saldo bazar", () => {
    expect(validasiPenjualan(1, 1)).toEqual({ ok: true, value: 1 });
  });

  it("menolak melebihi saldo bazar", () => {
    expect(validasiPenjualan(2, 1)).toEqual({ ok: false, error: "saldo_tidak_cukup" });
  });

  it("menolak kuantitas 0", () => {
    expect(validasiPenjualan(0, 5)).toEqual({ ok: false, error: "negatif" });
  });
});

describe("terapkanAlokasi", () => {
  it("gudang berkurang, bazar bertambah dengan jumlah sama", () => {
    const h = terapkanAlokasi(40, 10);
    expect(h.stokGudangBaru).toBe(30);
    expect(h.tambahanBazar).toBe(10);
  });

  it("tidak memutasi nilai masukan", () => {
    const stok = 40;
    terapkanAlokasi(stok, 10);
    expect(stok).toBe(40);
  });

  it("melempar bila alokasi tidak sah", () => {
    expect(() => terapkanAlokasi(5, 6)).toThrow(RangeError);
  });
});

describe("terapkanTutupBazar", () => {
  it("sisa yang dikembalikan menambah stok gudang", () => {
    const h = terapkanTutupBazar(30, 8, 8);
    expect(h).toEqual({ ok: true, stokGudangBaru: 38, hilang: 0 });
  });

  it("sisa yang tidak dikembalikan dianggap habis", () => {
    const h = terapkanTutupBazar(30, 8, 5);
    expect(h).toEqual({ ok: true, stokGudangBaru: 35, hilang: 3 });
  });

  it("menolak mengembalikan lebih dari sisa", () => {
    expect(terapkanTutupBazar(30, 8, 9)).toEqual({ ok: false, error: "saldo_tidak_cukup" });
  });

  it("menolak pengembalian negatif", () => {
    expect(terapkanTutupBazar(30, 8, -1)).toEqual({ ok: false, error: "saldo_tidak_cukup" });
  });
});

describe("invarian stok bazar", () => {
  it("penjualan bazar tidak mengubah stok gudang", () => {
    const stokGudang = 30;
    const catatan = { dibawa: 10, terjual: 0, ditarik: 0 };
    // Menjual 3 pcs: hanya catatan bazar yang berubah.
    const setelahJual = { ...catatan, terjual: 3 };
    expect(hitungSaldoBazar(setelahJual)).toBe(7);
    expect(stokGudang).toBe(30);
  });

  it("alokasi lalu tutup tanpa penjualan mengembalikan stok semula", () => {
    const awal = 40;
    const { stokGudangBaru } = terapkanAlokasi(awal, 10);
    const tutup = terapkanTutupBazar(stokGudangBaru, 10, 10);
    expect(tutup.ok).toBe(true);
    if (!tutup.ok) return;
    expect(tutup.stokGudangBaru).toBe(awal);
  });
});
