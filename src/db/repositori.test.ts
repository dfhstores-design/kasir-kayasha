import { beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  MAKS_FOTO,
  MAKS_PARKIR,
  alokasikanKeBazar,
  ambilSettings,
  buatBazar,
  daftarParkir,
  daftarProduk,
  hapusParkir,
  saldoBazarProduk,
  simpanParkir,
  simpanProduk,
  tambahFoto,
} from "./repositori.ts";
import { resetKoneksiDB, type ProdukRecord } from "./schema.ts";

/** IndexedDB bersih untuk setiap tes. */
function resetDB() {
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  resetKoneksiDB();
}

function produk(over: Partial<ProdukRecord> = {}): ProdukRecord {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    nama: "Blus Linen",
    kode: null,
    hargaJual: 180000,
    stokGudang: 40,
    catatan: null,
    arsip: false,
    createdAt: now,
    updatedAt: now,
    ...over,
  };
}

const blob = () => new Blob([new Uint8Array([1, 2, 3])], { type: "image/webp" });

describe("settings", () => {
  beforeEach(resetDB);

  it("mengembalikan nilai kosong bila belum pernah disimpan", async () => {
    const s = await ambilSettings();
    expect(s.id).toBe("utama");
    expect(s.namaButik).toBe("");
    expect(s.rekening).toEqual([]);
  });
});

describe("produk", () => {
  beforeEach(resetDB);

  it("menyimpan dan membaca kembali", async () => {
    const p = produk();
    await simpanProduk(p);
    const semua = await daftarProduk();
    expect(semua).toHaveLength(1);
    expect(semua[0]?.nama).toBe("Blus Linen");
  });

  it("menyembunyikan barang diarsipkan secara bawaan", async () => {
    await simpanProduk(produk({ nama: "Aktif" }));
    await simpanProduk(produk({ nama: "Lama", arsip: true }));
    expect((await daftarProduk()).map((p) => p.nama)).toEqual(["Aktif"]);
    expect((await daftarProduk(true)).map((p) => p.nama).sort()).toEqual(["Aktif", "Lama"]);
  });

  it("mengurutkan nama A–Z", async () => {
    await simpanProduk(produk({ nama: "Rok" }));
    await simpanProduk(produk({ nama: "Blus" }));
    expect((await daftarProduk()).map((p) => p.nama)).toEqual(["Blus", "Rok"]);
  });
});

describe("foto produk", () => {
  beforeEach(resetDB);

  it("menerima maksimal 3 foto", async () => {
    const p = produk();
    await simpanProduk(p);
    for (let i = 1; i <= MAKS_FOTO; i++) {
      const h = await tambahFoto(p.id, blob(), "image/webp");
      expect(h.ok).toBe(true);
    }
    const lebih = await tambahFoto(p.id, blob(), "image/webp");
    expect(lebih).toEqual({ ok: false, kode: "maksimal_foto" });
  });
});

describe("bazar", () => {
  beforeEach(resetDB);

  it("hanya boleh satu bazar aktif", async () => {
    await buatBazar("Bazar A", null, null);
    await expect(buatBazar("Bazar B", null, null)).rejects.toThrow(/bazar aktif/i);
  });

  it("alokasi mengurangi stok gudang dan menambah saldo bazar", async () => {
    const p = produk({ stokGudang: 40 });
    await simpanProduk(p);
    const b = await buatBazar("Bazar A", null, null);

    await alokasikanKeBazar(b.id, p.id, 10);

    const setelah = (await daftarProduk())[0];
    expect(setelah?.stokGudang).toBe(30);
    expect(await saldoBazarProduk(b.id, p.id)).toBe(10);
  });

  it("menolak alokasi melebihi stok gudang", async () => {
    const p = produk({ stokGudang: 3 });
    await simpanProduk(p);
    const b = await buatBazar("Bazar A", null, null);
    await expect(alokasikanKeBazar(b.id, p.id, 4)).rejects.toThrow(/melebihi stok/i);
    expect((await daftarProduk())[0]?.stokGudang).toBe(3);
  });

  it("saldo bazar 0 untuk barang yang belum dibawa", async () => {
    const p = produk();
    await simpanProduk(p);
    const b = await buatBazar("Bazar A", null, null);
    expect(await saldoBazarProduk(b.id, p.id)).toBe(0);
  });
});

describe("parkir", () => {
  beforeEach(resetDB);

  const isi = {
    namaPembeli: "Bu Dewi",
    isi: [{ produkId: "p1", nama: "Blus", hargaSatuan: 180000, kuantitas: 2, diskonPerUnit: 0 }],
    diskonTotal: 0,
    ongkirMode: "ambil_sendiri" as const,
    ongkirNominal: 0,
    jenisBayar: "tunai" as const,
    bazarId: null,
  };

  it("menyimpan parkir beserta nama pembeli", async () => {
    const h = await simpanParkir(isi);
    expect(h.ok).toBe(true);
    const semua = await daftarParkir();
    expect(semua).toHaveLength(1);
    expect(semua[0]?.namaPembeli).toBe("Bu Dewi");
  });

  it("maksimal 3 parkir", async () => {
    for (let i = 1; i <= MAKS_PARKIR; i++) {
      const h = await simpanParkir({ ...isi, namaPembeli: `Pembeli ${i}` });
      expect(h.ok).toBe(true);
    }
    const lebih = await simpanParkir({ ...isi, namaPembeli: "Keempat" });
    expect(lebih).toEqual({ ok: false, kode: "maksimal_parkir" });
    expect(await daftarParkir()).toHaveLength(MAKS_PARKIR);
  });

  it("parkir dapat dihapus", async () => {
    const h = await simpanParkir(isi);
    if (!h.ok) throw new Error("gagal menyimpan");
    await hapusParkir(h.keranjang.id);
    expect(await daftarParkir()).toHaveLength(0);
  });

  it("parkir tidak menyentuh stok", async () => {
    const p = produk({ stokGudang: 40 });
    await simpanProduk(p);
    await simpanParkir({ ...isi, isi: [{ produkId: p.id, nama: p.nama, hargaSatuan: 1, kuantitas: 2, diskonPerUnit: 0 }] });
    expect((await daftarProduk())[0]?.stokGudang).toBe(40);
  });
});
