/**
 * Tes integrasi pre-order (Phase 4).
 *
 * Aturan yang dikunci:
 *  1. PO TIDAK mengurangi stok saat dibuat.
 *  2. Stok berkurang saat PO berstatus SELESAI.
 *  3. DP + pelunasan menghitung sisa dengan benar; status bayar terpisah dari status pesanan.
 *  4. Ongkir menyusul: total dihitung ulang, riwayat tercatat, LUNAS → DP.
 *  5. Pembatalan TIDAK menghapus pembayaran.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { alokasikanKeBazar, buatBazar, daftarProduk, daftarTransaksi, saldoBazarProduk, simpanProduk } from "./repositori.ts";
import { simpanPO } from "./pesanan.ts";
import { ambilPesanan, batalkanTransaksi, catatPembayaran, isiOngkir, ubahStatusPesanan } from "./pesananOperasi.ts";
import { resetKoneksiDB, type ProdukRecord, type UUID } from "./schema.ts";
import type { RencanaPO } from "../lib/pesanan.ts";

function resetDB() {
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  resetKoneksiDB();
}

async function produkBaru(nama: string, harga: number, stok: number): Promise<ProdukRecord> {
  const now = new Date().toISOString();
  const p: ProdukRecord = {
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
  await simpanProduk(p);
  return p;
}

function rencana(p: ProdukRecord, qty: number, over: Partial<RencanaPO> = {}): RencanaPO {
  return {
    items: [{ produkId: p.id, nama: p.nama, hargaSatuan: p.hargaJual, kuantitas: qty, diskonPerUnit: 0 }],
    diskonTotal: 0,
    ongkir: { mode: "ambil_sendiri", nominal: 0 },
    namaPemesan: "Ibu Sari",
    kontak: "0812",
    perkiraanSiap: "2026-11-20",
    alamat: null,
    catatan: null,
    dibayarSekarang: 0,
    jenisBayar: "transfer",
    bazarId: null,
    ...over,
  };
}

async function stok(produkId: UUID): Promise<number> {
  return (await daftarProduk(true)).find((x) => x.id === produkId)?.stokGudang ?? -1;
}

describe("simpanPO", () => {
  beforeEach(resetDB);

  it("PO TIDAK mengurangi stok gudang", async () => {
    const p = await produkBaru("Gamis Abu", 450000, 10);
    const h = await simpanPO(rencana(p, 2), { rekening: [] });
    expect(h.ok).toBe(true);
    expect(await stok(p.id)).toBe(10);
  });

  it("nomor PO berurutan KYS-PO-0001", async () => {
    const p = await produkBaru("Gamis", 100000, 5);
    const a = await simpanPO(rencana(p, 1), { rekening: [] });
    const b = await simpanPO(rencana(p, 1), { rekening: [] });
    expect(a.ok && a.pesanan.nomorResi).toBe("KYS-PO-0001");
    expect(b.ok && b.pesanan.nomorResi).toBe("KYS-PO-0002");
  });

  it("menyimpan nama pemesan, kontak, perkiraan siap, status diproses", async () => {
    const p = await produkBaru("Gamis", 100000, 5);
    const h = await simpanPO(rencana(p, 1), { rekening: [] });
    if (!h.ok) throw new Error("gagal");
    const l = await ambilPesanan(h.pesanan.id);
    expect(l?.transaksi).toMatchObject({
      jenis: "po",
      statusPesanan: "diproses",
      statusBayar: "belum_dibayar",
      namaPemesan: "Ibu Sari",
      kontak: "0812",
      perkiraanSiap: "2026-11-20",
    });
  });

  it("DP saat PO mencatat pembayaran", async () => {
    const p = await produkBaru("Gamis", 450000, 5);
    const h = await simpanPO(rencana(p, 1, { dibayarSekarang: 150000 }), { rekening: [] });
    if (!h.ok) throw new Error("gagal");
    const l = await ambilPesanan(h.pesanan.id);
    expect(l?.transaksi.statusBayar).toBe("dp");
    expect(l?.pembayaran).toHaveLength(1);
    expect(l?.pembayaran[0]?.nominal).toBe(150000);
  });

  it("PO tidak mengurangi saldo bazar", async () => {
    const p = await produkBaru("Gamis", 100000, 20);
    const b = await buatBazar("Pameran", null, null);
    await alokasikanKeBazar(b.id, p.id, 10);
    const h = await simpanPO(rencana(p, 2, { bazarId: b.id }), { rekening: [] });
    expect(h.ok).toBe(true);
    expect(await saldoBazarProduk(b.id, p.id)).toBe(10);
  });
});

describe("catatPembayaran", () => {
  beforeEach(resetDB);

  it("pelunasan sebagian lalu lunas", async () => {
    const p = await produkBaru("Gamis", 450000, 5);
    const h = await simpanPO(rencana(p, 1), { rekening: [] });
    if (!h.ok) throw new Error("gagal");

    const a = await catatPembayaran(h.pesanan.id, { nominal: 200000, waktu: new Date().toISOString(), metode: "transfer", catatan: null });
    expect(a.ok).toBe(true);
    let l = await ambilPesanan(h.pesanan.id);
    expect(l?.transaksi.statusBayar).toBe("dp");

    const b = await catatPembayaran(h.pesanan.id, { nominal: 250000, waktu: new Date().toISOString(), metode: "tunai", catatan: null });
    expect(b.ok).toBe(true);
    l = await ambilPesanan(h.pesanan.id);
    expect(l?.transaksi.statusBayar).toBe("lunas");
    expect(l?.pembayaran).toHaveLength(2);
  });

  it("menolak pembayaran melebihi sisa tanpa mengubah apa pun", async () => {
    const p = await produkBaru("Gamis", 450000, 5);
    const h = await simpanPO(rencana(p, 1), { rekening: [] });
    if (!h.ok) throw new Error("gagal");
    const a = await catatPembayaran(h.pesanan.id, { nominal: 500000, waktu: new Date().toISOString(), metode: null, catatan: null });
    expect(a).toEqual({ ok: false, pesan: "Nominal melebihi sisa tagihan Rp 450.000." });
    const l = await ambilPesanan(h.pesanan.id);
    expect(l?.pembayaran).toHaveLength(0);
    expect(l?.transaksi.statusBayar).toBe("belum_dibayar");
  });
});

describe("ubahStatusPesanan", () => {
  beforeEach(resetDB);

  it("diproses → siap → selesai, stok berkurang saat SELESAI", async () => {
    const p = await produkBaru("Gamis", 450000, 10);
    const h = await simpanPO(rencana(p, 3), { rekening: [] });
    if (!h.ok) throw new Error("gagal");

    expect((await ubahStatusPesanan(h.pesanan.id, "siap")).ok).toBe(true);
    expect(await stok(p.id)).toBe(10); // belum berkurang

    expect((await ubahStatusPesanan(h.pesanan.id, "selesai")).ok).toBe(true);
    expect(await stok(p.id)).toBe(7); // 10 − 3
  });

  it("menolak lompatan status", async () => {
    const p = await produkBaru("Gamis", 450000, 10);
    const h = await simpanPO(rencana(p, 1), { rekening: [] });
    if (!h.ok) throw new Error("gagal");
    const r = await ubahStatusPesanan(h.pesanan.id, "selesai");
    expect(r.ok).toBe(false);
    expect(await stok(p.id)).toBe(10);
  });
});

describe("isiOngkir (menyusul)", () => {
  beforeEach(resetDB);

  it("total bertambah, riwayat tercatat, LUNAS berubah jadi DP", async () => {
    const p = await produkBaru("Gamis", 450000, 5);
    const h = await simpanPO(
      rencana(p, 1, { ongkir: { mode: "belum_ditentukan", nominal: null }, dibayarSekarang: 450000 }),
      { rekening: [] },
    );
    if (!h.ok) throw new Error("gagal");

    const r = await isiOngkir(h.pesanan.id, { mode: "butik", nominal: 25000 });
    expect(r.ok).toBe(true);

    const l = await ambilPesanan(h.pesanan.id);
    expect(l?.transaksi.total).toBe(475000);
    expect(l?.transaksi.statusBayar).toBe("dp");
    expect(l?.transaksi.riwayatTotal).toHaveLength(1);
    expect(l?.transaksi.riwayatTotal[0]?.totalLama).toBe(450000);
    expect(l?.transaksi.riwayatTotal[0]?.totalBaru).toBe(475000);
  });
});

describe("batalkanTransaksi", () => {
  beforeEach(resetDB);

  it("PO dibatalkan: pembayaran TIDAK dihapus, stok tetap", async () => {
    const p = await produkBaru("Gamis", 450000, 10);
    const h = await simpanPO(rencana(p, 2, { dibayarSekarang: 100000 }), { rekening: [] });
    if (!h.ok) throw new Error("gagal");

    expect((await batalkanTransaksi(h.pesanan.id)).ok).toBe(true);

    const l = await ambilPesanan(h.pesanan.id);
    expect(l?.transaksi.statusPesanan).toBe("dibatalkan");
    expect(l?.transaksi.dibatalkanPada).not.toBeNull();
    expect(l?.pembayaran).toHaveLength(1);
    expect(await stok(p.id)).toBe(10);
  });

  it("PO yang sudah selesai dibatalkan: stok kembali", async () => {
    const p = await produkBaru("Gamis", 450000, 10);
    const h = await simpanPO(rencana(p, 2), { rekening: [] });
    if (!h.ok) throw new Error("gagal");
    await ubahStatusPesanan(h.pesanan.id, "siap");
    await ubahStatusPesanan(h.pesanan.id, "selesai");
    expect(await stok(p.id)).toBe(8);

    expect((await batalkanTransaksi(h.pesanan.id)).ok).toBe(true);
    expect(await stok(p.id)).toBe(10);
  });

  it("tidak bisa membatalkan dua kali", async () => {
    const p = await produkBaru("Gamis", 100000, 5);
    const h = await simpanPO(rencana(p, 1), { rekening: [] });
    if (!h.ok) throw new Error("gagal");
    await batalkanTransaksi(h.pesanan.id);
    expect(await batalkanTransaksi(h.pesanan.id)).toEqual({ ok: false, pesan: "Transaksi sudah dibatalkan." });
  });

  it("transaksi yang dibatalkan tetap ada di database", async () => {
    const p = await produkBaru("Gamis", 100000, 5);
    const h = await simpanPO(rencana(p, 1), { rekening: [] });
    if (!h.ok) throw new Error("gagal");
    await batalkanTransaksi(h.pesanan.id);
    expect((await daftarTransaksi()).some((t) => t.id === h.pesanan.id)).toBe(true);
  });
});
