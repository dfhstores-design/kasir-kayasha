import { beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  formatNomorResi,
  nomorUrutBerikutnya,
  periksaRencana,
  simpanPenjualan,
  type ItemPilihan,
  type RencanaPenjualan,
} from "./penjualan.ts";
import { alokasikanKeBazar, buatBazar, daftarProduk, daftarTransaksi, saldoBazarProduk, simpanProduk } from "../db/repositori.ts";
import { resetKoneksiDB, type ProdukRecord } from "../db/schema.ts";

function resetDB() {
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  resetKoneksiDB();
}

async function produkBaru(nama: string, hargaJual: number, stokGudang: number): Promise<ProdukRecord> {
  const now = new Date().toISOString();
  const p: ProdukRecord = {
    id: crypto.randomUUID(),
    nama,
    kode: null,
    hargaJual,
    stokGudang,
    catatan: null,
    arsip: false,
    createdAt: now,
    updatedAt: now,
  };
  await simpanProduk(p);
  return p;
}

const item = (p: ProdukRecord, kuantitas: number, diskonPerUnit = 0): ItemPilihan => ({
  produkId: p.id,
  nama: p.nama,
  hargaSatuan: p.hargaJual,
  kuantitas,
  diskonPerUnit,
});

function rencana(over: Partial<RencanaPenjualan> = {}): RencanaPenjualan {
  return {
    items: [],
    diskonTotal: 0,
    ongkir: { mode: "ambil_sendiri", nominal: 0 },
    jenisBayar: "tunai",
    statusBayar: "lunas",
    dibayarSekarang: 0,
    bazarId: null,
    ...over,
  };
}

describe("formatNomorResi", () => {
  it("empat digit dan berurutan", () => {
    expect(formatNomorResi(1)).toBe("KYS-0001");
    expect(formatNomorResi(12)).toBe("KYS-0012");
    expect(formatNomorResi(1234)).toBe("KYS-1234");
  });

  it("nomor urut = jumlah + 1", () => {
    expect(nomorUrutBerikutnya(0)).toBe(1);
    expect(nomorUrutBerikutnya(11)).toBe(12);
  });
});

describe("periksaRencana", () => {
  it("menolak keranjang kosong", () => {
    expect(periksaRencana(rencana())).toEqual({ ok: false, pesan: "Keranjang belum ada barang." });
  });

  it("menghitung total dengan diskon item & total", () => {
    const h = periksaRencana(
      rencana({
        items: [
          { produkId: "a", nama: "Blus", hargaSatuan: 180000, kuantitas: 2, diskonPerUnit: 10000 },
          { produkId: "b", nama: "Rok", hargaSatuan: 220000, kuantitas: 1, diskonPerUnit: 0 },
        ],
        diskonTotal: 60000,
      }),
    );
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    // 580.000 − 20.000 = 560.000 − 60.000 = 500.000
    expect(h.total).toBe(500000);
    expect(h.sudahDibayar).toBe(500000);
    expect(h.sisa).toBe(0);
    expect(h.status).toBe("lunas");
  });

  it("menolak diskon per unit melebihi harga", () => {
    const h = periksaRencana(
      rencana({ items: [{ produkId: "a", nama: "Blus", hargaSatuan: 50000, kuantitas: 1, diskonPerUnit: 60000 }] }),
    );
    expect(h).toEqual({ ok: false, pesan: "Diskon tidak boleh lebih dari harga Blus." });
  });

  it("menolak diskon total melebihi subtotal", () => {
    const h = periksaRencana(
      rencana({ items: [{ produkId: "a", nama: "Blus", hargaSatuan: 50000, kuantitas: 1, diskonPerUnit: 0 }], diskonTotal: 60000 }),
    );
    expect(h).toEqual({ ok: false, pesan: "Diskon total melebihi sisa subtotal." });
  });

  it("status belum dibayar: sudah dibayar 0", () => {
    const h = periksaRencana(
      rencana({
        items: [{ produkId: "a", nama: "Blus", hargaSatuan: 100000, kuantitas: 1, diskonPerUnit: 0 }],
        statusBayar: "belum_dibayar",
      }),
    );
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    expect(h.sudahDibayar).toBe(0);
    expect(h.sisa).toBe(100000);
    expect(h.status).toBe("belum_dibayar");
  });

  it("DP harus di antara 0 dan total", () => {
    const dasar = {
      items: [{ produkId: "a", nama: "Blus", hargaSatuan: 100000, kuantitas: 1, diskonPerUnit: 0 }],
      statusBayar: "dp" as const,
    };
    expect(periksaRencana(rencana({ ...dasar, dibayarSekarang: 0 }))).toEqual({
      ok: false,
      pesan: "DP harus lebih dari 0 dan kurang dari total.",
    });
    expect(periksaRencana(rencana({ ...dasar, dibayarSekarang: 100000 }))).toEqual({
      ok: false,
      pesan: "DP harus lebih dari 0 dan kurang dari total.",
    });
    const h = periksaRencana(rencana({ ...dasar, dibayarSekarang: 30000 }));
    expect(h.ok && h.status).toBe("dp");
  });

  it("ongkir butik menambah total; ongkir belum ditentukan menandai", () => {
    const dasar = { items: [{ produkId: "a", nama: "Blus", hargaSatuan: 100000, kuantitas: 1, diskonPerUnit: 0 }] };
    const kirim = periksaRencana(rencana({ ...dasar, ongkir: { mode: "butik", nominal: 25000 } }));
    const belum = periksaRencana(rencana({ ...dasar, ongkir: { mode: "belum_ditentukan", nominal: null } }));
    expect(kirim.ok && kirim.total).toBe(125000);
    expect(belum.ok && belum.totalBelumTermasukOngkir).toBe(true);
  });
});

describe("simpanPenjualan", () => {
  beforeEach(resetDB);

  it("menyimpan transaksi, mengurangi stok gudang, membuat nomor resi", async () => {
    const blus = await produkBaru("Blus Linen", 180000, 5);

    const h = await simpanPenjualan(rencana({ items: [item(blus, 2)] }), { rekening: [] });

    expect(h.ok).toBe(true);
    if (!h.ok) return;
    expect(h.transaksi.nomorResi).toBe("KYS-0001");
    expect(h.transaksi.total).toBe(360000);
    expect((await daftarProduk())[0]?.stokGudang).toBe(3);
    expect(await daftarTransaksi()).toHaveLength(1);
  });

  it("nomor resi berurutan untuk transaksi berikutnya", async () => {
    const blus = await produkBaru("Blus", 100000, 10);
    await simpanPenjualan(rencana({ items: [item(blus, 1)] }), { rekening: [] });
    const kedua = await simpanPenjualan(rencana({ items: [item(blus, 1)] }), { rekening: [] });
    expect(kedua.ok && kedua.transaksi.nomorResi).toBe("KYS-0002");
  });

  it("menyimpan snapshot nama & harga sehingga katalog berubah tidak mengubah riwayat", async () => {
    const blus = await produkBaru("Blus Linen", 180000, 5);
    const h = await simpanPenjualan(rencana({ items: [item(blus, 1)] }), { rekening: [] });
    if (!h.ok) throw new Error("gagal");

    // Pemilik mengganti nama & harga barang.
    const setelah = (await daftarProduk())[0];
    if (!setelah) throw new Error("hilang");
    await simpanProduk({ ...setelah, nama: "Blus Baru", hargaJual: 999000 });

    const { ambilTransaksi } = await import("../db/repositori.ts");
    const lengkap = await ambilTransaksi(h.transaksi.id);
    expect(lengkap?.item[0]?.namaSnapshot).toBe("Blus Linen");
    expect(lengkap?.item[0]?.hargaSatuan).toBe(180000);
    expect(lengkap?.transaksi.total).toBe(180000);
  });

  it("menolak penjualan melebihi stok gudang tanpa mengubah apa pun", async () => {
    const blus = await produkBaru("Blus", 100000, 1);
    const h = await simpanPenjualan(rencana({ items: [item(blus, 5)] }), { rekening: [] });
    expect(h.ok).toBe(false);
    if (h.ok) return;
    expect(h.pesan).toMatch(/stok gudang tidak cukup/i);
    expect((await daftarProduk())[0]?.stokGudang).toBe(1);
    expect(await daftarTransaksi()).toHaveLength(0);
  });

  it("di bazar: gudang tetap, saldo bazar berkurang", async () => {
    const blus = await produkBaru("Blus", 180000, 20);
    const b = await buatBazar("Pameran", null, null);
    await alokasikanKeBazar(b.id, blus.id, 10);

    const h = await simpanPenjualan(rencana({ items: [item(blus, 3)], bazarId: b.id }), { rekening: [] });

    expect(h.ok).toBe(true);
    expect((await daftarProduk())[0]?.stokGudang).toBe(10); // 20 − 10 alokasi, penjualan tidak menyentuh
    expect(await saldoBazarProduk(b.id, blus.id)).toBe(7);
  });

  it("mencatat pembayaran DP", async () => {
    const blus = await produkBaru("Blus", 100000, 5);
    const h = await simpanPenjualan(
      rencana({ items: [item(blus, 1)], statusBayar: "dp", dibayarSekarang: 30000 }),
      { rekening: [] },
    );
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    expect(h.transaksi.status).toBe("dp");
    expect(h.transaksi.sisa).toBe(70000);

    const { ambilTransaksi } = await import("../db/repositori.ts");
    const lengkap = await ambilTransaksi(h.transaksi.id);
    expect(lengkap?.pembayaran).toHaveLength(1);
    expect(lengkap?.pembayaran[0]?.nominal).toBe(30000);
  });

  it("menyimpan snapshot rekening", async () => {
    const blus = await produkBaru("Blus", 100000, 5);
    const rekening = [{ id: "r1", namaBank: "BNI", nomor: "123", namaPemilik: "Siti", utama: true }];
    const h = await simpanPenjualan(rencana({ items: [item(blus, 1)] }), { rekening });
    if (!h.ok) throw new Error("gagal");
    const { ambilTransaksi } = await import("../db/repositori.ts");
    expect((await ambilTransaksi(h.transaksi.id))?.transaksi.rekeningSnapshot).toEqual(rekening);
  });
});
