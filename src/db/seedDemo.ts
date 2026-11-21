/**
 * Seed awal KAYESA — HANYA detail usaha (settings) untuk serah terima.
 *
 * Sejak 19 Nov 2026 (keputusan Andri saat serah terima: "tinggal detail
 * usaha aja") seed TIDAK LAGI membuat data contoh: tidak ada produk,
 * tidak ada bazar, tidak ada penjualan, tidak ada pesanan jahit. Perangkat
 * baru yang membuka link langsung berisi detail usaha (nama, alamat,
 * telepon, teks penutup, logo, kedua rekening) dan daftar kosong — Tante
 * mengisi produk dan pesanan asli sendiri.
 *
 * HANYA jalan bila database masih kosong: settings belum terisi DAN tidak ada
 * produk DAN tidak ada transaksi DAN tidak ada bazar aktif. Bila salah satu
 * sudah ada, seed diam-diam tidak melakukan apa pun, supaya data asli Tante
 * tidak pernah tertimpa atau tercampur.
 *
 * Logo DI-seed dari public/logo-kayesa.png (file logo_butik_tante_sita.png
 * dari Andri, 18 Nov 2026, 2300x2332 PNG, 1,4 MB, monogram KC silver,
 * cincin teks "KAYESA'S CLOTHING" sudah benar): Andri memutuskan secara
 * eksplisit pada 17 Nov 2026 bahwa saat link dibuka logo sudah ada, mengesampingkan
 * keputusan lama di CATATAN-DISKUSI.md §3.2 (logo diunggah Tante sendiri,
 * bukan disimpan di repo). Logo tetap bisa diganti/dihapus Tante lewat
 * Pengaturan -> Logo resi setelahnya. PIN TIDAK di-seed (pinHash,
 * pinOwnerHash, dan pinKasirTokoHash null — Fase 2A, BU-32/34).
 */
import {
  ambilSettings,
  bazarAktif,
  daftarProduk,
  daftarTransaksi,
  simpanSettings,
  type SettingsRecord,
} from "./repositori.ts";

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
    {
      id: "rekening-demo-mandiri",
      namaBank: "Mandiri",
      nomor: "1010001037785",
      namaPemilik: "NARSHITA DEWI",
      utama: false,
    },
  ],
  tampilkanSapaan: true,
  tampilkanNomorResi: true,
  tampilkanRincianDiskon: true,
  tampilkanPembayaranSisa: true,
  skalaFont: 1,
  tema: "terang",
  pinHash: null,
  pinOwnerHash: null,
  pinKasirTokoHash: null,
  updatedAt: new Date().toISOString(),
};

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

/**
 * Migrasi rekening kedua (BU-53, 19 Nov 2026): perangkat yang sudah berisi
 * data sebelum rekening Mandiri diputuskan hanya menyimpan BCA, dan seed
 * tidak jalan lagi di perangkat berisi data. Bila rekening BCA demo ada tapi
 * Mandiri 1010001037785 belum ada, tambahkan — sekali jalan, idempotent,
 * tidak menyentuh isian lain.
 */
export async function migrasiRekeningKedua(): Promise<boolean> {
  try {
    const s = await ambilSettings();
    const punyaBca = s.rekening.some((r) => r.nomor.replace(/\s/g, "") === "676017885");
    const punyaMandiri = s.rekening.some((r) => r.nomor.replace(/\s/g, "") === "1010001037785");
    if (!punyaBca || punyaMandiri) return false;
    await simpanSettings({
      ...s,
      rekening: [
        ...s.rekening,
        {
          id: "rekening-demo-mandiri",
          namaBank: "Mandiri",
          nomor: "1010001037785",
          namaPemilik: "NARSHITA DEWI",
          utama: false,
        },
      ],
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
 * Mengisi settings usaha saja (nama, alamat, telepon, teks penutup, logo,
 * kedua rekening) bila database masih kosong. TIDAK membuat data contoh
 * apa pun — produk, bazar, penjualan, dan pesanan jahit semuanya kosong
 * (keputusan serah terima 19 Nov 2026, Andri: "tinggal detail usaha aja").
 * Mengembalikan true bila seed dijalankan, false bila database sudah berisi
 * data (tidak ada yang diubah).
 */
export async function jalankanSeedDemo(): Promise<boolean> {
  if (!(await databaseMasihKosong())) return false;

  const sekarang = new Date().toISOString();
  const logo = await ambilLogoDemo();
  // Baca ulang settings TEPAT sebelum menulis (C2, tes klik 22 Nov 2026):
  // di antara pengecekan database kosong dan penulisan ini ada fetch logo
  // (async) — PIN yang disimpan di jendela itu sebelumnya TERTIMPA oleh
  // penulisan seluruh record demo (pinHash null), sehingga "PIN tersimpan"
  // tampil tapi setelah reload jadi "PIN belum diatur". Sekarang hanya
  // field usaha demo yang diisi, dan hanya bila masih kosong; PIN,
  // pinDiubahPada, perangkatId, dan jejak sync selalu dipertahankan.
  const saatIni = await ambilSettings();
  await simpanSettings({
    ...saatIni,
    id: "utama",
    namaButik: saatIni.namaButik || SETTINGS_DEMO.namaButik,
    alamatBaris1: saatIni.alamatBaris1 || SETTINGS_DEMO.alamatBaris1,
    alamatBaris2: saatIni.alamatBaris2 || SETTINGS_DEMO.alamatBaris2,
    kotaKodePos: saatIni.kotaKodePos || SETTINGS_DEMO.kotaKodePos,
    telepon1: saatIni.telepon1 || SETTINGS_DEMO.telepon1,
    telepon2: saatIni.telepon2 || SETTINGS_DEMO.telepon2,
    teksPenutup: saatIni.teksPenutup || SETTINGS_DEMO.teksPenutup,
    logo: saatIni.logo ?? logo,
    rekening: saatIni.rekening.length > 0 ? saatIni.rekening : SETTINGS_DEMO.rekening,
    updatedAt: sekarang,
  });

  return true;
}
