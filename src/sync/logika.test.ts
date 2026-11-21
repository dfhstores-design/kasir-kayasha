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
import {
  alokasiNomor,
  ambilPerubahan,
  kunciSync,
  periksaKiriman,
  prosesBatch,
  type DBCloud,
  type KirimanBiayaBazar,
  type KirimanPin,
  type KirimanTransaksi,
} from "./logika.ts";

/** Kumpulan tabel di memori + pelaksana SQL sederhana untuk pola yang kita pakai. */
class DBTiruan implements DBCloud {
  tabel: Record<string, Array<Record<string, unknown>>> = {
    transactions: [],
    transaction_items: [],
    payments: [],
    products: [],
    bazars: [],
    bazar_biaya: [],
    sync_log: [],
    pin_sync: [],
    penomoran: [],
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
          async all<T>() {
            return { results: db.cariSemua(bersih, nilai) as T[] };
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

  /** Alokasi nomor tiruan (F4): naik 1 per bulan, atomik dalam tiruan. */
  private alokasiNomorTiruan(bulan: string): number {
    const t = this.tabel.penomoran!;
    const baris = t.find((r) => r.bulan === bulan);
    if (baris) {
      baris.terakhir = Number(baris.terakhir ?? 0) + 1;
      return Number(baris.terakhir);
    }
    t.push({ bulan, terakhir: 1 });
    return 1;
  }

  private jalankan(sql: string, nilai: unknown[]) {
    // PIN (F3): yang terbaru menang — kiriman lebih lama diabaikan.
    if (sql.startsWith("INSERT INTO pin_sync")) {
      const [peran, hash, diubahPada, perangkat] = nilai as [string, string | null, string, string | null];
      const t = this.tabel.pin_sync!;
      const i = t.findIndex((r) => r.peran === peran);
      if (i >= 0) {
        if (String(diubahPada) > String(t[i]!.diubah_pada ?? "")) {
          t[i] = { peran, hash, diubah_pada: diubahPada, perangkat };
        }
      } else {
        t.push({ peran, hash, diubah_pada: diubahPada, perangkat });
      }
      return;
    }

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
      if (i >= 0) {
        // Setia dengan SQLite: ON CONFLICT DO UPDATE SET hanya mengubah
        // kolom yang disebut (mis. tombstone hanya mengubah dihapus_pada).
        const m = sql.match(/DO UPDATE SET (.+)$/);
        if (m) {
          const hanya = m[1]!.split(",").map((s) => s.trim().split("=")[0]!.trim());
          for (const k of hanya) t[i]![k] = baris[k];
        } else {
          for (const [k, v] of Object.entries(baris)) t[i]![k] = v;
        }
      } else t.push(baris);
      return;
    }
    throw new Error("SQL tak dikenal: " + sql.slice(0, 40));
  }

  private cari(sql: string, nilai: unknown[]) {
    if (sql.includes("FROM sync_log")) {
      return this.tabel.sync_log!.find((r) => r.kunci === nilai[0]) ?? null;
    }
    if (sql.includes("FROM bazar_biaya")) {
      return this.tabel.bazar_biaya!.find((r) => r.id === nilai[0]) ?? null;
    }
    // F5: hub membaca status tersimpan sebelum menimpa transaksi.
    if (sql.includes("FROM transactions")) {
      return this.tabel.transactions!.find((r) => r.id === nilai[0]) ?? null;
    }
    // Alokasi nomor (F4): INSERT ... RETURNING terakhir.
    if (sql.startsWith("INSERT INTO penomoran")) {
      return { terakhir: this.alokasiNomorTiruan(String(nilai[0])) };
    }
    if (sql.includes("FROM penomoran")) {
      return this.tabel.penomoran!.find((r) => r.bulan === nilai[0]) ?? null;
    }
    throw new Error("SELECT tak dikenal");
  }

  /** SELECT untuk ambilPerubahan: filter diubah_pada + perangkat + IN + LIMIT. */
  private cariSemua(sql: string, nilai: unknown[]): Array<Record<string, unknown>> {
    const tabel = this.namaTabel(sql, "SELECT FROM");
    const baris = [...(this.tabel[tabel] ?? [])];
    if (sql.includes("WHERE transaksi_id IN")) {
      const ids = new Set(nilai.map(String));
      return baris.filter((r) => ids.has(String(r.transaksi_id)));
    }
    if (sql.includes("WHERE diubah_pada > ?")) {
      const sejak = String(nilai[0]);
      let hasil = baris
        .filter((r) => String(r.diubah_pada ?? "") > sejak)
        .sort((a, b) => String(a.diubah_pada ?? "").localeCompare(String(b.diubah_pada ?? "")));
      if (sql.includes("perangkat != ?")) {
        const perangkat = String(nilai[1]);
        hasil = hasil.filter((r) => r.perangkat == null || String(r.perangkat) !== perangkat);
      }
      const batas = Number(nilai[nilai.length - 1]);
      return hasil.slice(0, batas);
    }
    throw new Error("SELECT tak dikenal: " + sql.slice(0, 40));
  }
}

const transaksi = (over: Partial<KirimanTransaksi> = {}): KirimanTransaksi => ({
  jenis: "transaksi",
  id: "11111111-1111-1111-1111-111111111111",
  nomorResi: "KYS-0001",
  waktu: "2026-11-10T08:00:00.000Z",
  jenisDokumen: "penjualan",
  arahStok: "keluar",
  pelangganId: null,
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

const biaya = (over: Partial<KirimanBiayaBazar> = {}): KirimanBiayaBazar => ({
  jenis: "biaya_bazar",
  id: "55555555-5555-5555-5555-555555555555",
  bazarId: "44444444-4444-4444-4444-444444444444",
  kategori: "sewa_booth",
  judul: "Sewa booth",
  nominal: 750000,
  tanggal: "2026-11-10",
  catatan: null,
  dibuatPada: "2026-11-10T08:00:00.000Z",
  diubahPada: "2026-11-10T08:00:00.000Z",
  ...over,
});

describe("periksaKiriman", () => {
  it("menerima transaksi yang sah", () => {
    expect(periksaKiriman(transaksi()).ok).toBe(true);
  });

  it("F1: menerima biaya bazar yang sah", () => {
    expect(periksaKiriman(biaya()).ok).toBe(true);
  });

  it("F1: menolak biaya dengan kategori tak dikenal", () => {
    const h = periksaKiriman(biaya({ kategori: "entah" as KirimanBiayaBazar["kategori"] }));
    expect(h.ok).toBe(false);
  });

  it("F1: menolak biaya dengan nominal negatif", () => {
    expect(periksaKiriman(biaya({ nominal: -1000 })).ok).toBe(false);
  });

  it("F1: tombstone biaya hanya butuh id + waktu hapus", () => {
    expect(
      periksaKiriman({
        jenis: "biaya_bazar",
        id: "55555555-5555-5555-5555-555555555555",
        diubahPada: "2026-11-10T09:00:00.000Z",
        dihapus: true,
      }).ok,
    ).toBe(true);
  });

  it("F8/BU-63: menerima transaksi dengan baris pengembalian DP (pembayaran negatif)", () => {
    const t = transaksi();
    expect(
      periksaKiriman({
        ...t,
        pembayaran: [
          ...t.pembayaran,
          { id: "pay-kembali", nominal: -100000, waktu: "2026-11-10T11:00:00.000Z", metode: "tunai", catatan: "Pengembalian DP" },
        ],
      }).ok,
    ).toBe(true);
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
      [transaksi({ total: 500000, diubahPada: "2026-11-10T10:00:00.000Z" })],
      "2026-11-10T10:00:00.000Z",
    );
    expect(db.tabel.transactions).toHaveLength(1);
    expect(db.tabel.transactions[0]?.total).toBe(500000);
    // F5: status yang mundur TIDAK ikut ditimpa (lunas → dp ditahan).
    await prosesBatch(
      db,
      [transaksi({ statusBayar: "dp", diubahPada: "2026-11-10T11:00:00.000Z" })],
      "2026-11-10T11:00:00.000Z",
    );
    expect(db.tabel.transactions).toHaveLength(1);
    expect(db.tabel.transactions[0]?.status_bayar).toBe("lunas");
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
    expect(hasil).toEqual({ diterima: [], ditolak: [], statusDitahan: [] });
    expect(db.tabel.sync_log).toHaveLength(0);
  });
});

describe("prosesBatch — F5 status hanya maju di hub (BU-33)", () => {
  it("kiriman status mundur ditahan, data lain tetap masuk + tercatat di log", async () => {
    const db = new DBTiruan();
    // Perangkat A sudah mengirim status selesai/lunas.
    await prosesBatch(db, [transaksi()], "2026-11-10T09:00:00.000Z");
    // Perangkat B (offline lama) mengirim status lama + total baru.
    const hasil = await prosesBatch(
      db,
      [
        transaksi({
          statusPesanan: "diproses",
          statusBayar: "dp",
          total: 500000,
          diubahPada: "2026-11-10T10:00:00.000Z",
        }),
      ],
      "2026-11-10T10:00:00.000Z",
    );
    // Kiriman tetap diterima (bukan ditolak): data lain masuk.
    expect(hasil.diterima).toContain("11111111-1111-1111-1111-111111111111");
    expect(hasil.ditolak).toHaveLength(0);
    expect(hasil.statusDitahan).toContain("11111111-1111-1111-1111-111111111111");
    const baris = db.tabel.transactions[0]!;
    expect(baris.status_pesanan).toBe("selesai");
    expect(baris.status_bayar).toBe("lunas");
    expect(baris.total).toBe(500000);
    // Penahanan tercatat di log sinkron hub.
    expect(db.tabel.sync_log.some((r) => r.jenis === "tolak_status")).toBe(true);
  });

  it("status yang maju diterima dan tidak masuk statusDitahan", async () => {
    const db = new DBTiruan();
    await prosesBatch(
      db,
      [transaksi({ statusPesanan: "diproses", statusBayar: "dp" })],
      "2026-11-10T09:00:00.000Z",
    );
    const hasil = await prosesBatch(
      db,
      [transaksi({ statusPesanan: "selesai", statusBayar: "lunas", diubahPada: "2026-11-10T10:00:00.000Z" })],
      "2026-11-10T10:00:00.000Z",
    );
    expect(hasil.statusDitahan).toHaveLength(0);
    expect(db.tabel.transactions[0]?.status_pesanan).toBe("selesai");
    expect(db.tabel.transactions[0]?.status_bayar).toBe("lunas");
  });

  it("campuran: pesanan mundur ditahan, bayar maju tetap diterapkan", async () => {
    const db = new DBTiruan();
    await prosesBatch(
      db,
      [transaksi({ statusPesanan: "selesai", statusBayar: "dp" })],
      "2026-11-10T09:00:00.000Z",
    );
    const hasil = await prosesBatch(
      db,
      [
        transaksi({
          statusPesanan: "diproses",
          statusBayar: "lunas",
          diubahPada: "2026-11-10T10:00:00.000Z",
        }),
      ],
      "2026-11-10T10:00:00.000Z",
    );
    expect(hasil.statusDitahan).toContain("11111111-1111-1111-1111-111111111111");
    expect(db.tabel.transactions[0]?.status_pesanan).toBe("selesai");
    expect(db.tabel.transactions[0]?.status_bayar).toBe("lunas");
  });

  it("void tetap jalan; pesanan batal tidak bisa dihidupkan lagi", async () => {
    const db = new DBTiruan();
    await prosesBatch(
      db,
      [transaksi({ statusPesanan: "diproses", statusBayar: "dp" })],
      "2026-11-10T09:00:00.000Z",
    );
    // Void dari perangkat lain.
    const voidHasil = await prosesBatch(
      db,
      [
        transaksi({
          statusPesanan: "dibatalkan",
          statusBayar: "dp",
          dibatalkanPada: "2026-11-10T10:00:00.000Z",
          diubahPada: "2026-11-10T10:00:00.000Z",
        }),
      ],
      "2026-11-10T10:00:00.000Z",
    );
    expect(voidHasil.statusDitahan).toHaveLength(0);
    expect(db.tabel.transactions[0]?.status_pesanan).toBe("dibatalkan");
    expect(db.tabel.transactions[0]?.dibatalkan_pada).toBe("2026-11-10T10:00:00.000Z");
    // Kiriman lama mencoba menghidupkan lagi (status diproses, tanpa tanggal batal).
    const hidupHasil = await prosesBatch(
      db,
      [
        transaksi({
          statusPesanan: "diproses",
          statusBayar: "dp",
          dibatalkanPada: null,
          diubahPada: "2026-11-10T11:00:00.000Z",
        }),
      ],
      "2026-11-10T11:00:00.000Z",
    );
    expect(hidupHasil.statusDitahan).toContain("11111111-1111-1111-1111-111111111111");
    expect(db.tabel.transactions[0]?.status_pesanan).toBe("dibatalkan");
    expect(db.tabel.transactions[0]?.dibatalkan_pada).toBe("2026-11-10T10:00:00.000Z");
  });

  it("status sama + data baru: diterapkan, tidak masuk statusDitahan", async () => {
    const db = new DBTiruan();
    await prosesBatch(db, [transaksi()], "2026-11-10T09:00:00.000Z");
    const hasil = await prosesBatch(
      db,
      [transaksi({ total: 475000, diubahPada: "2026-11-10T10:00:00.000Z" })],
      "2026-11-10T10:00:00.000Z",
    );
    expect(hasil.statusDitahan).toHaveLength(0);
    expect(db.tabel.transactions[0]?.total).toBe(475000);
    expect(db.tabel.transactions[0]?.status_pesanan).toBe("selesai");
  });

  it("kirim ulang kiriman yang menahan status tetap melaporkan statusDitahan", async () => {
    const db = new DBTiruan();
    await prosesBatch(db, [transaksi()], "2026-11-10T09:00:00.000Z");
    const mundur = transaksi({
      statusPesanan: "diproses",
      statusBayar: "dp",
      diubahPada: "2026-11-10T10:00:00.000Z",
    });
    const pertama = await prosesBatch(db, [mundur], "2026-11-10T10:00:00.000Z");
    expect(pertama.statusDitahan).toContain("11111111-1111-1111-1111-111111111111");
    // Kirim ulang persis sama (retry sesudah respons hilang): tetap diterima,
    // dan penahanan status tetap dilaporkan — bukan hilang diam-diam.
    const ulang = await prosesBatch(db, [mundur], "2026-11-10T10:05:00.000Z");
    expect(ulang.diterima).toContain("11111111-1111-1111-1111-111111111111");
    expect(ulang.statusDitahan).toContain("11111111-1111-1111-1111-111111111111");
    expect(db.tabel.transactions[0]?.status_pesanan).toBe("selesai");
  });
});

describe("ambilPerubahan — tarik (Fase 2B)", () => {
  it("mengembalikan baris sesudah kursor, beserta item & pembayaran", async () => {
    const db = new DBTiruan();
    const kedua = transaksi({
      id: "22222222-2222-2222-2222-222222222222",
      nomorResi: "KYS-0002",
      perangkat: "perangkat-A",
      diubahPada: "2026-11-10T11:00:00.000Z",
    });
    // Id baris item harus beda antar transaksi (di produksi id selalu UUID).
    kedua.items = [{ ...kedua.items[0]!, id: "item-2" }];
    kedua.pembayaran = [{ ...kedua.pembayaran[0]!, id: "pay-2" }];
    await prosesBatch(
      db,
      [transaksi({ perangkat: "perangkat-A", diubahPada: "2026-11-10T10:00:00.000Z" }), kedua],
      "2026-11-10T12:00:00.000Z",
    );
    const hasil = await ambilPerubahan(db, { sejak: "2026-11-10T09:00:00.000Z" });
    expect(hasil.transaksi).toHaveLength(2);
    expect(hasil.transaksi[0]?.items).toHaveLength(1);
    expect(hasil.transaksi[0]?.pembayaran).toHaveLength(1);
    expect(hasil.transaksi[0]?.perangkat).toBe("perangkat-A");
  });

  it("tidak mengembalikan baris yang dikirim perangkat peminta sendiri", async () => {
    const db = new DBTiruan();
    await prosesBatch(db, [transaksi({ perangkat: "perangkat-A" })], "2026-11-10T12:00:00.000Z");
    const hasil = await ambilPerubahan(db, { perangkat: "perangkat-A" });
    expect(hasil.transaksi).toHaveLength(0);
  });

  it("kursor memotong baris yang lebih lama", async () => {
    const db = new DBTiruan();
    await prosesBatch(db, [transaksi({ diubahPada: "2026-11-10T08:00:00.000Z" })], "2026-11-10T12:00:00.000Z");
    const hasil = await ambilPerubahan(db, { sejak: "2026-11-10T09:00:00.000Z" });
    expect(hasil.transaksi).toHaveLength(0);
  });

  it("produk & bazar ikut ditarik sesudah kursor", async () => {
    const db = new DBTiruan();
    await prosesBatch(
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
          pinKasirHash: "sha256$salt$hash",
          diubahPada: "2026-11-10T08:00:00.000Z",
        },
      ],
      "2026-11-10T09:00:00.000Z",
    );
    const hasil = await ambilPerubahan(db, {});
    expect(hasil.produk).toHaveLength(1);
    expect(hasil.bazar).toHaveLength(1);
    expect(hasil.bazar[0]?.pinKasirHash).toBe("sha256$salt$hash");
  });

  it("prosesBatch menyimpan perangkat & kolom baru transaksi", async () => {
    const db = new DBTiruan();
    await prosesBatch(
      db,
      [
        transaksi({
          perangkat: "perangkat-B",
          kontak: "0812000000",
          catatanPesanan: "Kebaya brokat",
          nomorUrutBulan: 3,
          jenisBayar: "transfer",
        }),
      ],
      "2026-11-10T12:00:00.000Z",
    );
    const baris = db.tabel.transactions[0]!;
    expect(baris.perangkat).toBe("perangkat-B");
    expect(baris.kontak).toBe("0812000000");
    expect(baris.nomor_urut_bulan).toBe(3);
    expect(baris.jenis_bayar).toBe("transfer");
  });
});

describe("biaya bazar tersinkron (F1, BU-34)", () => {
  it("biaya tersimpan dan ditarik perangkat lain", async () => {
    const db = new DBTiruan();
    const hasil = await prosesBatch(db, [biaya()], "2026-11-10T09:00:00.000Z");
    expect(hasil.ditolak).toHaveLength(0);
    expect(db.tabel.bazar_biaya).toHaveLength(1);
    expect(db.tabel.bazar_biaya[0]?.judul).toBe("Sewa booth");
    expect(db.tabel.bazar_biaya[0]?.nominal).toBe(750000);

    const tarik = await ambilPerubahan(db, {});
    expect(tarik.biayaBazar).toHaveLength(1);
    expect(tarik.biayaBazar[0]?.judul).toBe("Sewa booth");
    expect(tarik.biayaBazar[0]?.dihapus).toBeUndefined();
  });

  it("kirim ulang biaya yang sama tidak menggandakan", async () => {
    const db = new DBTiruan();
    await prosesBatch(db, [biaya()], "2026-11-10T09:00:00.000Z");
    const ulang = await prosesBatch(db, [biaya()], "2026-11-10T09:05:00.000Z");
    expect(ulang.diterima).toHaveLength(1);
    expect(db.tabel.bazar_biaya).toHaveLength(1);
  });

  it("tombstone menandai hapus dan ikut ditarik", async () => {
    const db = new DBTiruan();
    await prosesBatch(db, [biaya()], "2026-11-10T09:00:00.000Z");
    const hapus = await prosesBatch(
      db,
      [biaya({ diubahPada: "2026-11-10T10:00:00.000Z", dihapus: true })],
      "2026-11-10T10:00:00.000Z",
    );
    expect(hapus.ditolak).toHaveLength(0);
    expect(db.tabel.bazar_biaya).toHaveLength(1);
    expect(db.tabel.bazar_biaya[0]?.dihapus_pada).toBe("2026-11-10T10:00:00.000Z");

    const tarik = await ambilPerubahan(db, { sejak: "2026-11-10T09:30:00.000Z" });
    expect(tarik.biayaBazar).toHaveLength(1);
    expect(tarik.biayaBazar[0]?.dihapus).toBe(true);
  });

  it("upsert yang lebih lama dari tombstone tidak menghidupkan lagi", async () => {
    const db = new DBTiruan();
    await prosesBatch(db, [biaya()], "2026-11-10T09:00:00.000Z");
    await prosesBatch(
      db,
      [biaya({ diubahPada: "2026-11-10T10:00:00.000Z", dihapus: true })],
      "2026-11-10T10:00:00.000Z",
    );
    // Kiriman lama yang datang belakangan (jam perangkat selisih): tetap diterima
    // (supaya antrean pengirim bersih) tapi tidak menulis ulang baris.
    const telat = await prosesBatch(
      db,
      [biaya({ diubahPada: "2026-11-10T09:30:00.000Z", judul: "Sewa booth (lama)" })],
      "2026-11-10T10:30:00.000Z",
    );
    expect(telat.diterima).toHaveLength(1);
    expect(db.tabel.bazar_biaya[0]?.dihapus_pada).toBe("2026-11-10T10:00:00.000Z");
    expect(db.tabel.bazar_biaya[0]?.judul).toBe("Sewa booth");
  });

  it("biaya rusak ditolak sendiri, biaya sah tetap masuk", async () => {
    const db = new DBTiruan();
    const hasil = await prosesBatch(
      db,
      [biaya(), biaya({ id: "66666666-6666-6666-6666-666666666666", nominal: -5 })],
      "2026-11-10T09:00:00.000Z",
    );
    expect(hasil.diterima).toHaveLength(1);
    expect(hasil.ditolak).toHaveLength(1);
    expect(db.tabel.bazar_biaya).toHaveLength(1);
  });
});

describe("PIN tersinkron — hash saja, tidak pernah teks biasa (F3, BU-32/33)", () => {
  const HASH_A = "sha256$saltA$digestA";
  const HASH_B = "sha256$saltB$digestB";
  const pin = (over: Partial<KirimanPin> = {}): KirimanPin => ({
    jenis: "pin",
    id: "pin:admin",
    peran: "admin",
    hash: HASH_A,
    diubahPada: "2026-11-21T10:00:00.000Z",
    perangkat: "hp-a",
    ...over,
  });

  it("PIN polos ditolak — yang bukan format sha256$salt$digest tidak masuk", async () => {
    const db = new DBTiruan();
    const hasil = await prosesBatch(db, [pin({ hash: "1234" })], "2026-11-21T10:00:00.000Z");
    expect(hasil.diterima).toHaveLength(0);
    expect(hasil.ditolak).toHaveLength(1);
    expect(db.tabel.pin_sync).toHaveLength(0);
  });

  it("PIN kosong (string kosong) ditolak — penghapusan hanya lewat hash null", async () => {
    const db = new DBTiruan();
    const hasil = await prosesBatch(db, [pin({ hash: "" })], "2026-11-21T10:00:00.000Z");
    expect(hasil.ditolak).toHaveLength(1);
    expect(db.tabel.pin_sync).toHaveLength(0);
  });

  it("hash PIN diterima dan bisa ditarik perangkat lain", async () => {
    const db = new DBTiruan();
    const hasil = await prosesBatch(db, [pin()], "2026-11-21T10:00:00.000Z");
    expect(hasil.diterima).toHaveLength(1);
    expect(db.tabel.pin_sync).toHaveLength(1);
    expect(db.tabel.pin_sync[0]?.hash).toBe(HASH_A);

    const tarik = await ambilPerubahan(db, { sejak: "2026-11-21T09:00:00.000Z" });
    expect(tarik.pin).toHaveLength(1);
    expect(tarik.pin[0]?.peran).toBe("admin");
    expect(tarik.pin[0]?.hash).toBe(HASH_A);
  });

  it("yang terbaru menang — kiriman lama tidak menimpa PIN yang lebih baru", async () => {
    const db = new DBTiruan();
    await prosesBatch(db, [pin()], "2026-11-21T10:00:00.000Z");
    const telat = await prosesBatch(
      db,
      [pin({ hash: HASH_B, diubahPada: "2026-11-21T09:00:00.000Z", perangkat: "hp-b" })],
      "2026-11-21T10:05:00.000Z",
    );
    expect(telat.diterima).toHaveLength(1); // antrean pengirim dibersihkan
    expect(db.tabel.pin_sync[0]?.hash).toBe(HASH_A);
  });

  it("yang lebih baru menimpa — PIN diganti di perangkat lain", async () => {
    const db = new DBTiruan();
    await prosesBatch(db, [pin()], "2026-11-21T10:00:00.000Z");
    await prosesBatch(
      db,
      [pin({ hash: HASH_B, diubahPada: "2026-11-21T11:00:00.000Z", perangkat: "hp-b" })],
      "2026-11-21T11:00:00.000Z",
    );
    expect(db.tabel.pin_sync[0]?.hash).toBe(HASH_B);
  });

  it("hapus PIN (hash null) diterima dan ikut ditarik", async () => {
    const db = new DBTiruan();
    await prosesBatch(db, [pin()], "2026-11-21T10:00:00.000Z");
    await prosesBatch(
      db,
      [pin({ hash: null, diubahPada: "2026-11-21T12:00:00.000Z", perangkat: "hp-b" })],
      "2026-11-21T12:00:00.000Z",
    );
    expect(db.tabel.pin_sync[0]?.hash).toBeNull();
    const tarik = await ambilPerubahan(db, { sejak: "2026-11-21T11:00:00.000Z" });
    expect(tarik.pin).toHaveLength(1);
    expect(tarik.pin[0]?.hash).toBeNull();
  });

  it("peran di luar admin/owner/kasir_toko ditolak", async () => {
    const db = new DBTiruan();
    const hasil = await prosesBatch(
      db,
      // @ts-expect-error peran sengaja tidak sah untuk menguji penolakan
      [pin({ peran: "kasir_bazar" })],
      "2026-11-21T10:00:00.000Z",
    );
    expect(hasil.ditolak).toHaveLength(1);
    expect(db.tabel.pin_sync).toHaveLength(0);
  });

  it("tarik tidak mengembalikan PIN dari perangkat yang sama", async () => {
    const db = new DBTiruan();
    await prosesBatch(db, [pin()], "2026-11-21T10:00:00.000Z");
    const tarik = await ambilPerubahan(db, { sejak: "2026-11-21T09:00:00.000Z", perangkat: "hp-a" });
    expect(tarik.pin).toHaveLength(0);
  });
});

describe("nomor urut dari hub — dua perangkat tidak dapat nomor sama (F4, BU-19/21)", () => {
  it("alokasi berurutan 1, 2, 3 dalam satu bulan", async () => {
    const db = new DBTiruan();
    expect(await alokasiNomor(db, "2026-11")).toBe(1);
    expect(await alokasiNomor(db, "2026-11")).toBe(2);
    expect(await alokasiNomor(db, "2026-11")).toBe(3);
  });

  it("bulan baru mulai lagi dari 1", async () => {
    const db = new DBTiruan();
    await alokasiNomor(db, "2026-11");
    await alokasiNomor(db, "2026-11");
    expect(await alokasiNomor(db, "2026-12")).toBe(1);
  });

  it("nomor yang sudah dialokasikan tidak dipakai ulang", async () => {
    const db = new DBTiruan();
    await alokasiNomor(db, "2026-11");
    // Perangkat membatalkan pesanannya: tidak ada pengembalian nomor.
    expect(await alokasiNomor(db, "2026-11")).toBe(2);
  });
});
