import { describe, expect, it } from "vitest";
import {
  base64KeBlob,
  blobKeBase64,
  buatCadangan,
  buatCsvTransaksi,
  koneksiTertutup,
  kutipCsv,
  periksaCadangan,
  pulihkanCadangan,
  sepertiBlob,
  VERSI_CADANGAN,
  type BerkasCadangan,
} from "./cadangan.ts";
import { ambilSettings, ambilTutupHarian, SETTINGS_KOSONG, simpanProduk, simpanSettings, simpanTutupHarian } from "./repositori.ts";
import { getDB, resetKoneksiDB, type ProdukRecord } from "./schema.ts";
import { simpanPenjualan } from "../lib/penjualan.ts";

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

  it("menolak JSON bukan cadangan Kasir Kayesa", () => {
    expect(periksaCadangan(JSON.stringify({ hello: 1 }))).toEqual({
      ok: false,
      pesan: "Berkas ini bukan cadangan Kasir Kayesa.",
    });
  });

  it("tetap menerima cadangan lama yang bertuliskan ejaan lama", () => {
    const h = periksaCadangan(
      JSON.stringify({ aplikasi: "Kasir Kayesha", versiFormat: 1, data: { products: [] } }),
    );
    expect(h.ok).toBe(true);
  });

  it("menolak cadangan dari versi lebih baru", () => {
    const h = periksaCadangan(
      JSON.stringify({ aplikasi: "Kasir Kayesa", versiFormat: VERSI_CADANGAN + 1, data: {} }),
    );
    expect(h.ok).toBe(false);
    if (!h.ok) expect(h.pesan).toContain("versi lebih baru");
  });

  it("menolak cadangan tanpa isi", () => {
    expect(periksaCadangan(JSON.stringify({ aplikasi: "Kasir Kayesa", versiFormat: 1 })).ok).toBe(false);
  });

  it("memberi ringkasan isi untuk konfirmasi pemilik", () => {
    const h = periksaCadangan(
      JSON.stringify({
        aplikasi: "Kasir Kayesa",
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
  if (berkas.aplikasi !== "Kasir Kayesa") return { ok: false };
  for (const [nama, baris] of Object.entries(berkas.data)) {
    const store = (gudang as unknown as Record<string, StoreTiruan<unknown>>)[nama];
    if (!store) continue;
    if (mode === "ganti") store.kosongkan();
    for (const r of baris) store.taruh(r);
  }
  return { ok: true };
}

const berkasContoh = (data: Record<string, unknown[]>) => ({
  aplikasi: "Kasir Kayesa",
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

  it("menolak berkas bukan Kasir Kayesa tanpa menulis apa pun", () => {
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
    await simpanSettings({ ...SETTINGS_KOSONG, namaButik: "Kayesa" });
    await simpanProduk(produk("Blus", 180000, 5));

    const cad = await buatCadangan();
    expect(cad.ok).toBe(true);
    if (!cad.ok) return;

    expect(cad.berkas.aplikasi).toBe("Kasir Kayesa");
    expect(cad.berkas.jumlah.settings).toBe(1);
    expect(cad.berkas.jumlah.products).toBeGreaterThanOrEqual(1);

    const teks = await cad.blob.text();
    expect(teks).toContain("Kayesa");
    expect(periksaCadangan(teks).ok).toBe(true);

    // data di DB tidak berubah karena ekspor
    expect((await ambilSettings()).namaButik).toBe("Kayesa");
  });
});

describe("pulihkanCadangan — mode ganti di IndexedDB asli (F2, tes klik 22 Nov 2026)", () => {
  it("cadangan kosong + mode ganti benar-benar mengosongkan barang & transaksi", async () => {
    resetKoneksiDB();
    const db = await getDB();
    // Bersihkan dulu supaya cadangan kosong di bawah memang kosong.
    for (const store of ["settings", "products", "transactions", "transaction_items", "payments"] as const) {
      await db.clear(store);
    }

    // Cadangan kosong (semua store kosong).
    const kosong = await buatCadangan();
    expect(kosong.ok).toBe(true);
    if (!kosong.ok) return;

    // Isi data: 1 barang + 1 penjualan.
    const p = produk("Blus F2", 180000, 10);
    await simpanProduk(p);
    const jual = await simpanPenjualan(
      {
        items: [{ produkId: p.id, nama: p.nama, hargaSatuan: 180000, kuantitas: 1, diskonPerUnit: 0 }],
        diskonTotal: 0,
        ongkir: { mode: "ambil_sendiri", nominal: 0 },
        jenisBayar: "tunai",
        statusBayar: "lunas",
        dibayarSekarang: 0,
        bazarId: null,
      },
      { rekening: [] },
    );
    expect(jual.ok).toBe(true);
    expect(await db.count("products")).toBe(1);
    expect(await db.count("transactions")).toBe(1);

    // Pulihkan cadangan kosong dengan mode ganti.
    const h = await pulihkanCadangan(kosong.berkas, { mode: "ganti" });
    expect(h.ok).toBe(true);
    expect(await db.count("products")).toBe(0);
    expect(await db.count("transactions")).toBe(0);
    expect(await db.count("transaction_items")).toBe(0);
    expect(await db.count("payments")).toBe(0);
  });
});

describe("pulihkanCadangan — tutup harian ikut dicadangkan (F16, tes klik putaran 4, 22 Nov 2026)", () => {
  async function tutupHarianContoh() {
    return {
      id: crypto.randomUUID(),
      tanggal: "2026-11-22",
      bazarId: null,
      label: "Toko",
      peran: "kasir" as const,
      jumlahTransaksi: 4,
      uangMasuk: 1180000,
      tunai: 680000,
      transfer: 0,
      qris: 500000,
      pengembalian: 0,
      pengembalianDp: 0,
      pengembalianBatal: 0,
      ditutupPada: "2026-11-22T01:37:00.000Z",
    };
  }

  it("cadangan kosong + mode ganti menghapus catatan tutup harian (bukan hanya barang & transaksi)", async () => {
    resetKoneksiDB();
    const db = await getDB();
    await db.clear("tutupHarian");
    await db.clear("logSinkron");
    await db.clear("outbox");
    await db.clear("bayangan");

    // Cadangan kosong (semua store kosong).
    const kosong = await buatCadangan();
    expect(kosong.ok).toBe(true);
    if (!kosong.ok) return;

    // Isi data: tutup harian + log sinkron + state sync internal.
    await simpanTutupHarian(await tutupHarianContoh());
    await db.put("logSinkron", {
      id: crypto.randomUUID(),
      waktu: "2026-11-22T02:00:00.000Z",
      jenis: "info",
      judul: "Tes log",
      rincian: "Rincian tes.",
      perangkat: null,
    });
    await db.put("outbox", {
      id: crypto.randomUUID(),
      jenisRecord: "transaksi",
      idRecord: "transaksi-lama",
      aksi: "upsert",
      dibuatPada: "2026-11-22T02:00:00.000Z",
      percobaan: 0,
      terakhirDicoba: null,
    });
    await db.put("bayangan", {
      id: "produk:produk-lama",
      jenis: "produk",
      idRecord: "produk-lama",
      data: { stokGudang: 10 },
      diubahPada: "2026-11-22T02:00:00.000Z",
    });
    expect(await db.count("tutupHarian")).toBe(1);
    expect(await db.count("logSinkron")).toBe(1);

    // Pulihkan cadangan kosong dengan mode ganti: SEMUA data usaha hilang,
    // dan state sync internal ikut dibersihkan (tidak menghidupkan lagi
    // data yang baru dihapus).
    const h = await pulihkanCadangan(kosong.berkas, { mode: "ganti" });
    expect(h.ok).toBe(true);
    expect(await db.count("tutupHarian")).toBe(0);
    expect(await ambilTutupHarian("2026-11-22", null)).toBeNull();
    expect(await db.count("logSinkron")).toBe(0);
    expect(await db.count("outbox")).toBe(0);
    expect(await db.count("bayangan")).toBe(0);
  });

  it("cadangan mengekspor tutup harian & log sinkron; mode gabung mengembalikannya tanpa menghapus yang sudah ada", async () => {
    resetKoneksiDB();
    const db = await getDB();
    await db.clear("tutupHarian");
    await db.clear("logSinkron");

    const tutup = await tutupHarianContoh();
    await simpanTutupHarian(tutup);
    await db.put("logSinkron", {
      id: crypto.randomUUID(),
      waktu: "2026-11-22T02:00:00.000Z",
      jenis: "info",
      judul: "Tes log",
      rincian: "Rincian tes.",
      perangkat: null,
    });

    const cadangan = await buatCadangan();
    expect(cadangan.ok).toBe(true);
    if (!cadangan.ok) return;
    expect(cadangan.berkas.data.tutupHarian).toHaveLength(1);
    expect(cadangan.berkas.data.logSinkron).toHaveLength(1);
    // State sync internal tidak pernah diekspor.
    expect(cadangan.berkas.data.bayangan).toBeUndefined();
    expect(cadangan.berkas.data.outbox).toBeUndefined();

    // Hapus lokal, lalu pulihkan dengan mode gabung.
    await db.clear("tutupHarian");
    await db.clear("logSinkron");
    expect(await db.count("tutupHarian")).toBe(0);
    const h = await pulihkanCadangan(cadangan.berkas, { mode: "gabung" });
    expect(h.ok).toBe(true);
    expect(await db.count("tutupHarian")).toBe(1);
    expect((await ambilTutupHarian("2026-11-22", null))?.jumlahTransaksi).toBe(4);
    expect(await db.count("logSinkron")).toBe(1);
  });
});

describe("pulihkanCadangan — koneksi tertutup lalu pulih sendiri (F17, tes klik putaran 5, 22 Nov 2026)", () => {
  it("koneksiTertutup hanya mengenali error koneksi tertutup", () => {
    expect(koneksiTertutup(new DOMException("The database connection is closing", "InvalidStateError"))).toBe(true);
    expect(
      koneksiTertutup(
        new Error("Failed to execute 'transaction' on 'IDBDatabase': The database connection is closing."),
      ),
    ).toBe(true);
    expect(koneksiTertutup(new DOMException("transaksi tidak aktif", "TransactionInactiveError"))).toBe(false);
    expect(koneksiTertutup(new DOMException("kunci hilang", "DataError"))).toBe(false);
    expect(koneksiTertutup(new Error("Pemulihan gagal."))).toBe(false);
    expect(koneksiTertutup(null)).toBe(false);
  });

  it("mode ganti + koneksi mati sebelum mulai: restore berhasil tanpa reload halaman", async () => {
    resetKoneksiDB();
    const db = await getDB();
    // Bersihkan dulu supaya cadangan kosong di bawah memang kosong.
    for (const store of ["settings", "products", "transactions", "transaction_items", "payments"] as const) {
      await db.clear(store);
    }

    // Cadangan kosong (semua store kosong).
    const kosong = await buatCadangan();
    expect(kosong.ok).toBe(true);
    if (!kosong.ok) return;

    // Isi data: 1 barang.
    await simpanProduk(produk("Blus F17", 180000, 10));
    expect(await db.count("products")).toBe(1);

    // Matikan koneksi yang di-cache — seperti yang terjadi di browser pada F17.
    db.close();

    // Restore harus berhasil tanpa reload: koneksi dibuka ulang secara
    // internal dan percobaan diulang sekali.
    const h = await pulihkanCadangan(kosong.berkas, { mode: "ganti" });
    expect(h.ok).toBe(true);

    resetKoneksiDB();
    const dbBaru = await getDB();
    expect(await dbBaru.count("products")).toBe(0);
  });

  it("mode gabung + koneksi mati: data nyata tetap utuh (jalur clone Senin)", async () => {
    resetKoneksiDB();
    const db = await getDB();
    await db.clear("settings");
    await db.clear("products");

    // Cadangan berisi data nyata (seperti cadangan Tante saat clone).
    const cadangan: BerkasCadangan = {
      aplikasi: "Kasir Kayesa",
      versiFormat: VERSI_CADANGAN,
      versiDatabase: 6,
      dibuatPada: new Date().toISOString(),
      jumlah: { settings: 1, products: 1 },
      data: {
        settings: [{ ...SETTINGS_KOSONG, namaButik: "Kayesa" }],
        products: [produk("Kebaya Tante", 450000, 3)],
      },
    };

    // Matikan koneksi yang di-cache sebelum restore jalan.
    db.close();

    const h = await pulihkanCadangan(cadangan, { mode: "gabung" });
    expect(h.ok).toBe(true);

    resetKoneksiDB();
    const dbBaru = await getDB();
    expect(await dbBaru.count("products")).toBe(1);
    expect((await ambilSettings()).namaButik).toBe("Kayesa");
  });

  it("gagal karena data rusak tetap dilaporkan jujur (tidak diulang, tidak sukses palsu)", async () => {
    resetKoneksiDB();
    const db = await getDB();
    await db.clear("products");

    // Baris produk tanpa `id` (keyPath) → put melempar DataError.
    const rusak: BerkasCadangan = {
      aplikasi: "Kasir Kayesa",
      versiFormat: VERSI_CADANGAN,
      versiDatabase: 6,
      dibuatPada: new Date().toISOString(),
      jumlah: { products: 1 },
      data: { products: [{ nama: "Tanpa ID", hargaJual: 1000, stokGudang: 1 }] },
    };

    const h = await pulihkanCadangan(rusak, { mode: "gabung" });
    expect(h.ok).toBe(false);
    expect(await db.count("products")).toBe(0);
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
