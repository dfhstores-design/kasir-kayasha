/**
 * Tes bazar end-to-end (Phase 3B): buka → alokasi → jual → tarik → tutup.
 *
 * Aturan yang dikunci:
 *   gudang berkurang saat dibawa, bazar berkurang saat dijual,
 *   sisa yang dikembalikan menambah gudang, sisa yang tidak dikembalikan dianggap habis.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  adaParkirUntukBazar,
  alokasikanKeBazar,
  buatBazar,
  daftarBazar,
  daftarProduk,
  itemBazar,
  ringkasanBazar,
  saldoBazarProduk,
  simpanParkir,
  simpanProduk,
  simpanTransaksi,
  tarikDariBazar,
  tutupBazar,
} from "./repositori.ts";
import { resetKoneksiDB, type ProdukRecord, type TransaksiRecord, type UUID } from "./schema.ts";
import { sumberStokUntuk } from "../lib/sumberStok.ts";
import { sapaanDariWaktu } from "../lib/sapaan.ts";

function resetDB() {
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  resetKoneksiDB();
}

async function produkBaru(nama: string, stok: number): Promise<ProdukRecord> {
  const now = new Date().toISOString();
  const p: ProdukRecord = {
    id: crypto.randomUUID(),
    nama,
    kode: null,
    hargaJual: 100000,
    stokGudang: stok,
    catatan: null,
    arsip: false,
    createdAt: now,
    updatedAt: now,
  };
  await simpanProduk(p);
  return p;
}

function trx(bazarId: UUID | null, total: number): TransaksiRecord {
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
    ongkirMode: "ambil_sendiri",
    ongkirNominal: 0,
    subtotalAwal: total,
    diskonItem: 0,
    diskonTotal: 0,
    total,
    sapaan: sapaanDariWaktu(now),
    rekeningSnapshot: [],
    jenisBayar: "tunai",
    statusBayar: "lunas",
    dibatalkanPada: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

async function stokGudang(produkId: UUID): Promise<number> {
  const p = (await daftarProduk(true)).find((x) => x.id === produkId);
  return p?.stokGudang ?? -1;
}

describe("tarikDariBazar", () => {
  beforeEach(resetDB);

  it("menambah stok gudang dan mengurangi saldo bazar", async () => {
    const p = await produkBaru("Blus", 40);
    const b = await buatBazar("Pameran", null, null);
    await alokasikanKeBazar(b.id, p.id, 10);

    await tarikDariBazar(b.id, p.id, 4);

    expect(await stokGudang(p.id)).toBe(34); // 40 − 10 + 4
    expect(await saldoBazarProduk(b.id, p.id)).toBe(6);
  });

  it("menolak menarik lebih dari sisa", async () => {
    const p = await produkBaru("Blus", 40);
    const b = await buatBazar("Pameran", null, null);
    await alokasikanKeBazar(b.id, p.id, 5);
    await expect(tarikDariBazar(b.id, p.id, 6)).rejects.toThrow(/melebihi sisa/i);
    expect(await saldoBazarProduk(b.id, p.id)).toBe(5);
  });
});

describe("ringkasanBazar", () => {
  beforeEach(resetDB);

  it("menghitung dibawa, terjual, sisa, dan uang masuk", async () => {
    const p = await produkBaru("Blus", 40);
    const b = await buatBazar("Pameran", null, null);
    await alokasikanKeBazar(b.id, p.id, 10);
    await simpanTransaksi(trx(b.id, 300000), [], [], sumberStokUntuk([{ produkId: p.id, kuantitas: 3 }], b.id));

    const r = await ringkasanBazar(b.id);
    expect(r).toMatchObject({ dibawa: 10, terjualPcs: 3, sisaPcs: 7, uangMasuk: 300000, jumlahBarang: 1 });
  });
});

describe("tutupBazar", () => {
  beforeEach(resetDB);

  it("mengembalikan sisa ke gudang dan menandai bazar selesai", async () => {
    const p = await produkBaru("Blus", 40);
    const b = await buatBazar("Pameran", null, null);
    await alokasikanKeBazar(b.id, p.id, 10);
    await simpanTransaksi(trx(b.id, 300000), [], [], sumberStokUntuk([{ produkId: p.id, kuantitas: 3 }], b.id));

    // sisa 7, semua dikembalikan
    const h = await tutupBazar(b.id, new Map());

    expect(h).toEqual({ ok: true, dikembalikan: 7, hilang: 0, selisih: 0 });
    expect(await stokGudang(p.id)).toBe(37); // 40 − 10 + 7
    expect(await saldoBazarProduk(b.id, p.id)).toBe(0);

    const bazar = (await daftarBazar()).find((x) => x.id === b.id);
    expect(bazar?.status).toBe("selesai");
    expect(bazar?.ringkasanDibawa).toBe(10);
    expect(bazar?.ringkasanTerjual).toBe(3);
    expect(bazar?.ringkasanSisa).toBe(7);
    expect(bazar?.ditutupPada).not.toBeNull();
  });

  it("sisa yang tidak dikembalikan dianggap habis dan TIDAK masuk gudang", async () => {
    const p = await produkBaru("Blus", 40);
    const b = await buatBazar("Pameran", null, null);
    await alokasikanKeBazar(b.id, p.id, 10);

    // hanya 4 dari 10 yang kembali → selisih 6 tercatat
    const h = await tutupBazar(b.id, new Map([[p.id, 4]]));

    expect(h).toEqual({ ok: true, dikembalikan: 4, hilang: 6, selisih: 6 });
    expect(await stokGudang(p.id)).toBe(34);
    expect(await saldoBazarProduk(b.id, p.id)).toBe(0);

    const item = (await itemBazar(b.id))[0];
    expect(item?.selisih).toBe(6);
  });

  it("hitung ulang fisik LEBIH banyak dikembalikan apa adanya dan selisih negatif", async () => {
    const p = await produkBaru("Blus", 40);
    const b = await buatBazar("Pameran", null, null);
    await alokasikanKeBazar(b.id, p.id, 10);

    // fisik 12 (lebih 2) → gudang bertambah 12
    const h = await tutupBazar(b.id, new Map([[p.id, 12]]));

    expect(h).toEqual({ ok: true, dikembalikan: 12, hilang: 0, selisih: 2 });
    expect(await stokGudang(p.id)).toBe(42);
    const item = (await itemBazar(b.id))[0];
    expect(item?.selisih).toBe(-2);
  });

  it("menolak angka pengembalian negatif", async () => {
    const p = await produkBaru("Blus", 40);
    const b = await buatBazar("Pameran", null, null);
    await alokasikanKeBazar(b.id, p.id, 5);

    const h = await tutupBazar(b.id, new Map([[p.id, -1]]));
    expect(h.ok).toBe(false);
    expect(await stokGudang(p.id)).toBe(35);
  });

  it("ditolak bila masih ada transaksi tertahan milik bazar", async () => {
    const p = await produkBaru("Blus", 40);
    const b = await buatBazar("Pameran", null, null);
    await alokasikanKeBazar(b.id, p.id, 10);
    await simpanParkir({
      namaPembeli: "Bu Dewi",
      isi: [{ produkId: p.id, nama: "Blus", hargaSatuan: 100000, kuantitas: 1, diskonPerUnit: 0 }],
      diskonTotal: 0,
      ongkirMode: "ambil_sendiri",
      ongkirNominal: 0,
      jenisBayar: "tunai",
      bazarId: b.id,
    });

    expect(await adaParkirUntukBazar(b.id)).toBe(true);
    const h = await tutupBazar(b.id, new Map());
    expect(h.ok).toBe(false);
    const bazar = (await daftarBazar()).find((x) => x.id === b.id);
    expect(bazar?.status).toBe("aktif");
  });

  it("bazar boleh dibuka lagi setelah yang lama ditutup", async () => {
    const p = await produkBaru("Blus", 40);
    const b = await buatBazar("Bazar 1", null, null);
    await alokasikanKeBazar(b.id, p.id, 5);
    await tutupBazar(b.id, new Map());

    const b2 = await buatBazar("Bazar 2", null, null);
    expect(b2.status).toBe("aktif");
    expect((await daftarBazar()).filter((x) => x.status === "aktif")).toHaveLength(1);
  });
});

describe("itemBazar", () => {
  beforeEach(resetDB);

  it("mencatat dibawa, terjual, ditarih secara terpisah", async () => {
    const p = await produkBaru("Blus", 40);
    const b = await buatBazar("Pameran", null, null);
    await alokasikanKeBazar(b.id, p.id, 10);
    await simpanTransaksi(trx(b.id, 100000), [], [], sumberStokUntuk([{ produkId: p.id, kuantitas: 2 }], b.id));
    await tarikDariBazar(b.id, p.id, 3);

    const item = (await itemBazar(b.id))[0];
    expect(item).toMatchObject({ dibawa: 10, terjual: 2, ditarik: 3 });
  });
});
