/**
 * Stok gudang bertahan lewat putaran sync (F15 + turunan F6, tes klik
 * putaran 4, 22 Nov 2026).
 *
 * Akar masalah yang dikunci di sini:
 *  1. Penjualan/batal mengubah stok gudang tapi TIDAK menandai produk untuk
 *     sync (hanya transaksinya) — hub tetap menyimpan stok lama.
 *  2. Pull hub selalu mengembalikan produk, dan bayangan dulu disimpan dari
 *     hasil gabung (nilai lokal) — pull kedua menyimpulkan "hanya sisi jauh
 *     yang berubah" dan menimpa stok lokal dengan nilai hub yang usang.
 *     Bayangan sekarang = record hub, dan produk ditandai untuk sync saat
 *     stoknya berubah (seperti alokasi/tutup bazar).
 *
 * Hub tiruan setia pada hub asli (src/sync/logika.ts): produk disimpan
 * tanpa kolom perangkat, dan pull mengembalikan produk dengan
 * diubahPada > sejak TANPA filter perangkat (berbeda dengan transaksi).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { resetKoneksiDB, getDB } from "../db/schema.ts";
import { simpanProduk, daftarProduk } from "../db/repositori.ts";
import { simpanPenjualan, type RencanaPenjualan } from "../lib/penjualan.ts";
import { batalkanTransaksi } from "../db/pesananOperasi.ts";
import { sinkronkan, jumlahAntrean } from "./mesin.ts";

const URL_SYNC = "https://contoh/api/sync";

type HubProduk = {
  id: string;
  nama: string;
  kode: string | null;
  hargaJual: number;
  stokGudang: number;
  catatan: string | null;
  arsip: boolean;
  diubahPada: string;
};

/** Hub tiruan di memori. */
function buatHubTiruan() {
  const produk = new Map<string, HubProduk>();
  const fetchHub: typeof fetch = (async (input: unknown, init?: unknown) => {
    const url = String(input);
    const method = String((init as { method?: string } | undefined)?.method ?? "GET").toUpperCase();
    if (method === "POST") {
      const body = JSON.parse(String((init as { body?: string }).body ?? "{}")) as {
        kiriman: Array<Record<string, unknown>>;
      };
      const diterima: string[] = [];
      for (const k of body.kiriman ?? []) {
        if (k.jenis === "produk") {
          produk.set(String(k.id), {
            id: String(k.id),
            nama: String(k.nama),
            kode: (k.kode as string | null) ?? null,
            hargaJual: Number(k.hargaJual),
            stokGudang: Number(k.stokGudang),
            catatan: (k.catatan as string | null) ?? null,
            arsip: Boolean(k.arsip),
            diubahPada: String(k.diubahPada),
          });
        }
        diterima.push(String(k.id));
      }
      return new Response(JSON.stringify({ ok: true, diterima, ditolak: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    const u = new URL(url);
    const sejak = u.searchParams.get("sejak") ?? "1970-01-01T00:00:00.000Z";
    const daftar = [...produk.values()]
      .filter((p) => p.diubahPada > sejak)
      .map((p) => ({ jenis: "produk", ...p }));
    return new Response(
      JSON.stringify({
        ok: true,
        sekarang: new Date().toISOString(),
        transaksi: [],
        produk: daftar,
        bazar: [],
        biayaBazar: [],
        pin: [],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as unknown as typeof fetch;
  return { fetchHub, produk };
}

async function stok(id: string): Promise<number> {
  return (await daftarProduk()).find((p) => p.id === id)?.stokGudang ?? -1;
}

function rencanaJual(blusId: string): RencanaPenjualan {
  return {
    items: [{ produkId: blusId, nama: "Blus Linen Uji", hargaSatuan: 150000, kuantitas: 1, diskonPerUnit: 0 }],
    diskonTotal: 0,
    ongkir: { mode: "belum_ditentukan", nominal: null },
    jenisBayar: "tunai" as const,
    statusBayar: "lunas" as const,
    dibayarSekarang: 0,
    bazarId: null,
    namaPembeli: "Dewi",
  };
}

describe("F15: stok gudang penjualan toko bertahan lewat sync", () => {
  beforeEach(() => {
    (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
    resetKoneksiDB();
  });

  it("jual 1x → stok 9, hub ikut 9, dan dua putaran sync tanpa perubahan tidak mengembalikannya", async () => {
    const { fetchHub, produk: hubProduk } = buatHubTiruan();
    const opsi = { url: URL_SYNC, token: "tok", fetchImpl: fetchHub };

    const now = new Date().toISOString();
    const blus = {
      id: crypto.randomUUID(),
      nama: "Blus Linen Uji",
      kode: null,
      hargaJual: 150000,
      stokGudang: 10,
      catatan: null,
      arsip: false,
      createdAt: now,
      updatedAt: now,
    };
    await simpanProduk(blus);
    await sinkronkan(opsi);
    expect(hubProduk.get(blus.id)?.stokGudang).toBe(10);

    const jual = await simpanPenjualan(rencanaJual(blus.id), { rekening: [] });
    expect(jual.ok).toBe(true);
    expect(await stok(blus.id)).toBe(9);
    // Produk ikut ditandai untuk sync (bukan hanya transaksinya).
    expect(await jumlahAntrean()).toBe(2);

    // Putaran sync 1: produk naik ke hub, lalu pull mengembalikannya.
    await sinkronkan(opsi);
    expect(hubProduk.get(blus.id)?.stokGudang).toBe(9);
    expect(await stok(blus.id)).toBe(9);

    // Putaran sync 2 TANPA perubahan lokal (auto-sync 60 dtk di aplikasi):
    // dulu di sinilah stok 9 ditulis ulang jadi 10 (nilai hub lama).
    await sinkronkan(opsi);
    expect(await stok(blus.id)).toBe(9);

    // Bayangan = nilai hub (9), bukan nilai lokal yang belum terkirim.
    const db = await getDB();
    const bayangan = await db.get("bayangan", `produk:${blus.id}`);
    expect((bayangan?.data as { stokGudang?: number } | undefined)?.stokGudang).toBe(9);
  });

  it("jual 2x lalu batal 1x → stok 9 persisten lewat dua putaran sync (F6)", async () => {
    const { fetchHub, produk: hubProduk } = buatHubTiruan();
    const opsi = { url: URL_SYNC, token: "tok", fetchImpl: fetchHub };

    const now = new Date().toISOString();
    const blus = {
      id: crypto.randomUUID(),
      nama: "Blus Linen Uji",
      kode: null,
      hargaJual: 150000,
      stokGudang: 10,
      catatan: null,
      arsip: false,
      createdAt: now,
      updatedAt: now,
    };
    await simpanProduk(blus);
    await sinkronkan(opsi);

    const satu = await simpanPenjualan(rencanaJual(blus.id), { rekening: [] });
    expect(satu.ok).toBe(true);
    expect(await stok(blus.id)).toBe(9);

    // Duplikat lewat "Tetap Simpan".
    const dua = await simpanPenjualan(rencanaJual(blus.id), { rekening: [], izinkanDuplikat: true });
    expect(dua.ok).toBe(true);
    expect(await stok(blus.id)).toBe(8);
    await sinkronkan(opsi);
    expect(hubProduk.get(blus.id)?.stokGudang).toBe(8);
    expect(await stok(blus.id)).toBe(8);

    // Batalkan penjualan kedua: stok kembali tepat 1x.
    if (!dua.ok) return;
    const batal = await batalkanTransaksi(dua.transaksi.id, "Duplikat");
    expect(batal.ok).toBe(true);
    expect(await stok(blus.id)).toBe(9);

    // Batal ganda (double-tap) tetap hanya 1x — penjaga di transaksi tulis.
    const batalLagi = await batalkanTransaksi(dua.transaksi.id, "Duplikat");
    expect(batalLagi.ok).toBe(false);
    expect(await stok(blus.id)).toBe(9);

    await sinkronkan(opsi);
    expect(hubProduk.get(blus.id)?.stokGudang).toBe(9);
    expect(await stok(blus.id)).toBe(9);
    // Putaran sync kedua tanpa perubahan lokal: tidak ada tulis ulang.
    await sinkronkan(opsi);
    expect(await stok(blus.id)).toBe(9);
  });
});
