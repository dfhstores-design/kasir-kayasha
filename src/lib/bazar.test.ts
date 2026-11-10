import { describe, expect, it } from "vitest";
import {
  biayaPadaHari,
  hitungRingkasanKeuangan,
  hitungUlangSisa,
  pesanSelisih,
  transaksiPadaHari,
  type BiayaRingkas,
  type TransaksiRingkas,
} from "./bazar.ts";

const t = (total: number, jenisBayar: TransaksiRingkas["jenisBayar"], dibatalkan = false, waktu = "2026-11-10T10:00:00.000Z"): TransaksiRingkas => ({
  total,
  jenisBayar,
  dibatalkan,
  waktu,
});

const b = (nominal: number, kategori: BiayaRingkas["kategori"] = "sewa_booth", tanggal = "2026-11-10"): BiayaRingkas => ({
  kategori,
  judul: "Biaya",
  nominal,
  tanggal,
});

describe("hitungRingkasanKeuangan", () => {
  it("menghitung omzet per metode bayar", () => {
    const r = hitungRingkasanKeuangan([t(100000, "tunai"), t(250000, "transfer"), t(50000, "qris")], []);
    expect(r.jumlahTransaksi).toBe(3);
    expect(r.omzet).toBe(400000);
    expect(r.tunai).toBe(100000);
    expect(r.transfer).toBe(250000);
    expect(r.qris).toBe(50000);
  });

  it("transaksi dibatalkan TIDAK masuk omzet", () => {
    const r = hitungRingkasanKeuangan([t(100000, "tunai"), t(999999, "tunai", true)], []);
    expect(r.jumlahTransaksi).toBe(1);
    expect(r.omzet).toBe(100000);
  });

  it("menghitung laba = omzet − biaya", () => {
    const r = hitungRingkasanKeuangan([t(1000000, "tunai")], [b(300000), b(200000, "transport")]);
    expect(r.totalBiaya).toBe(500000);
    expect(r.laba).toBe(500000);
  });

  it("laba boleh NEGATIF dan tidak dibulatkan ke nol", () => {
    const r = hitungRingkasanKeuangan([t(100000, "tunai")], [b(500000)]);
    expect(r.laba).toBe(-400000);
  });

  it("biaya per kategori dijumlah benar", () => {
    const r = hitungRingkasanKeuangan([], [b(100000, "sewa_booth"), b(50000, "sewa_booth"), b(25000, "konsumsi")]);
    expect(r.biayaPerKategori).toEqual([
      { kategori: "sewa_booth", total: 150000 },
      { kategori: "konsumsi", total: 25000 },
    ]);
  });

  it("transaksi tanpa metode bayar dipisah", () => {
    const r = hitungRingkasanKeuangan([t(75000, null)], []);
    expect(r.tanpaMetode).toBe(75000);
    expect(r.tunai).toBe(0);
  });

  it("data kosong menghasilkan nol, bukan error", () => {
    const r = hitungRingkasanKeuangan([], []);
    expect(r).toMatchObject({ jumlahTransaksi: 0, omzet: 0, totalBiaya: 0, laba: 0 });
  });
});

describe("filter harian", () => {
  it("transaksiPadaHari hanya hari tersebut", () => {
    const daftar = [t(1, "tunai", false, "2026-11-10T08:00:00.000Z"), t(2, "tunai", false, "2026-11-11T08:00:00.000Z")];
    expect(transaksiPadaHari(daftar, "2026-11-10")).toHaveLength(1);
  });

  it("biayaPadaHari hanya tanggal tersebut", () => {
    const daftar = [b(1000, "sewa_booth", "2026-11-10"), b(2000, "transport", "2026-11-11")];
    expect(biayaPadaHari(daftar, "2026-11-11")).toEqual([daftar[1]]);
  });
});

describe("hitungUlangSisa", () => {
  const baris = (nama: string, tercatat: number, fisik: number) => ({ produkId: nama, nama, tercatat, fisik });

  it("fisik sama dengan tercatat → selisih 0", () => {
    const h = hitungUlangSisa([baris("Blus", 9, 9)]);
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    expect(h.baris[0]).toMatchObject({ selisih: 0, dikembalikan: 9 });
    expect(h.adaSelisih).toBe(false);
    expect(pesanSelisih(h.baris)).toBeNull();
  });

  it("fisik lebih sedikit → selisih negatif (barang kurang)", () => {
    const h = hitungUlangSisa([baris("Blus", 9, 7)]);
    if (!h.ok) throw new Error("gagal");
    expect(h.baris[0]).toMatchObject({ selisih: -2, dikembalikan: 7 });
    expect(h.adaSelisih).toBe(true);
  });

  it("fisik lebih banyak → selisih positif (barang lebih)", () => {
    const h = hitungUlangSisa([baris("Blus", 9, 11)]);
    if (!h.ok) throw new Error("gagal");
    expect(h.baris[0]).toMatchObject({ selisih: 2, dikembalikan: 11 });
  });

  it("yang dikembalikan ke gudang = angka FISIK, bukan tercatat", () => {
    const h = hitungUlangSisa([baris("Blus", 9, 7)]);
    if (!h.ok) throw new Error("gagal");
    expect(h.baris[0]?.dikembalikan).toBe(7);
  });

  it("menolak fisik negatif", () => {
    expect(hitungUlangSisa([baris("Blus", 9, -1)])).toEqual({
      ok: false,
      pesan: "Perbaiki: hitungan Blus harus angka 0 atau lebih.",
    });
  });

  it("menolak fisik pecahan", () => {
    expect(hitungUlangSisa([baris("Blus", 9, 1.5)]).ok).toBe(false);
  });

  it("pesan peringatan menyebut jumlah barang selisih", () => {
    const h = hitungUlangSisa([baris("A", 5, 4), baris("B", 3, 3), baris("C", 2, 5)]);
    if (!h.ok) throw new Error("gagal");
    expect(pesanSelisih(h.baris)).toBe("2 barang selisih. Periksa lagi sebelum menutup.");
  });

  it("total selisih memakai nilai absolut", () => {
    const h = hitungUlangSisa([baris("A", 5, 4), baris("B", 3, 5)]);
    if (!h.ok) throw new Error("gagal");
    expect(h.baris[0]?.selisih).toBe(-1);
    expect(h.baris[1]?.selisih).toBe(2);
    expect(h.totalSelisih).toBe(3);
  });
});
