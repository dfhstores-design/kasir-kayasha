/**
 * Seed demo KAYESA — data contoh untuk demo Tante.
 *
 * HANYA jalan bila database masih kosong: settings belum terisi DAN tidak ada
 * produk DAN tidak ada transaksi DAN tidak ada bazar aktif. Bila salah satu
 * sudah ada, seed diam-diam tidak melakukan apa pun, supaya data asli Tante
 * tidak pernah tertimpa atau tercampur.
 *
 * Semua data contoh diberi label CONTOH yang jelas, supaya bisa dibedakan
 * dari data asli dan bisa dihapus setelah demo.
 *
 * Urutan: settings -> produk -> bazar + alokasi -> 10 penjualan (dari saldo
 * bazar, stok berkurang) -> 3 PO (tidak mengurangi stok saat dibuat).
 * Logo TIDAK di-seed: sesuai keputusan di CATATAN-DISKUSI.md, logo diunggah
 * Tante sendiri lewat Pengaturan. PIN juga TIDAK di-seed (pinHash null).
 */
import {
  alokasikanKeBazar,
  ambilSettings,
  bazarAktif,
  buatBazar,
  buatId,
  daftarProduk,
  daftarTransaksi,
  simpanProduk,
  simpanSettings,
  type BazarRecord,
  type ProdukRecord,
  type SettingsRecord,
} from "./repositori.ts";
import { simpanPenjualan, type JenisBayar } from "../lib/penjualan.ts";
import { simpanPO } from "./pesanan.ts";
import { ubahStatusPesanan } from "./pesananOperasi.ts";
import type { StatusBayar } from "../lib/keranjang.ts";

export const SETTINGS_DEMO: SettingsRecord = {
  id: "utama",
  namaButik: "KAYESA",
  alamatBaris1: "Jl. Tarumanegara No. 41",
  alamatBaris2: "Sebelah Pempak Nyai",
  kotaKodePos: "Ploso Ciptum 15419",
  telepon1: "0812 1141 4017",
  telepon2: "0821 1376 5892",
  teksPenutup: "Terima kasih, sampai jumpa!",
  logo: null,
  rekening: [
    {
      id: "rekening-demo-bca",
      namaBank: "BCA",
      nomor: "676 017 885",
      namaPemilik: "NARSHITA DEWI",
      utama: true,
    },
  ],
  tampilkanSapaan: true,
  tampilkanNomorResi: true,
  tampilkanRincianDiskon: true,
  tampilkanPembayaranSisa: true,
  pinHash: null,
  updatedAt: new Date().toISOString(),
};

const PRODUK_DEMO: Array<{ nama: string; hargaJual: number; stokGudang: number }> = [
  { nama: "Blus Linen", hargaJual: 180000, stokGudang: 12 },
  { nama: "Rok Plisket", hargaJual: 220000, stokGudang: 10 },
  { nama: "Kemeja Katun", hargaJual: 195000, stokGudang: 8 },
  { nama: "Dress Batik", hargaJual: 285000, stokGudang: 6 },
  { nama: "Celana Kulot", hargaJual: 165000, stokGudang: 9 },
];

/** Jumlah tiap produk yang dibawa ke bazar demo (diambil dari stok gudang). */
const ALOKASI_BAZAR: Record<string, number> = {
  "Blus Linen": 8,
  "Rok Plisket": 7,
  "Kemeja Katun": 6,
  "Dress Batik": 5,
  "Celana Kulot": 6,
};

interface PenjualanDemo {
  waktu: string;
  items: Array<{ nama: string; kuantitas: number }>;
  jenisBayar: JenisBayar;
  statusBayar: StatusBayar;
  dibayarSekarang: number;
}

const PENJUALAN_DEMO: PenjualanDemo[] = [
  { waktu: "2026-11-14T09:00:00+07:00", items: [{ nama: "Blus Linen", kuantitas: 1 }], jenisBayar: "tunai", statusBayar: "lunas", dibayarSekarang: 0 },
  { waktu: "2026-11-14T14:30:00+07:00", items: [{ nama: "Rok Plisket", kuantitas: 1 }, { nama: "Celana Kulot", kuantitas: 1 }], jenisBayar: "transfer", statusBayar: "lunas", dibayarSekarang: 0 },
  { waktu: "2026-11-15T10:15:00+07:00", items: [{ nama: "Kemeja Katun", kuantitas: 2 }], jenisBayar: "qris", statusBayar: "lunas", dibayarSekarang: 0 },
  { waktu: "2026-11-15T16:00:00+07:00", items: [{ nama: "Dress Batik", kuantitas: 1 }], jenisBayar: "tunai", statusBayar: "lunas", dibayarSekarang: 0 },
  { waktu: "2026-11-16T09:45:00+07:00", items: [{ nama: "Blus Linen", kuantitas: 2 }], jenisBayar: "transfer", statusBayar: "lunas", dibayarSekarang: 0 },
  { waktu: "2026-11-16T13:20:00+07:00", items: [{ nama: "Celana Kulot", kuantitas: 2 }], jenisBayar: "tunai", statusBayar: "lunas", dibayarSekarang: 0 },
  { waktu: "2026-11-16T17:10:00+07:00", items: [{ nama: "Rok Plisket", kuantitas: 1 }], jenisBayar: "qris", statusBayar: "lunas", dibayarSekarang: 0 },
  { waktu: "2026-11-17T09:30:00+07:00", items: [{ nama: "Kemeja Katun", kuantitas: 1 }, { nama: "Blus Linen", kuantitas: 1 }], jenisBayar: "tunai", statusBayar: "lunas", dibayarSekarang: 0 },
  { waktu: "2026-11-17T11:00:00+07:00", items: [{ nama: "Dress Batik", kuantitas: 1 }], jenisBayar: "transfer", statusBayar: "dp", dibayarSekarang: 100000 },
  { waktu: "2026-11-17T15:40:00+07:00", items: [{ nama: "Rok Plisket", kuantitas: 2 }], jenisBayar: "qris", statusBayar: "lunas", dibayarSekarang: 0 },
];

interface PODemo {
  namaPemesan: string;
  items: Array<{ nama: string; kuantitas: number }>;
  dibayarSekarang: number;
  jenisBayar: JenisBayar | null;
  perkiraanSiap: string;
  jadiSiap: boolean;
}

const PO_DEMO: PODemo[] = [
  { namaPemesan: "CONTOH – Sari", items: [{ nama: "Blus Linen", kuantitas: 1 }, { nama: "Rok Plisket", kuantitas: 1 }], dibayarSekarang: 200000, jenisBayar: "transfer", perkiraanSiap: "2026-11-19", jadiSiap: false },
  { namaPemesan: "CONTOH – Dewi", items: [{ nama: "Dress Batik", kuantitas: 1 }], dibayarSekarang: 0, jenisBayar: null, perkiraanSiap: "2026-11-20", jadiSiap: false },
  { namaPemesan: "CONTOH – Rina", items: [{ nama: "Kemeja Katun", kuantitas: 2 }, { nama: "Celana Kulot", kuantitas: 1 }], dibayarSekarang: 300000, jenisBayar: "qris", perkiraanSiap: "2026-11-19", jadiSiap: true },
];

/** True bila database masih kosong dan seed boleh jalan. */
export async function databaseMasihKosong(): Promise<boolean> {
  const [settings, produk, transaksi, bazar] = await Promise.all([
    ambilSettings(),
    daftarProduk(true),
    daftarTransaksi(),
    bazarAktif(),
  ]);
  return (
    settings.namaButik.trim() === "" &&
    produk.length === 0 &&
    transaksi.length === 0 &&
    !bazar
  );
}

/**
 * Mengisi settings default + 5 produk + 1 bazar demo + 10 penjualan +
 * 3 PO. Mengembalikan true bila seed dijalankan, false bila database
 * sudah berisi data (tidak ada yang diubah).
 */
export async function jalankanSeedDemo(): Promise<boolean> {
  if (!(await databaseMasihKosong())) return false;

  const sekarang = new Date().toISOString();
  await simpanSettings({ ...SETTINGS_DEMO, updatedAt: sekarang });

  const produk: ProdukRecord[] = [];
  for (const d of PRODUK_DEMO) {
    const p: ProdukRecord = {
      id: buatId(),
      nama: d.nama,
      kode: null,
      hargaJual: d.hargaJual,
      stokGudang: d.stokGudang,
      catatan: "DATA CONTOH DEMO",
      arsip: false,
      createdAt: sekarang,
      updatedAt: sekarang,
    };
    await simpanProduk(p);
    produk.push(p);
  }
  const produkDariNama = new Map(produk.map((p) => [p.nama, p]));

  const bazar: BazarRecord = await buatBazar("Demo Bazar KAYESA", "2026-11-14", "2026-11-20", {
    lokasi: null,
    catatan: "DATA CONTOH DEMO",
  });
  for (const [nama, jumlah] of Object.entries(ALOKASI_BAZAR)) {
    const p = produkDariNama.get(nama);
    if (p) await alokasikanKeBazar(bazar.id, p.id, jumlah);
  }

  for (const jual of PENJUALAN_DEMO) {
    const hasil = await simpanPenjualan(
      {
        items: jual.items.map((i) => {
          const p = produkDariNama.get(i.nama);
          if (!p) throw new Error(`Produk demo tidak ditemukan: ${i.nama}`);
          return { produkId: p.id, nama: p.nama, hargaSatuan: p.hargaJual, kuantitas: i.kuantitas, diskonPerUnit: 0 };
        }),
        diskonTotal: 0,
        ongkir: { mode: "ambil_sendiri", nominal: 0 },
        jenisBayar: jual.jenisBayar,
        statusBayar: jual.statusBayar,
        dibayarSekarang: jual.dibayarSekarang,
        bazarId: bazar.id,
      },
      { rekening: SETTINGS_DEMO.rekening, waktu: new Date(jual.waktu) },
    );
    if (!hasil.ok) throw new Error(`Seed penjualan gagal: ${hasil.pesan}`);
  }

  for (const po of PO_DEMO) {
    const hasil = await simpanPO(
      {
        items: po.items.map((i) => {
          const p = produkDariNama.get(i.nama);
          if (!p) throw new Error(`Produk demo tidak ditemukan: ${i.nama}`);
          return { produkId: p.id, nama: p.nama, hargaSatuan: p.hargaJual, kuantitas: i.kuantitas, diskonPerUnit: 0 };
        }),
        diskonTotal: 0,
        ongkir: { mode: "ambil_sendiri", nominal: 0 },
        namaPemesan: po.namaPemesan,
        kontak: null,
        perkiraanSiap: po.perkiraanSiap,
        alamat: null,
        catatan: "DATA CONTOH DEMO",
        dibayarSekarang: po.dibayarSekarang,
        jenisBayar: po.jenisBayar,
        bazarId: bazar.id,
      },
      { rekening: SETTINGS_DEMO.rekening, waktu: new Date("2026-11-17T08:00:00+07:00") },
    );
    if (!hasil.ok) throw new Error(`Seed PO gagal: ${hasil.pesan}`);
    if (po.jadiSiap) {
      const ubah = await ubahStatusPesanan(hasil.pesanan.id, "siap");
      if (!ubah.ok) throw new Error(`Seed ubah status PO gagal: ${ubah.pesan}`);
    }
  }

  return true;
}
