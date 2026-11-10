import { describe, expect, it } from "vitest";
import { diskonBaris, hitungKeranjang, hitungPembayaran, subtotalBersihBaris, type BarisKeranjang } from "./keranjang.ts";
import { hitungSaldoBazar } from "./stok.ts";
import type { Ongkir } from "./ongkir.ts";

const baris = (hargaSatuan: number, kuantitas: number, diskonPerUnit = 0, nama = "Barang"): BarisKeranjang => ({
  nama,
  hargaSatuan,
  kuantitas,
  diskonPerUnit,
});

const AMBIL: Ongkir = { mode: "ambil_sendiri", nominal: 0 };

describe("diskon per unit × kuantitas", () => {
  it("mengalikan dengan kuantitas, bukan sekali", () => {
    const b = baris(180000, 2, 10000);
    expect(diskonBaris(b)).toBe(20000);
    expect(subtotalBersihBaris(b)).toBe(340000);
  });
});

describe("hitungKeranjang", () => {
  it("menghitung rumus dasar tanpa diskon total", () => {
    const hasil = hitungKeranjang([baris(180000, 2, 10000), baris(220000, 1)], 0, AMBIL);
    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    expect(hasil.ringkasan).toMatchObject({
      subtotalAwal: 580000,
      diskonItem: 20000,
      subtotalSetelahDiskonItem: 560000,
      diskonTotal: 0,
      ongkirDitagihkan: 0,
      total: 560000,
      totalBelumTermasukOngkir: false,
    });
  });

  it("diskon total diterapkan SETELAH diskon item", () => {
    const hasil = hitungKeranjang([baris(180000, 2, 10000), baris(220000, 1)], 60000, AMBIL);
    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    // 580.000 − 20.000 = 560.000, lalu − 60.000 = 500.000
    expect(hasil.ringkasan.diskonTotal).toBe(60000);
    expect(hasil.ringkasan.total).toBe(500000);
  });

  it("mengizinkan diskon total tepat sama dengan subtotal setelah diskon item", () => {
    const hasil = hitungKeranjang([baris(100000, 1)], 100000, AMBIL);
    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    expect(hasil.ringkasan.total).toBe(0);
  });

  it("menolak diskon total melebihi subtotal setelah diskon item", () => {
    const hasil = hitungKeranjang([baris(100000, 1)], 100001, AMBIL);
    expect(hasil).toEqual({ ok: false, error: { kode: "diskon_total_melebihi_subtotal" } });
  });

  it("menolak diskon per unit melebihi harga satuan", () => {
    const hasil = hitungKeranjang([baris(50000, 1, 50001)], 0, AMBIL);
    expect(hasil).toEqual({ ok: false, error: { kode: "diskon_melebihi_harga", index: 0 } });
  });

  it("mengizinkan diskon per unit tepat sama dengan harga satuan", () => {
    const hasil = hitungKeranjang([baris(50000, 2, 50000)], 0, AMBIL);
    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    expect(hasil.ringkasan.total).toBe(0);
  });

  it("menolak kuantitas 0 atau negatif", () => {
    expect(hitungKeranjang([baris(1000, 0)])).toEqual({
      ok: false,
      error: { kode: "kuantitas_tidak_valid", index: 0 },
    });
  });

  it("menandai index baris yang salah", () => {
    const hasil = hitungKeranjang([baris(1000, 1), baris(1000, 1, 2000)]);
    expect(hasil).toEqual({ ok: false, error: { kode: "diskon_melebihi_harga", index: 1 } });
  });

  it("hasil tidak pernah negatif", () => {
    const hasil = hitungKeranjang([baris(0, 1)], 0, AMBIL);
    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    expect(hasil.ringkasan.total).toBe(0);
  });
});

describe("hitungKeranjang — ongkir", () => {
  it("ongkir butik masuk total", () => {
    const hasil = hitungKeranjang([baris(100000, 1)], 0, { mode: "butik", nominal: 25000 });
    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    expect(hasil.ringkasan.ongkirDitagihkan).toBe(25000);
    expect(hasil.ringkasan.total).toBe(125000);
  });

  it("ongkir kurir TIDAK masuk total", () => {
    const hasil = hitungKeranjang([baris(100000, 1)], 0, { mode: "kurir", nominal: 0 });
    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    expect(hasil.ringkasan.ongkirDitagihkan).toBe(0);
    expect(hasil.ringkasan.total).toBe(100000);
  });

  it("ongkir belum ditentukan: total belum final dan ditandai", () => {
    const hasil = hitungKeranjang([baris(100000, 1)], 0, { mode: "belum_ditentukan", nominal: null });
    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    expect(hasil.ringkasan.ongkirDitagihkan).toBe(0);
    expect(hasil.ringkasan.totalBelumTermasukOngkir).toBe(true);
  });

  it("setelah ongkir diisi, total bertambah sesuai nominal", () => {
    const sebelum = hitungKeranjang([baris(100000, 1)], 0, { mode: "belum_ditentukan", nominal: null });
    const sesudah = hitungKeranjang([baris(100000, 1)], 0, { mode: "butik", nominal: 20000 });
    expect(sebelum.ok && sesudah.ok).toBe(true);
    if (!sebelum.ok || !sesudah.ok) return;
    expect(sesudah.ringkasan.total - sebelum.ringkasan.total).toBe(20000);
  });
});

describe("hitungPembayaran", () => {
  it("tanpa pembayaran = belum dibayar", () => {
    const h = hitungPembayaran(100000, []);
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    expect(h.ringkasan).toEqual({ total: 100000, sudahDibayar: 0, sisa: 100000, status: "belum_dibayar" });
  });

  it("DP: sebagian dibayar", () => {
    const h = hitungPembayaran(100000, [30000]);
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    expect(h.ringkasan.status).toBe("dp");
    expect(h.ringkasan.sisa).toBe(70000);
  });

  it("beberapa pelunasan sampai lunas", () => {
    const h = hitungPembayaran(100000, [30000, 40000, 30000]);
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    expect(h.ringkasan.status).toBe("lunas");
    expect(h.ringkasan.sisa).toBe(0);
  });

  it("menolak pembayaran melebihi total", () => {
    expect(hitungPembayaran(100000, [100001])).toEqual({ ok: false, kode: "pembayaran_melebihi_total" });
  });

  it("menolak nominal negatif", () => {
    expect(hitungPembayaran(100000, [-1])).toEqual({ ok: false, kode: "pembayaran_melebihi_total" });
  });

  it("lunas menjadi DP lagi bila total bertambah oleh ongkir", () => {
    const awal = hitungPembayaran(100000, [100000]);
    const setelahOngkir = hitungPembayaran(120000, [100000]);
    expect(awal.ok && setelahOngkir.ok).toBe(true);
    if (!awal.ok || !setelahOngkir.ok) return;
    expect(awal.ringkasan.status).toBe("lunas");
    expect(setelahOngkir.ringkasan.status).toBe("dp");
    expect(setelahOngkir.ringkasan.sisa).toBe(20000);
  });
});

describe("hitungSaldoBazar", () => {
  it("saldo = dibawa − terjual − ditarik", () => {
    expect(hitungSaldoBazar({ dibawa: 10, terjual: 3, ditarik: 2 })).toBe(5);
    expect(hitungSaldoBazar({ dibawa: 0, terjual: 0, ditarik: 0 })).toBe(0);
  });
});
