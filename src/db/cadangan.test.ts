import { describe, expect, it } from "vitest";
import {
  base64KeBlob,
  blobKeBase64,
  buatCadangan,
  buatCsvTransaksi,
  kutipCsv,
  periksaCadangan,
  sepertiBlob,
  VERSI_CADANGAN,
} from "./cadangan.ts";
import { ambilSettings, SETTINGS_KOSONG, simpanProduk, simpanSettings } from "./repositori.ts";
import { getDB, resetKoneksiDB, type ProdukRecord } from "./schema.ts";

/**
 * CATATAN PENTING soal cara tes ini bekerja.
 *
 * `fake-indexeddb` mengubah Blob menjadi `{}` saat disimpan, sehingga foto & logo
 * TIDAK bisa diuji lewat IndexedDB asli. Karena itu:
 *  - logika Blob (blobKeBase64 / base64KeBlob / sepertiBlob) diuji langsung;
 *  - pemulihan diuji pada penyimpanan tiruan di memori yang menjaga objek apa adanya;
 *  - integrasi IndexedDB asli diuji untuk data non-Blob (pengaturan, produk).
 * Batasan ini dicatat di catatan historis PHASE-07.
 */

describe("helper Blob", () => {
  it("blobKeBase64 -> base64KeBlob mempertahankan isi & tipe", async () => {
    const asli = new Blob([new Uint8Array([0, 1, 2, 250, 255])], { type: "image/webp" });
    const b64 = await blobKeBase64(asli);
    const kembali = base64KeBlob(b64, "image/webp");
    expect(kembali.type).toBe("image/webp");
    expect(new Uint8Array(await kembali.arrayBuffer())).toEqual(new Uint8Array([0, 1, 2, 250, 255]));
  });

  it("sepertiBlob mengenali Blob asli dan objek mirip Blob", () => {
    expect(sepertiBlob(new Blob([]))).toBe(true);
    expect(sepertiBlob({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)), size: 0, type: "image/png" })).toBe(true);
    expect(sepertiBlob({})).toBe(false);
    expect(sepertiBlob(null)).toBe(false);
    expect(sepertiBlob("teks")).toBe(false);
  });
});

describe("periksaCadangan", () => {
  it("menolak teks bukan JSON", () => {
    expect(periksaCadangan("bukan json")).toEqual({ ok: false, pesan: "Berkas cadangan tidak dapat dibaca." });
  });

  it("menolak JSON bukan cadangan Kasir Kayesha", () => {
    expect(periksaCadangan(JSON.stringify({ hello: 1 }))).toEqual({
      ok: false,
      pesan: "Berkas ini bukan cadangan Kasir Kayesha.",
    });
  });

  it("menolak cadangan dari versi lebih baru", () => {
    const h = periksaCadangan(
      JSON.stringify({ aplikasi: "Kasir Kayesha", versiFormat: VERSI_CADANGAN + 1, data: {} }),
    );
    expect(h.ok).toBe(false);
    if (!h.ok) expect(h.pesan).toContain("versi lebih baru");
  });

  it("menolak cadangan tanpa isi", () => {
    expect(periksaCadangan(JSON.stringify({ aplikasi: "Kasir Kayesha", versiFormat: 1 })).ok).toBe(false);
  });

  it("memberi ringkasan isi untuk konfirmasi pemilik", () => {
    const h = periksaCadangan(
      JSON.stringify({
        aplikasi: "Kasir Kayesha",
        versiFormat: 1,
        data: { products: [{}, {}], transactions: [{}] },
        jumlah: { products: 2, transactions: 1 },
      }),
    );
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    expect(h.ringkas.join(" ")).toContain("barang: 2");
    expect(h.ringkas.join(" ")).toContain("transaksi: 1");
  });
});

/* -------------------- pemulihan pada penyimpanan tiruan -------------------- */

class StoreTiruan<T> {
  data = new Map<string, T>();
  semua(): T[] {
    return [...this.data.values()];
  }
  taruh(v: T): void {
    this.data.set((v as { id: string }).id, v);
  }
  kosongkan(): void {
    this.data.clear();
  }
}

interface GudangTiruan {
  products: StoreTiruan<ProdukRecord>;
  transactions: StoreTiruan<{ id: string }>;
}

const gudangBaru = (): GudangTiruan => ({
  products: new StoreTiruan<ProdukRecord>(),
  transactions: new StoreTiruan<{ id: string }>(),
});

function produk(nama: string, harga: number, stok: number): ProdukRecord {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    nama,
    kode: null,
    hargaJual: harga,
    stokGudang: stok,
    catatan: null,
    arsip: false,
    createdAt: now,
    updatedAt: now,
  };
}

/** Pemulihan tiruan dengan aturan yang sama: ganti = kosongkan dulu, gabung = tambahkan. */
function pulihkanTiruan(
  berkas: { aplikasi: string; data: Record<string, unknown[]> },
  gudang: GudangTiruan,
  mode: "gabung" | "ganti",
): { ok: boolean } {
  if (berkas.aplikasi !== "Kasir Kayesha") return { ok: false };
  for (const [nama, baris] of Object.entries(berkas.data)) {
    const store = (gudang as unknown as Record<string, StoreTiruan<unknown>>)[nama];
    if (!store) continue;
    if (mode === "ganti") store.kosongkan();
    for (const r of baris) store.taruh(r);
  }
  return { ok: true };
}

const berkasContoh = (data: Record<string, unknown[]>) => ({
  aplikasi: "Kasir Kayesha",
  versiFormat: VERSI_CADANGAN,
  versiDatabase: 2,
  dibuatPada: new Date().toISOString(),
  jumlah: {},
  data,
});

describe("pemulihan (tiruan)", () => {
  it("mengembalikan barang & stok yang sama", () => {
    const gudang = gudangBaru();
    const h = pulihkanTiruan(berkasContoh({ products: [produk("Blus Linen", 180000, 6)] }), gudang, "ganti");
    expect(h.ok).toBe(true);
    const semua = gudang.products.semua();
    expect(semua).toHaveLength(1);
    expect(semua[0]?.stokGudang).toBe(6);
  });

  it("mode gabung tidak menghapus data lama", () => {
    const gudang = gudangBaru();
    gudang.products.taruh(produk("Baru", 2000, 2));
    pulihkanTiruan(berkasContoh({ products: [produk("Lama", 1000, 1)] }), gudang, "gabung");
    expect(gudang.products.semua()).toHaveLength(2);
  });

  it("mode ganti mengosongkan lebih dulu", () => {
    const gudang = gudangBaru();
    gudang.products.taruh(produk("Baru", 2000, 2));
    pulihkanTiruan(berkasContoh({ products: [produk("Lama", 1000, 1)] }), gudang, "ganti");
    const semua = gudang.products.semua();
    expect(semua).toHaveLength(1);
    expect(semua[0]?.nama).toBe("Lama");
  });

  it("menolak berkas bukan Kasir Kayesha tanpa menulis apa pun", () => {
    const gudang = gudangBaru();
    const h = pulihkanTiruan({ aplikasi: "Lain", data: { products: [produk("X", 1, 1)] } }, gudang, "gabung");
    expect(h.ok).toBe(false);
    expect(gudang.products.semua()).toHaveLength(0);
  });
});

/* ------------------------ integrasi IndexedDB asli ------------------------ */

describe("buatCadangan (IndexedDB asli, data non-Blob)", () => {
  it("membuat cadangan dari database yang berisi pengaturan & produk", async () => {
    resetKoneksiDB();
    await getDB();
    await simpanSettings({ ...SETTINGS_KOSONG, namaButik: "Kayesha" });
    await simpanProduk(produk("Blus", 180000, 5));

    const cad = await buatCadangan();
    expect(cad.ok).toBe(true);
    if (!cad.ok) return;

    expect(cad.berkas.aplikasi).toBe("Kasir Kayesha");
    expect(cad.berkas.jumlah.settings).toBe(1);
    expect(cad.berkas.jumlah.products).toBeGreaterThanOrEqual(1);

    const teks = await cad.blob.text();
    expect(teks).toContain("Kayesha");
    expect(periksaCadangan(teks).ok).toBe(true);

    // data di DB tidak berubah karena ekspor
    expect((await ambilSettings()).namaButik).toBe("Kayesha");
  });
});

describe("CSV transaksi", () => {
  it("kutip nilai berisi koma/kutip", () => {
    expect(kutipCsv("Sari")).toBe("Sari");
    expect(kutipCsv("Sari, Bu")).toBe('"Sari, Bu"');
    expect(kutipCsv('Ucap "halo"')).toBe('"Ucap ""halo"""');
  });

  it("header benar dan total tetap integer", () => {
    const csv = buatCsvTransaksi([
      {
        nomorResi: "KYS-0001",
        waktu: "2026-11-10T08:00:00.000Z",
        jenis: "langsung",
        statusPesanan: "selesai",
        statusBayar: "lunas",
        namaPemesan: null,
        ongkirMode: "ambil_sendiri",
        total: 450000,
        dibatalkanPada: null,
      },
    ]);
    const baris = csv.split("\r\n");
    expect(baris[0]).toContain("nomor_resi");
    expect(baris[1]).toContain("KYS-0001");
    expect(baris[1]).toContain("450000");
    expect(baris[1]).toContain("tidak");
  });
});
