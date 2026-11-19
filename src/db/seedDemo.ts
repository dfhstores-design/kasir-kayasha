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
 * bazar, stok berkurang) -> 2 pesanan jahit (1 Belum Lunas dengan DP,
 * 1 Lunas; tidak mengurangi stok).
 * Logo DI-seed dari public/logo-kayesa.png (file logo_butik_tante_sita.png
 * dari Andri, 18 Nov 2026, 2300x2332 PNG, 1,4 MB, monogram KC silver,
 * cincin teks "KAYESA'S CLOTHING" sudah benar): Andri memutuskan secara
 * eksplisit pada 17 Nov 2026 bahwa saat link dibuka logo sudah ada, mengesampingkan
 * keputusan lama di CATATAN-DISKUSI.md §3.2 (logo diunggah Tante sendiri,
 * bukan disimpan di repo). Logo tetap bisa diganti/dihapus Tante lewat
 * Pengaturan -> Logo resi setelahnya. PIN TIDAK di-seed (pinHash null).
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
import { simpanPesananJahit, type RencanaJahitan } from "../lib/jahitan.ts";
import { terimaPembayaranKasir } from "./kasirOperasi.ts";
import type { StatusBayar } from "../lib/keranjang.ts";

export const SETTINGS_DEMO: SettingsRecord = {
  id: "utama",
  namaButik: "KAYESA",
  alamatBaris1: "Jl. Tarumanegara No. 41",
  alamatBaris2: "Pisangan, Ciputat Timur - 15419",
  kotaKodePos: "",
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
  skalaFont: 1,
  tema: "terang",
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

interface JahitanDemo {
  rencana: RencanaJahitan;
  /** Uang yang sudah dibayar saat seed (0 = belum ada pembayaran). */
  dibayarSekarang: number;
  /** Metode pembayaran awal ("tunai" / "transfer" / "qris"). */
  jenisBayar: string;
}

/**
 * 2 contoh pesanan jahit (BU-24: "Pesanan" = barang custom = pesanan jahit;
 * PO barang stok tidak lagi di-seed). Pesanan jahit bazarId null — tidak
 * mengurangi stok dan tidak terikat bazar demo.
 */
const JAHITAN_DEMO: JahitanDemo[] = [
  {
    rencana: {
      namaPemesan: "CONTOH – Sari",
      kontak: null,
      // Multi-item (BU-55): jasa 850.000 dipecah jadi 2 baris + Payet 125.000;
      // total 975.000 & terbayar 300.000 sama seperti sebelumnya.
      items: [
        { nama: "Kebaya brokat", harga: 600000, kuantitas: 1 },
        { nama: "Kain brokat", harga: 250000, kuantitas: 1 },
      ],
      ukuran: null,
      perkiraanSelesai: "2026-11-19",
      catatan: "DATA CONTOH DEMO",
      biayaLain: [{ nama: "Payet", nominal: 125000 }],
    },
    dibayarSekarang: 300000,
    jenisBayar: "tunai",
  },
  {
    rencana: {
      namaPemesan: "CONTOH – Dewi",
      kontak: null,
      items: [{ nama: "Gaun Pesta", harga: 350000, kuantitas: 1 }],
      ukuran: null,
      perkiraanSelesai: "2026-11-18",
      catatan: "DATA CONTOH DEMO",
      biayaLain: [],
    },
    dibayarSekarang: 350000,
    jenisBayar: "transfer",
  },
];

/** URL logo default yang ikut ter-copy ke dist/ saat build (public/). */
export const LOGO_DEMO_URL = "/logo-kayesa.png";

/**
 * Mengambil logo default sebagai Blob. Mengembalikan null bila file tidak
 * bisa diambil (mis. build tanpa logo) — seed tetap jalan tanpa logo,
 * supaya satu file yang hilang tidak menggagalkan seluruh demo.
 */
export async function ambilLogoDemo(): Promise<Blob | null> {
  try {
    const res = await fetch(LOGO_DEMO_URL);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (blob.size === 0 || !blob.type.startsWith("image/")) return null;
    return blob;
  } catch {
    return null;
  }
}

/**
 * Migrasi alamat lama (BU-51, 19 Nov 2026): perangkat yang sudah berisi data
 * sebelum trial masih menyimpan alamat lama di Pengaturan, dan seed tidak
 * jalan lagi di perangkat berisi data. Bila nilainya masih persis nilai lama,
 * ganti ke alamat baru — sekali jalan, idempotent, tidak menyentuh isian lain.
 */
export async function migrasiAlamatLama(): Promise<boolean> {
  try {
    const s = await ambilSettings();
    const lamaBaris2 = s.alamatBaris2.trim() === "Sebelah Pempak Nyai";
    const lamaKota = s.kotaKodePos.trim() === "Ploso Ciptum 15419";
    if (!lamaBaris2 && !lamaKota) return false;
    await simpanSettings({
      ...s,
      alamatBaris2: lamaBaris2 ? "Pisangan, Ciputat Timur - 15419" : s.alamatBaris2,
      kotaKodePos: lamaKota ? "" : s.kotaKodePos,
      updatedAt: new Date().toISOString(),
    });
    return true;
  } catch {
    return false;
  }
}

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
 * 2 pesanan jahit. Mengembalikan true bila seed dijalankan, false bila database
 * sudah berisi data (tidak ada yang diubah).
 */
export async function jalankanSeedDemo(): Promise<boolean> {
  if (!(await databaseMasihKosong())) return false;

  const sekarang = new Date().toISOString();
  const logo = await ambilLogoDemo();
  await simpanSettings({ ...SETTINGS_DEMO, logo, updatedAt: sekarang });

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

  for (const jahit of JAHITAN_DEMO) {
    const hasil = await simpanPesananJahit(jahit.rencana, {
      rekening: SETTINGS_DEMO.rekening,
      waktu: new Date("2026-11-17T08:00:00+07:00"),
    });
    if (!hasil.ok) throw new Error(`Seed pesanan jahit gagal: ${hasil.pesan}`);
    if (jahit.dibayarSekarang > 0) {
      const bayar = await terimaPembayaranKasir(hasil.pesanan.id, jahit.dibayarSekarang, jahit.jenisBayar);
      if (!bayar.ok) throw new Error(`Seed pembayaran jahit gagal: ${bayar.pesan}`);
    }
  }

  return true;
}
