import { beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { resetKoneksiDB, type ProdukRecord, type Rekening } from "../db/schema.ts";
import { ambilTransaksi, daftarProduk, simpanProduk } from "../db/repositori.ts";
import {
  ambilPesananJahit,
  catatPengiriman,
  daftarPesananJahit,
  daftarPerluDitagih,
  simpanPesananJahit,
  ubahPesananJahit,
  type RencanaJahitan,
} from "./jahitan.ts";
import { batalkanPesananKasir, terimaPembayaranKasir, CATATAN_PENGEMBALIAN_DP } from "../db/kasirOperasi.ts";
import { batalkanTransaksi } from "../db/pesananOperasi.ts";
import { simpanPenjualan, type ItemPilihan, type RencanaPenjualan } from "./penjualan.ts";
import { hitungRingkasanKeuangan } from "./bazar.ts";
import { judulDokumen, labelJudul, nomorPlaceholder, sisaDokumen, susunDokumen, teksDokumen, type DataDokumen } from "./dokumen.ts";

/**
 * Uji alur DEMO end-to-end (integrasi & tes demo, bukan fitur baru).
 * Merangkai lapisan murni + persistensi untuk memastikan 3 alur yang
 * didemonstrasikan ke Tante benar-benar jalan tanpa buka aplikasi manual.
 *
 * Alur 1 (kasir): simpan pesanan lalu terima DP lalu terima pelunasan lalu lunas + kembalian.
 * Alur 2 (tante): daftar Belum Lunas lalu perlu ditagih lalu detail lalu status benar.
 * Alur 3 (cetak): sisa>0 menjadi INVOICE (ada SISA); lunas menjadi RESI (tanpa SISA).
 */

function resetDB() {
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  resetKoneksiDB();
  try {
    localStorage.clear();
  } catch {
    // lingkungan tanpa localStorage: abaikan
  }
}

const rekening: Rekening = {
  id: "rek-1",
  namaBank: "BCA",
  nomor: "676 017 885",
  namaPemilik: "NARSHITA DEWI",
  utama: true,
};

function rencana(over: Partial<RencanaJahitan> = {}): RencanaJahitan {
  return {
    namaPemesan: "Ibu Sari",
    kontak: "0812 0000 0000",
    items: [{ nama: "Gaun pesta", harga: 300000, kuantitas: 1, ukuran: "M" }],
    perkiraanSelesai: "2027-01-01",
    catatan: null,
    biayaLain: [{ nama: "Bahan payet", nominal: 50000 }],
    ...over,
  };
}

function dokumenDari(data: {
  nomor: string;
  namaPemesan: string;
  model: string;
  total: number;
  terbayar: number;
}): DataDokumen {
  return {
    nomor: data.nomor,
    tanggal: "2026-11-16T07:20:00.000Z",
    namaPemesan: data.namaPemesan,
    items: [{ nama: data.model, kuantitas: 1, harga: 300000, ukuran: "M" }],
    perkiraanSelesai: "2026-11-23",
    biayaLain: [{ nama: "Bahan payet", nominal: 50000 }],
    total: data.total,
    terbayar: data.terbayar,
  };
}

describe("ALUR 1 - kasir: DP lalu pelunasan lalu lunas + kembalian", () => {
  beforeEach(resetDB);

  it("DP lalu pelunasan pas: status lunas, sisa 0, kembalian 0", async () => {
    const h = await simpanPesananJahit(rencana(), { rekening: [rekening], waktu: new Date("2026-11-16T07:20:00.000Z") });
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    const id = h.pesanan.id;

    const dp = await terimaPembayaranKasir(id, 150000, "tunai");
    expect(dp.ok).toBe(true);
    if (!dp.ok) return;
    expect(dp.sisa).toBe(200000);
    expect(dp.kembalian).toBe(0);
    expect(dp.statusDokumen).toBe("terbuka");

    const lunas = await terimaPembayaranKasir(id, 200000, "transfer");
    expect(lunas.ok).toBe(true);
    if (!lunas.ok) return;
    expect(lunas.sisa).toBe(0);
    expect(lunas.kembalian).toBe(0);
    expect(lunas.statusDokumen).toBe("lunas");

    const detail = await ambilPesananJahit(id);
    expect(detail?.status).toBe("lunas");
    expect(detail?.terbayar).toBe(350000);
    expect(detail?.sisa).toBe(0);
  });

  it("boleh bayar LEBIH dari total: kembalian tampil, tetap lunas (BU-17.B)", async () => {
    const h = await simpanPesananJahit(rencana(), { rekening: [rekening] });
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    const id = h.pesanan.id;

    const hasil = await terimaPembayaranKasir(id, 400000, "tunai");
    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    expect(hasil.kembalian).toBe(50000);
    expect(hasil.sisa).toBe(0);
    expect(hasil.statusDokumen).toBe("lunas");

    const ulang = await terimaPembayaranKasir(id, 10000, "tunai");
    expect(ulang.ok).toBe(false);
  });
});

describe("ALUR 2 - tante: wizard lalu daftar lalu perlu ditagih lalu detail", () => {
  beforeEach(resetDB);

  it("daftar Belum Lunas dan perlu ditagih memunculkan pesanan yang benar", async () => {
    const h = await simpanPesananJahit(rencana(), { rekening: [rekening], waktu: new Date("2026-11-16T07:20:00.000Z") });
    expect(h.ok).toBe(true);
    if (!h.ok) return;

    const daftar = await daftarPesananJahit();
    expect(daftar).toHaveLength(1);
    expect(daftar[0]?.status).toBe("terbuka");
    expect(daftar[0]?.model).toBe("Gaun pesta");
    expect(daftar[0]?.sisa).toBe(350000);

    const lewat = await simpanPesananJahit(
      rencana({
        items: [{ nama: "Kebaya", harga: 300000, kuantitas: 1, ukuran: null }],
        perkiraanSelesai: "2020-01-01",
      }),
      {
        rekening: [rekening],
      },
    );
    expect(lewat.ok).toBe(true);

    const tagih = await daftarPerluDitagih(new Date("2026-11-16T00:00:00.000Z"));
    expect(tagih).toHaveLength(1);
    expect(tagih[0]?.model).toBe("Kebaya");
  });

  it("detail menampilkan status & sisa dengan benar, dan tanda kirim terisi", async () => {
    const h = await simpanPesananJahit(rencana(), { rekening: [rekening] });
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    const id = h.pesanan.id;

    let detail = await ambilPesananJahit(id);
    expect(detail?.status).toBe("terbuka");
    expect(detail?.sisa).toBe(350000);
    expect(detail?.sudahDikirim).toBe(false);

    await catatPengiriman(id, h.pesanan.pelangganId, "invoice", "whatsapp");

    detail = await ambilPesananJahit(id);
    expect(detail?.sudahDikirim).toBe(true);
  });
});

describe("ALUR 3 - cetak resi/nota: invoice (SISA) lalu resi (tanpa SISA)", () => {
  it("judul otomatis & SISA mengikuti sisa (K-02, BU-17.A)", () => {
    const belumLunas = dokumenDari({ nomor: "KC.1-20261116", namaPemesan: "Ibu Sari", model: "Gaun pesta", total: 350000, terbayar: 150000 });
    expect(judulDokumen(sisaDokumen(belumLunas))).toBe("invoice");
    expect(labelJudul("invoice")).toBe("INVOICE / NOTA PESANAN");
    const t1 = teksDokumen(susunDokumen(belumLunas));
    expect(t1).toContain("SISA");
    expect(t1).toContain("INVOICE / NOTA PESANAN");

    const lunas = dokumenDari({ nomor: "KC.1-20261116", namaPemesan: "Ibu Sari", model: "Gaun pesta", total: 350000, terbayar: 350000 });
    expect(judulDokumen(sisaDokumen(lunas))).toBe("resi");
    expect(labelJudul("resi")).toBe("RESI / BUKTI PEMBAYARAN");
    const t2 = teksDokumen(susunDokumen(lunas));
    expect(t2).not.toContain("SISA");
    expect(t2).toContain("RESI / BUKTI PEMBAYARAN");
  });

  it("nomor placeholder KC.00001-YYYYMMDD, urutan bulanan 5 digit (BU-19/21)", () => {
    expect(nomorPlaceholder("2026-11-16T07:20:00.000Z")).toBe("KC.00001-20261116");
  });

  it("nama resmi KAYESA - bukan ejaan lama", () => {
    const s = teksDokumen(susunDokumen(dokumenDari({ nomor: "KC.1-20261116", namaPemesan: "Ibu Sari", model: "Gaun pesta", total: 350000, terbayar: 150000 })));
    expect(s).toContain("KAYESA");
    expect(s).not.toContain("KAYESYA");
    expect(s).not.toContain("Kayesha");
  });
});

describe("VOID - pembatalan kasir dengan alasan (BU-17.C)", () => {
  beforeEach(resetDB);

  it("void menandai batal, alasan tercatat, jurnal balik ditulis bila ada uang", async () => {
    const h = await simpanPesananJahit(rencana(), { rekening: [rekening] });
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    const id = h.pesanan.id;

    await terimaPembayaranKasir(id, 150000, "tunai");

    const b = await batalkanPesananKasir(id, "Salah ukuran");
    expect(b.ok).toBe(true);

    const detail = await ambilPesananJahit(id);
    expect(detail?.status).toBe("batal");
    expect(detail?.transaksi.catatanPesanan).toContain("Dibatalkan: Salah ukuran");
  });
});

describe("F8/BU-63: DP pesanan yang dibatalkan DIKEMBALIKAN ke pelanggan", () => {
  beforeEach(resetDB);

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

  function rencanaJual(p: ProdukRecord, kuantitas: number): RencanaPenjualan {
    const item: ItemPilihan = { produkId: p.id, nama: p.nama, hargaSatuan: p.hargaJual, kuantitas, diskonPerUnit: 0 };
    return {
      items: [item],
      diskonTotal: 0,
      ongkir: { mode: "ambil_sendiri", nominal: 0 },
      jenisBayar: "tunai",
      statusBayar: "lunas",
      dibayarSekarang: 0,
      bazarId: null,
    };
  }

  it("void pesanan ber-DP menulis baris pengembalian negatif per metode + uang masuk Ringkasan net 0", async () => {
    const h = await simpanPesananJahit(rencana(), { rekening: [rekening] });
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    const id = h.pesanan.id;

    await terimaPembayaranKasir(id, 150000, "tunai");
    const b = await batalkanPesananKasir(id, "Pelanggan membatalkan");
    expect(b.ok).toBe(true);

    const lengkap = await ambilTransaksi(id);
    expect(lengkap).toBeDefined();
    const bayar = lengkap?.pembayaran ?? [];
    // DP awal tetap ada (append-only) + satu baris pengembalian negatif.
    expect(bayar.some((p) => p.nominal === 150000 && p.metode === "tunai")).toBe(true);
    const kembali = bayar.find((p) => p.nominal < 0);
    expect(kembali?.nominal).toBe(-150000);
    expect(kembali?.metode).toBe("tunai");
    expect(kembali?.catatan).toBe(CATATAN_PENGEMBALIAN_DP);

    // Detail: terbayar tetap 150rb (uang memang pernah diterima), dikembalikan 150rb.
    const detail = await ambilPesananJahit(id);
    expect(detail?.terbayar).toBe(150000);
    expect(detail?.dikembalikan).toBe(150000);

    // Ringkasan: omzet tidak masuk, uang masuk net 0, pengembalian 150rb.
    const ringkas = hitungRingkasanKeuangan([
      {
        total: lengkap?.transaksi.total ?? 0,
        jenisBayar: "tunai",
        dibatalkan: true,
        waktu: lengkap?.transaksi.waktu ?? "",
        pembayaran: bayar.map((p) => ({ nominal: p.nominal, metode: p.metode === "tunai" ? "tunai" as const : null, waktu: p.waktu })),
      },
    ], []);
    expect(ringkas.omzet).toBe(0);
    expect(ringkas.uangMasuk).toBe(0);
    expect(ringkas.tunai).toBe(0);
    expect(ringkas.pengembalian).toBe(150000);
  });

  it("void TANPA alasan ditolak (alasan kosong / kurang dari 3 huruf)", async () => {
    const h = await simpanPesananJahit(rencana(), { rekening: [rekening] });
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    const id = h.pesanan.id;

    expect((await batalkanPesananKasir(id, "")).ok).toBe(false);
    expect((await batalkanPesananKasir(id, "ab")).ok).toBe(false);
    expect((await batalkanPesananKasir(id, "  ")).ok).toBe(false);
    // Pesanan belum batal — masih bisa dibatalkan dengan alasan yang sah.
    expect((await batalkanPesananKasir(id, "Salah ukuran")).ok).toBe(true);
  });

  it("perbaikan catatan/detail pesanan (BU-56) tetap bisa TANPA alasan pembatalan", async () => {
    const h = await simpanPesananJahit(rencana(), { rekening: [rekening] });
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    const id = h.pesanan.id;
    await terimaPembayaranKasir(id, 150000, "tunai");

    // Ubah catatan + detail tanpa alasan batal apa pun — aturan BU-63 hanya
    // berlaku untuk pembatalan transaksi keuangan, bukan perbaikan catatan.
    const ubah = await ubahPesananJahit(id, rencana({ catatan: "Tambah payet di lengan" }));
    expect(ubah.ok).toBe(true);
    const detail = await ambilPesananJahit(id);
    expect(detail?.status).toBe("terbuka");
    expect(detail?.catatan).toBe("Tambah payet di lengan");
  });

  it("void penjualan barang juga wajib alasan + DP dikembalikan + stok kembali", async () => {
    const blus = await produkBaru("Blus Linen", 180000, 5);
    const jual = await simpanPenjualan(rencanaJual(blus, 2), { rekening: [] });
    expect(jual.ok).toBe(true);
    if (!jual.ok) return;
    const id = jual.transaksi.id;

    expect((await batalkanTransaksi(id, "")).ok).toBe(false);
    const b = await batalkanTransaksi(id, "Barang cacat, pelanggan minta batal");
    expect(b.ok).toBe(true);

    const lengkap = await ambilTransaksi(id);
    expect(lengkap?.transaksi.statusPesanan).toBe("dibatalkan");
    expect(lengkap?.transaksi.catatanPesanan).toContain("Dibatalkan: Barang cacat");
    const bayar = lengkap?.pembayaran ?? [];
    expect(bayar.some((p) => p.nominal === 360000)).toBe(true);
    expect(bayar.some((p) => p.nominal === -360000 && p.catatan === CATATAN_PENGEMBALIAN_DP)).toBe(true);
    // Stok gudang kembali 5 (2 terjual dibatalkan).
    expect((await daftarProduk())[0]?.stokGudang).toBe(5);
  });

  it("F6: batal ganda bersamaan (double-tap) hanya mengembalikan stok sekali", async () => {
    const blus = await produkBaru("Blus Linen", 180000, 10);
    const jual = await simpanPenjualan(rencanaJual(blus, 1), { rekening: [] });
    expect(jual.ok).toBe(true);
    if (!jual.ok) return;
    const id = jual.transaksi.id;
    expect((await daftarProduk())[0]?.stokGudang).toBe(9);

    // Dua panggilan batal bersamaan (mis. tombol ditekan dua kali):
    // hanya satu yang boleh berhasil — yang kedua harus ditolak karena
    // transaksi sudah dibatalkan. Tanpa penjaga di dalam transaksi tulis,
    // keduanya lolos dan stok kembali 2x (9→11, temuan F6).
    const [a, b] = await Promise.all([
      batalkanTransaksi(id, "Pelanggan membatalkan"),
      batalkanTransaksi(id, "Pelanggan membatalkan lagi"),
    ]);
    const berhasil = [a, b].filter((h) => h.ok);
    expect(berhasil).toHaveLength(1);
    expect((await daftarProduk())[0]?.stokGudang).toBe(10);
    const lengkap = await ambilTransaksi(id);
    const kembali = (lengkap?.pembayaran ?? []).filter((p) => p.nominal < 0);
    expect(kembali).toHaveLength(1);
    expect(kembali[0]?.nominal).toBe(-180000);
  });

  it("F6: batal ganda pesanan jahit ber-DP hanya mengembalikan DP sekali", async () => {
    const h = await simpanPesananJahit(rencana(), { rekening: [rekening] });
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    const id = h.pesanan.id;
    expect((await terimaPembayaranKasir(id, 150000, "tunai")).ok).toBe(true);

    const [a, b] = await Promise.all([
      batalkanPesananKasir(id, "Pelanggan membatalkan"),
      batalkanPesananKasir(id, "Pelanggan membatalkan lagi"),
    ]);
    const berhasil = [a, b].filter((h2) => h2.ok);
    expect(berhasil).toHaveLength(1);
    const lengkap = await ambilTransaksi(id);
    const kembali = (lengkap?.pembayaran ?? []).filter((p) => p.nominal < 0);
    expect(kembali).toHaveLength(1);
    expect(kembali[0]?.nominal).toBe(-150000);
    const db = await (await import("../db/schema.ts")).getDB();
    const jurnalBatal = (await db.getAll("journal")).filter((j) => j.dokumenId === id && j.kategori === "pembatalan");
    expect(jurnalBatal).toHaveLength(1);
  });
});