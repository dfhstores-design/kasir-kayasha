/**
 * Tes integrasi aturan stok end-to-end (Phase 2).
 *
 * Aturan pemilik 10 Nov 2026:
 *   1. gudang berkurang saat barang DIBUKA ke bazar
 *   2. bazar berkurang saat PENJUALAN
 *   3. penjualan bazar TIDAK mengubah gudang
 */
import { beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { alokasikanKeBazar, buatBazar, daftarProduk, saldoBazarProduk, simpanProduk, simpanTransaksi } from "./repositori.ts";
import { resetKoneksiDB, type ProdukRecord, type TransaksiRecord, type UUID } from "./schema.ts";
import { sumberStokUntuk } from "../lib/sumberStok.ts";
import { sapaanDariWaktu } from "../lib/sapaan.ts";

function resetDB() {
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  resetKoneksiDB();
}

function produk(stokGudang: number): ProdukRecord {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    nama: "Blus Linen",
    kode: null,
    hargaJual: 180000,
    stokGudang,
    catatan: null,
    arsip: false,
    createdAt: now,
    updatedAt: now,
  };
}

function transaksi(bazarId: UUID | null, produkId: UUID, kuantitas: number): TransaksiRecord {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    nomorResi: "KYS-0001",
    nomorUrutHari: 1,
    waktu: now.toISOString(),
    jenis: "langsung",
    statusPesanan: "selesai",
    bazarId,
    namaPemesan: null,
    kontak: null,
    perkiraanSiap: null,
    alamat: null,
    catatanPesanan: null,
    riwayatTotal: [],
    ongkirMode: "ambil_sendiri",
    ongkirNominal: 0,
    subtotalAwal: 180000 * kuantitas,
    diskonItem: 0,
    diskonTotal: 0,
    total: 180000 * kuantitas,
    sapaan: sapaanDariWaktu(now),
    rekeningSnapshot: [],
    jenisBayar: "tunai",
    statusBayar: "lunas",
    dibatalkanPada: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ...(produkId ? { _produk: produkId } : {}),
  } as TransaksiRecord;
}

async function stokSekarang(): Promise<{ gudang: number; bazar: number }> {
  const p = (await daftarProduk())[0];
  if (!p) throw new Error("produk hilang");
  const b = (await import("./repositori.ts")).bazarAktif;
  const aktif = await b();
  const saldo = aktif ? await saldoBazarProduk(aktif.id, p.id) : 0;
  return { gudang: p.stokGudang, bazar: saldo };
}

describe("aturan stok end-to-end", () => {
  beforeEach(resetDB);

  it("(1) stok gudang berkurang saat dibawa ke bazar", async () => {
    const p = produk(40);
    await simpanProduk(p);
    const b = await buatBazar("Pameran", null, null);

    await alokasikanKeBazar(b.id, p.id, 10);

    expect(await stokSekarang()).toEqual({ gudang: 30, bazar: 10 });
  });

  it("(2) stok bazar berkurang saat penjualan", async () => {
    const p = produk(40);
    await simpanProduk(p);
    const b = await buatBazar("Pameran", null, null);
    await alokasikanKeBazar(b.id, p.id, 10);

    await simpanTransaksi(
      transaksi(b.id, p.id, 3),
      [],
      [],
      sumberStokUntuk([{ produkId: p.id, kuantitas: 3 }], b.id),
    );

    expect(await stokSekarang()).toEqual({ gudang: 30, bazar: 7 });
  });

  it("(3) penjualan bazar TIDAK mengubah stok gudang", async () => {
    const p = produk(40);
    await simpanProduk(p);
    const b = await buatBazar("Pameran", null, null);
    await alokasikanKeBazar(b.id, p.id, 10);

    const sebelum = await stokSekarang();
    await simpanTransaksi(transaksi(b.id, p.id, 5), [], [], sumberStokUntuk([{ produkId: p.id, kuantitas: 5 }], b.id));
    const sesudah = await stokSekarang();

    expect(sesudah.gudang).toBe(sebelum.gudang);
    expect(sesudah.bazar).toBe(5);
  });

  it("repository MENOLAK penjualan bazar yang memakai stok gudang", async () => {
    const p = produk(40);
    await simpanProduk(p);
    const b = await buatBazar("Pameran", null, null);
    await alokasikanKeBazar(b.id, p.id, 10);

    await expect(
      simpanTransaksi(transaksi(b.id, p.id, 1), [], [], [{ tipe: "gudang", produkId: p.id, jumlah: 1 }]),
    ).rejects.toThrow(/hanya mengurangi stok bazar/i);

    // Tidak ada perubahan sama sekali.
    expect(await stokSekarang()).toEqual({ gudang: 30, bazar: 10 });
  });

  it("repository MENOLAK penjualan melebihi saldo bazar", async () => {
    const p = produk(40);
    await simpanProduk(p);
    const b = await buatBazar("Pameran", null, null);
    await alokasikanKeBazar(b.id, p.id, 2);

    await expect(
      simpanTransaksi(transaksi(b.id, p.id, 3), [], [], sumberStokUntuk([{ produkId: p.id, kuantitas: 3 }], b.id)),
    ).rejects.toThrow(/stok bazar tidak cukup/i);

    expect(await stokSekarang()).toEqual({ gudang: 38, bazar: 2 });
  });

  it("penjualan di luar bazar mengurangi stok gudang, bukan bazar", async () => {
    const p = produk(40);
    await simpanProduk(p);
    const b = await buatBazar("Pameran", null, null);
    await alokasikanKeBazar(b.id, p.id, 10);

    await simpanTransaksi(transaksi(null, p.id, 4), [], [], sumberStokUntuk([{ produkId: p.id, kuantitas: 4 }], null));

    expect(await stokSekarang()).toEqual({ gudang: 26, bazar: 10 });
  });

  it("setelah dijual 3 dari 10: gudang 30, sisa bazar 7 (siap dikembalikan saat tutup)", async () => {
    const p = produk(40);
    await simpanProduk(p);
    const b = await buatBazar("Pameran", null, null);
    await alokasikanKeBazar(b.id, p.id, 10);
    await simpanTransaksi(transaksi(b.id, p.id, 3), [], [], sumberStokUntuk([{ produkId: p.id, kuantitas: 3 }], b.id));

    expect(await stokSekarang()).toEqual({ gudang: 30, bazar: 7 });
  });
});
