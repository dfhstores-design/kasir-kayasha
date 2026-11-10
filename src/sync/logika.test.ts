/**
 * Tes sinkronisasi (Phase 6).
 *
 * Yang dikunci:
 *  1. IDEMPOTEN — kiriman yang sama dua kali tidak menggandakan baris.
 *  2. Satu kiriman rusak tidak membatalkan yang lain.
 *  3. Uang tetap integer; kiriman non-integer ditolak.
 *  4. Kiriman yang berubah (diubahPada baru) menimpa, tidak menambah baris.
 *
 * D1 diganti penyimpanan SQL-tiruan di memori: cukup untuk menguji logika
 * INSERT ... ON CONFLICT yang menjadi inti jaminan idempoten.
 */
import { describe, expect, it } from "vitest";
import { kunciSync, periksaKiriman, prosesBatch, type DBCloud, type KirimanTransaksi } from "./logika.ts";

/** Kumpulan tabel di memori + pelaksana SQL sederhana untuk pola yang kita pakai. */
class DBTiruan implements DBCloud {
  tabel: Record<string, Array<Record<string, unknown>>> = {
    transactions: [],
    transaction_items: [],
    payments: [],
    products: [],
    bazars: [],
    sync_log: [],
  };

  prepare(sql: string) {
    // Objek DB tiruan yang dipakai closure `bind` di bawah.
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const db: DBTiruan = this;
    const bersih = sql.replace(/\s+/g, " ").trim();

    return {
      bind(...nilai: unknown[]) {
        return {
          async run() {
            db.jalankan(bersih, nilai);
            return {};
          },
          async first<T>() {
            return db.cari(bersih, nilai) as T | null;
          },
        };
      },
    };
  }

  private namaTabel(sql: string, awalan: "INSERT INTO" | "SELECT FROM"): string {
    if (awalan === "INSERT INTO") return sql.split(" ")[2] ?? "";
    const m = sql.match(/FROM ([a-z_]+)/);
    return m?.[1] ?? "";
  }

  private jalankan(sql: string, nilai: unknown[]) {
    if (sql.startsWith("INSERT OR REPLACE INTO sync_log")) {
      const [kunci, jenis, idRecord, diterimaPada] = nilai;
      const t = this.tabel.sync_log!;
      const i = t.findIndex((r) => r.kunci === kunci);
      const baris = { kunci, jenis, id_record: idRecord, diterima_pada: diterimaPada };
      if (i >= 0) t[i] = baris;
      else t.push(baris);
      return;
    }

    if (sql.startsWith("INSERT INTO")) {
      const tabel = this.namaTabel(sql, "INSERT INTO");
      const kolom = (sql.match(/\(([^)]+)\) VALUES/) ?? ["", ""])[1]!
        .split(",")
        .map((s) => s.trim());
      const baris: Record<string, unknown> = {};
      kolom.forEach((k, i) => (baris[k] = nilai[i]));

      const t = this.tabel[tabel]!;
      const id = baris.id as string;
      const i = t.findIndex((r) => r.id === id);
      if (i >= 0) for (const [k, v] of Object.entries(baris)) t[i]![k] = v;
      else t.push(baris);
      return;
    }
    throw new Error("SQL tak dikenal: " + sql.slice(0, 40));
  }

  private cari(sql: string, nilai: unknown[]) {
    if (sql.includes("FROM sync_log")) {
      return this.tabel.sync_log!.find((r) => r.kunci === nilai[0]) ?? null;
    }
    throw new Error("SELECT tak dikenal");
  }
}

const transaksi = (over: Partial<KirimanTransaksi> = {}): KirimanTransaksi => ({
  jenis: "transaksi",
  id: "11111111-1111-1111-1111-111111111111",
  nomorResi: "KYS-0001",
  waktu: "2026-11-10T08:00:00.000Z",
  jenisTransaksi: "langsung",
  statusPesanan: "selesai",
  statusBayar: "lunas",
  bazarId: null,
  namaPemesan: null,
  ongkirMode: "ambil_sendiri",
  ongkirNominal: 0,
  subtotalAwal: 450000,
  diskonItem: 0,
  diskonTotal: 0,
  total: 450000,
  dibatalkanPada: null,
  dibuatPada: "2026-11-10T08:00:00.000Z",
  diubahPada: "2026-11-10T08:00:00.000Z",
  items: [
    {
      id: "item-1",
      produkId: "p-1",
      namaSnapshot: "Kebaya",
      hargaSatuan: 450000,
      kuantitas: 1,
      diskonPerUnit: 0,
      subtotalBersih: 450000,
    },
  ],
  pembayaran: [{ id: "pay-1", nominal: 450000, waktu: "2026-11-10T08:00:00.000Z", metode: "tunai" }],
  ...over,
});

describe("periksaKiriman", () => {
  it("menerima transaksi yang sah", () => {
    expect(periksaKiriman(transaksi()).ok).toBe(true);
  });

  it("menolak total non-integer (uang harus integer)", () => {
    const h = periksaKiriman(transaksi({ total: 450000.5 }));
    expect(h.ok).toBe(false);
    if (!h.ok) expect(h.pesan).toContain("integer");
  });

  it("menolak item dengan harga pecahan", () => {
    const t = transaksi();
    const h = periksaKiriman({
      ...t,
      items: [{ ...t.items[0]!, hargaSatuan: 1000.25 }],
    });
    expect(h.ok).toBe(false);
  });

  it("menolak jenis tak dikenal", () => {
    expect(periksaKiriman({ id: "abcdefgh", jenis: "entah" }).ok).toBe(false);
  });

  it("menolak produk tanpa nama", () => {
    expect(periksaKiriman({ jenis: "produk", id: "abcdefgh", nama: " " }).ok).toBe(false);
  });

  it("menolak bukan objek", () => {
    expect(periksaKiriman("teks").ok).toBe(false);
  });
});

describe("prosesBatch — IDEMPOTEN", () => {
  it("mengirim transaksi yang sama dua kali tidak menggandakan", async () => {
    const db = new DBTiruan();
    const t = transaksi();

    const a = await prosesBatch(db, [t], "2026-11-10T09:00:00.000Z");
    expect(a.diterima).toHaveLength(1);
    expect(db.tabel.transactions).toHaveLength(1);
    expect(db.tabel.transaction_items).toHaveLength(1);
    expect(db.tabel.payments).toHaveLength(1);

    // Kirim ulang PERSIS sama (mis. retry setelah koneksi putus)
    const b = await prosesBatch(db, [t], "2026-11-10T09:05:00.000Z");
    expect(b.diterima).toHaveLength(1);
    expect(db.tabel.transactions).toHaveLength(1);
    expect(db.tabel.transaction_items).toHaveLength(1);
    expect(db.tabel.payments).toHaveLength(1);
  });

  it("kiriman yang berubah menimpa baris, tidak menambah", async () => {
    const db = new DBTiruan();
    await prosesBatch(db, [transaksi()], "2026-11-10T09:00:00.000Z");
    await prosesBatch(
      db,
      [transaksi({ statusBayar: "dp", diubahPada: "2026-11-10T10:00:00.000Z" })],
      "2026-11-10T10:00:00.000Z",
    );
    expect(db.tabel.transactions).toHaveLength(1);
    expect(db.tabel.transactions[0]?.status_bayar).toBe("dp");
  });

  it("kunciSync membedakan versi berbeda", () => {
    const a = kunciSync(transaksi());
    const b = kunciSync(transaksi({ diubahPada: "2026-11-11T00:00:00.000Z" }));
    expect(a).not.toBe(b);
  });
});

describe("prosesBatch — ketahanan", () => {
  it("satu kiriman rusak tidak membatalkan yang lain", async () => {
    const db = new DBTiruan();
    const hasil = await prosesBatch(
      db,
      [transaksi(), { jenis: "transaksi", id: "22222222-2222-2222-2222-222222222222", total: -5 }, { id: "pendek" }],
      "2026-11-10T09:00:00.000Z",
    );
    expect(hasil.diterima).toHaveLength(1);
    expect(hasil.ditolak).toHaveLength(2);
    expect(db.tabel.transactions).toHaveLength(1);
  });

  it("produk dan bazar tersimpan", async () => {
    const db = new DBTiruan();
    const hasil = await prosesBatch(
      db,
      [
        {
          jenis: "produk",
          id: "33333333-3333-3333-3333-333333333333",
          nama: "Kebaya",
          kode: null,
          hargaJual: 450000,
          stokGudang: 3,
          arsip: false,
          diubahPada: "2026-11-10T08:00:00.000Z",
        },
        {
          jenis: "bazar",
          id: "44444444-4444-4444-4444-444444444444",
          nama: "Pameran",
          status: "aktif",
          lokasi: null,
          mulai: null,
          selesai: null,
          diubahPada: "2026-11-10T08:00:00.000Z",
        },
      ],
      "2026-11-10T09:00:00.000Z",
    );
    expect(hasil.ditolak).toHaveLength(0);
    expect(db.tabel.products).toHaveLength(1);
    expect(db.tabel.bazars).toHaveLength(1);
  });

  it("batch kosong tidak menulis apa pun", async () => {
    const db = new DBTiruan();
    const hasil = await prosesBatch(db, [], "2026-11-10T09:00:00.000Z");
    expect(hasil).toEqual({ diterima: [], ditolak: [] });
    expect(db.tabel.sync_log).toHaveLength(0);
  });
});
