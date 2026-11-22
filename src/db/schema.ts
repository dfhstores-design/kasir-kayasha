/**
 * Skema IndexedDB Kasir Kayesa.
 *
 * Aturan dari CONTEXT: jangan pakai localStorage untuk data transaksi utama.
 * Semua data bisnis ada di IndexedDB, ditulis SEBELUM menunggu server.
 *
 * Store:
 *   settings        profil usaha, logo, rekening, sapaan (1 record kunci "utama")
 *   products        barang + stok gudang (stok bazar disimpan terpisah)
 *   product_photos  foto terkompresi, urutan 1–3 per barang
 *   bazars          bazar; aktif boleh lebih dari satu (18 Nov 2026), penjualan memakai yang terakhir dibuka
 *   bazar_items     saldo bazar per barang (dibawa/terjual/ditarik)
 *   transactions    transaksi + snapshot total
 *   transaction_items  baris transaksi (snapshot nama/harga/diskon)
 *   payments        pembayaran (DP/pelunasan)
 *   parked_carts    keranjang tertahan (maks 3, bernama)
 *   outbox          antrean sinkronisasi idempoten (dipakai Phase 6)
 */
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { OngkirMode } from "../lib/ongkir.ts";
import type { Sapaan } from "../lib/sapaan.ts";
import type { StatusBayar } from "../lib/keranjang.ts";

/**
 * Nama database IndexedDB.
 *
 * SENGAJA tetap "kasir-kayasha" (ejaan lama) walaupun nama aplikasi sudah menjadi
 * "Kasir Kayesa". Mengganti nama ini akan membuat aplikasi membuka database KOSONG
 * dan data pemilik seolah hilang. Nama internal bukan nama yang dilihat pengguna.
 * Bila suatu saat harus diganti, WAJIB disertai migrasi yang menyalin seluruh isi
 * database lama (lihat `salinDatabaseLama` di komentar bawah).
 */
export const DB_NAME = "kasir-kayasha";
/** Nama database yang dipakai versi lama; hanya untuk keperluan migrasi. */
export const DB_NAME_LAMA = "kasir-kayesha";
/**
 * Versi 5 (Fase 2B, Tahap 2, BU-33): sync banyak arah. Store baru `logSinkron`
 * (catatan konflik/pengaman diam-diam, hanya untuk owner) dan `bayangan`
 * (snapshot terakhir yang diketahui hub, untuk gabung 3-arah data master).
 * Tidak ada baris lama yang diubah atau dihapus.
 */
export const DB_VERSION = 6;

export type UUID = string;

/**
 * Jenis dokumen transaksi — SATU SUMBER kebenaran (BU-01, A-1).
 *
 * Daftar tertutup + versi: menambah anggota di sini cukup satu tempat;
 * validasi sinkronisasi memakai union yang sama (hindari enum jadi dua — risiko B-2).
 * Anggota awal: "penjualan" (barang siap jual), "jasa" (pesanan jahit,
 * tak mengurangi stok), dan "pesanan" (DEPRECATED 18 Nov 2026: pre-order
 * barang; fitur PO barang dihapus total, tapi anggota enum dipertahankan
 * demi kompatibilitas data/riwayat lama — jangan dipakai untuk dokumen baru).
 */
export const JENIS_DOKUMEN = ["penjualan", "pesanan", "jasa"] as const;
export type JenisDokumen = (typeof JENIS_DOKUMEN)[number];

/**
 * Arah pergerakan stok sebuah dokumen (BU-01).
 * "keluar" = barang keluar (jual/PO), "masuk" = barang masuk (produksi/transfer),
 * "tidak_ada" = tidak menyentuh stok (jasa).
 */
export const ARAH_STOK = ["keluar", "masuk", "tidak_ada"] as const;
export type ArahStok = (typeof ARAH_STOK)[number];

export interface Rekening {
  id: UUID;
  namaBank: string;
  nomor: string;
  namaPemilik: string;
  /** Hanya satu yang utama; dicetak paling atas di resi (BU-53: semua dicetak). */
  utama: boolean;
}

/**
 * Tema tampilan aplikasi (BU-32). Hanya memengaruhi UI aplikasi —
 * ukuran font & warna resi/PDF (src/lib/dokumen.ts) TETAP tidak berubah (BU-25).
 */
export type Tema = "terang" | "gelap" | "krem";


export interface SettingsRecord {
  id: "utama";
  namaButik: string;
  alamatBaris1: string;
  alamatBaris2: string;
  kotaKodePos: string;
  telepon1: string;
  telepon2: string;
  teksPenutup: string;
  /** Blob logo asli; versi hitam-putih dibuat saat cetak. */
  logo: Blob | null;
  rekening: Rekening[];
  tampilkanSapaan: boolean;
  tampilkanNomorResi: boolean;
  tampilkanRincianDiskon: boolean;
  tampilkanPembayaranSisa: boolean;
  /** Skala huruf UI (BU-32): 0.9 | 1 | 1.15 | 1.3. Dokumen/nota TETAP fix (BU-25). */
  skalaFont: number;
  /** Tema warna UI (BU-32). Hanya untuk UI, bukan dokumen. */
  tema: Tema;
  /** PIN 4 angka untuk menu Pengaturan & Barang; null = tidak terkunci. */
  pinHash: string | null;
  /**
   * PIN owner (Fase 2A, BU-32): TERPISAH dari PIN admin, tidak boleh sama.
   * Owner saat ini Tante (nanti Andri). null = belum diatur.
   */
  pinOwnerHash: string | null;
  /**
   * PIN kasir toko/butik (Fase 2A, BU-34): wajib beda dengan PIN kasir
   * tiap bazar, PIN admin, dan PIN owner. null = belum diatur.
   */
  pinKasirTokoHash: string | null;
  /**
   * Kapan tiap PIN terakhir diatur/dihapus (F3, BU-32/33): dipakai sync
   * untuk memutuskan "yang terbaru menang" antar perangkat. Diisi saat
   * PIN disimpan/dihapus lewat simpanPin; perangkat lama tidak punya
   * kolom ini (dianggap belum pernah diatur).
   */
  pinDiubahPada?: { admin?: string; owner?: string; kasir_toko?: string };
  /**
   * Id perangkat ini (Fase 2B, BU-33): dibuat sekali (UUID), dipakai hub
   * untuk tidak mengembalikan baris ke perangkat pengirimnya sendiri.
   * Bukan data pribadi — hanya penanda perangkat.
   */
  perangkatId?: string;
  /**
   * Kursor tarik terakhir (Fase 2B, BU-33): waktu `diubah_pada` terbaru
   * yang sudah ditarik dari hub. null/undefined = belum pernah tarik.
   */
  syncTarikTerakhir?: string | null;
  updatedAt: string;
}

export interface ProdukRecord {
  id: UUID;
  nama: string;
  kode: string | null;
  hargaJual: number;
  /** Stok gudang. Stok bazar ada di bazar_items. */
  stokGudang: number;
  catatan: string | null;
  arsip: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FotoRecord {
  id: UUID;
  produkId: UUID;
  urutan: 1 | 2 | 3;
  blob: Blob;
  tipe: string;
  ukuran: number;
}

export interface BazarRecord {
  id: UUID;
  nama: string;
  mulai: string | null;
  selesai: string | null;
  /** Lokasi/tempat bazar (opsional). */
  lokasi: string | null;
  /** Catatan bebas (opsional). */
  catatan: string | null;
  /** "aktif" atau "selesai". Bazar aktif boleh lebih dari satu (18 Nov 2026);
   *  penjualan memakai yang terakhir dibuka. */
  status: "aktif" | "selesai";
  /**
   * PIN kasir bazar ini (Fase 2A, BU-34): satu bazar satu PIN, wajib beda
   * dengan PIN kasir toko, PIN admin, dan PIN owner. null = belum diatur
   * (kasir bisa masuk sekali tanpa PIN, seperti bootstrap PIN admin).
   */
  pinKasirHash: string | null;
  ringkasanTerjual: number | null;
  ringkasanDibawa: number | null;
  ringkasanSisa: number | null;
  ditutupPada: string | null;
  createdAt: string;
  /**
   * Terakhir diubah (Fase 2B, BU-33): dipakai sebagai `diubah_pada` saat
   * bazar dikirim ke hub. Bazar lama (sebelum Fase 2B) tidak punya kolom
   * ini — dibaca sebagai createdAt.
   */
  updatedAt?: string;
}

/** Kategori biaya bazar (daftar tetap, sesuai keputusan pemilik). */
export type KategoriBiaya =
  | "sewa_booth"
  | "transport"
  | "konsumsi"
  | "perlengkapan"
  | "lainnya";

export const KATEGORI_BIAYA: readonly KategoriBiaya[] = [
  "sewa_booth",
  "transport",
  "konsumsi",
  "perlengkapan",
  "lainnya",
] as const;

/** Satu pengeluaran untuk sebuah bazar. Tidak memengaruhi total transaksi pelanggan. */
export interface BiayaBazarRecord {
  id: UUID;
  bazarId: UUID;
  kategori: KategoriBiaya;
  judul: string;
  /** Integer Rupiah, selalu > 0. */
  nominal: number;
  /** Tanggal lokal "YYYY-MM-DD". */
  tanggal: string;
  catatan: string | null;
  createdAt: string;
}

export interface BazarItemRecord {
  id: UUID;
  bazarId: UUID;
  produkId: UUID;
  dibawa: number;
  terjual: number;
  ditarik: number;
  /** Selisih hasil hitung fisik saat penutupan (fisik − sisa tercatat). */
  selisih: number | null;
  updatedAt: string;
}

export interface TransaksiRecord {
  id: UUID;
  nomorResi: string;
  nomorUrutHari: number;
  /** Nomor urut pesanan jahit dalam bulan yang sama (BU-19/21, 19 Nov 2026);
   *  hanya diisi untuk jenisDokumen "jasa". */
  nomorUrutBulan?: number;
  /**
   * True bila nomor urut di atas dihitung LOKAL karena perangkat sedang
   * offline / hub tidak bisa dihubungi (F4, BU-19/21): nomor sementara
   * yang bisa dobel dengan perangkat lain. Saat online lagi, sync
   * meminta nomor resmi dari hub dan menulis ulang nomor ini + nomorResi.
   * Pesanan yang dibuat saat online tidak punya kolom ini.
   */
  nomorUrutSementara?: boolean;
  waktu: string;
  /** LAMA (deprecated): "langsung" (barang siap jual) atau "po" (pre-order).
   *  Dipertahankan agar data lama tidak rusak (risiko B-1); jangan dibaca untuk
   *  logika baru — pakai `jenisDokumen` di bawah. Catatan 18 Nov 2026: nilai
   *  "po" juga dipakai pesanan JAHIT baru sebagai penanda pesanan (bukan PO
   *  barang) — lihat `lib/jahitan.ts` dan `lib/resi.ts`; jangan dihapus. */
  jenis: "langsung" | "po";
  /** Jenis dokumen (satu sumber kebenaran) — lihat {@link JENIS_DOKUMEN}. */
  jenisDokumen: JenisDokumen;
  /** Arah pergerakan stok dokumen ini (BU-01) — lihat {@link ARAH_STOK}. */
  arahStok: ArahStok;
  /** Pelanggan terkait, ditanam dini untuk CRM (BU-28). null = belum ditautkan. */
  pelangganId: UUID | null;
  statusPesanan: "diproses" | "siap" | "selesai" | "dibatalkan";
  bazarId: UUID | null;
  namaPemesan: string | null;
  kontak: string | null;
  /** Untuk PO: perkiraan tanggal siap (opsional). */
  perkiraanSiap: string | null;
  /** Untuk PO yang dikirim. */
  alamat: string | null;
  catatanPesanan: string | null;
  /** Riwayat perubahan total (mis. ongkir menyusul). */
  riwayatTotal: Array<{ waktu: string; totalLama: number; totalBaru: number; alasan: string }>;
  ongkirMode: OngkirMode;
  ongkirNominal: number | null;
  subtotalAwal: number;
  diskonItem: number;
  diskonTotal: number;
  total: number;
  sapaan: Sapaan;
  /** Snapshot rekening & nama bank yang dipakai saat transaksi. */
  rekeningSnapshot: Rekening[];
  jenisBayar: "tunai" | "transfer" | "qris" | null;
  statusBayar: StatusBayar;
  dibatalkanPada: string | null;
  /**
   * Terakhir kali transaksi ini berhasil dikirim/ditarik lewat hub
   * (Fase 2B, BU-33): tanggal SYNC, bukan tanggal transaksi. Laporan
   * tetap memakai `waktu` (tanggal transaksi), bukan kolom ini.
   */
  terakhirSyncPada?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ItemTransaksiRecord {
  id: UUID;
  transaksiId: UUID;
  produkId: UUID | null;
  namaSnapshot: string;
  hargaSatuan: number;
  kuantitas: number;
  diskonPerUnit: number;
  subtotalBersih: number;
  /** Ukuran/catatan khusus per baris item pesanan jahit (BU-56); null bila kosong.
   *  Opsional: baris lama (sebelum BU-56) tidak punya kolom ini. */
  ukuran?: string | null;
  /** Urutan baris seperti diinput (BU-56): id baris acak, jadi tanpa ini urutan
   *  item bisa berubah-ubah tiap dibaca. Opsional: baris lama tidak punya. */
  urutan?: number;
}

export interface PembayaranRecord {
  id: UUID;
  transaksiId: UUID;
  nominal: number;
  waktu: string;
  metode: string | null;
  catatan: string | null;
}

export interface KeranjangTertahanRecord {
  id: UUID;
  /** Wajib — supaya kasir yakin mana yang dilanjutkan. */
  namaPembeli: string;
  isi: Array<{
    produkId: UUID;
    nama: string;
    hargaSatuan: number;
    kuantitas: number;
    diskonPerUnit: number;
  }>;
  diskonTotal: number;
  ongkirMode: OngkirMode;
  ongkirNominal: number | null;
  jenisBayar: "tunai" | "transfer" | "qris" | null;
  /** Bazar tempat keranjang dibuat; null = penjualan dari gudang. */
  bazarId: UUID | null;
  dibuatPada: string;
}

/** Satu baris jurnal satu-arah, turunan dari dokumen (BU-02, A-2). */
export interface JournalRecord {
  id: UUID;
  /** "masuk" (uang diterima) atau "keluar" (uang keluar). */
  arah: "masuk" | "keluar";
  /** Kategori deklaratif + opsi isi sendiri (BU-06); string bebas namun tersimpan. */
  kategori: string;
  /** Integer Rupiah, selalu > 0. */
  nominal: number;
  /** Waktu ISO. */
  waktu: string;
  /** Dokumen asal; null untuk jurnal manual. */
  dokumenId: UUID | null;
  /** Untuk keperluan siapa (BU-07). */
  pemilik: "usaha" | "pribadi";
  /** Dari dompet mana uang bergerak (BU-07). */
  sumber: "usaha" | "pribadi";
  catatan: string | null;
}

/** Entitas pelanggan tipis, dibuat otomatis saat pesanan dibuat (BU-28). */
export interface PelangganRecord {
  id: UUID;
  nama: string;
  /** Kontak (mis. nomor WhatsApp); boleh kosong. */
  kontak: string | null;
}

/** Log pengiriman dokumen (BU-27/BU-28): dokumen apa dikirim ke siapa, kapan. */
export interface PengirimanRecord {
  id: UUID;
  dokumenId: UUID;
  pelangganId: UUID;
  /** Waktu ISO saat dikirim. */
  waktu: string;
  /** "invoice" (masih ada tagihan) atau "resi" (sudah lunas). */
  jenis: "invoice" | "resi";
  /** Tujuan pengiriman (mis. kanal WhatsApp / galeri). */
  tujuan: string;
}

export interface OutboxRecord {
  id: UUID;
  jenisRecord: "produk" | "transaksi" | "pembayaran" | "settings" | "bazar" | "biaya_bazar" | "pin";
  idRecord: string;
  /**
   * "upsert" = kirim isi record terbaru; "hapus" = kirim tombstone agar
   * perangkat lain ikut menghapus record itu (F1, biaya bazar). Tombstone
   * perlu aksi sendiri: begitu baris lokal dihapus, isinya sudah tidak
   * bisa dibaca lagi saat kirim.
   */
  aksi: "upsert" | "hapus";
  percobaan: number;
  terakhirDicoba: string | null;
  dibuatPada: string;
}

/**
 * Satu catatan sinkronisasi (Fase 2B, BU-33): pengaman diam-diam dan jejak
 * tarik/kirim yang hanya dibaca owner. Bukan antrean — tidak memblokir apa pun.
 */
export interface LogSinkronRecord {
  id: UUID;
  /** Waktu ISO saat catatan dibuat. */
  waktu: string;
  /** "konflik" = bentrok yang diputus otomatis / tidak bisa diputus;
   *  "info" = jejak tarik (mis. transaksi baru masuk dari perangkat lain). */
  jenis: "konflik" | "info";
  /** Judul pendek berbahasa Indonesia, mis. "Harga Kebaya diubah di dua tempat". */
  judul: string;
  /** Rincian untuk owner, mis. "Dipakai yang terbaru (10 Nov 2026 09:00)". */
  rincian: string;
  /** Id perangkat asal perubahan (bila diketahui). */
  perangkat: string | null;
}

/**
 * Bayangan sync (Fase 2B, BU-33): snapshot terakhir sebuah record master
 * (produk/bazar) seperti yang diketahui hub. Dipakai gabung 3-arah:
 * kolom yang hanya berubah di satu sisi diambil dari sisi itu; kolom yang
 * berubah di dua sisi diputus dengan yang terbaru + dicatat di logSinkron.
 */
export interface BayanganRecord {
  /** "<jenis>:<id>", mis. "produk:abc-123". */
  id: string;
  jenis: "produk" | "bazar";
  idRecord: UUID;
  /** Snapshot record seperti terakhir diketahui hub (JSON). */
  data: Record<string, unknown>;
  /** `diubah_pada` snapshot itu. */
  diubahPada: string;
}

/**
 * Catatan penutupan harian kasir (c, tes klik 22 Nov 2026).
 *
 * Tutup Harian sebelumnya hanya ringkasan baca saja — tidak ada tombol
 * tutup/konfirmasi dan tidak ada jejak bahwa hari itu sudah ditutup.
 * Satu record per lokasi per hari (tanggal WIB + bazarId): tanggal,
 * kasir/peran, ringkasan hari itu, dan waktu penutupan. Dicatat lokal di
 * perangkat kasir (belum disinkronkan ke hub — Tahap 2 tidak punya jenis
 * record sync untuk ini); jejak yang sama juga ditulis ke logSinkron
 * (jenis "info", dibaca owner) supaya penutupan terlihat di layar
 * Riwayat Sinkron.
 */
export interface TutupHarianRecord {
  id: UUID;
  /** Tanggal yang ditutup, "YYYY-MM-DD" dalam WIB. */
  tanggal: string;
  /** null = toko/gudang, selain itu id bazar. */
  bazarId: UUID | null;
  /** Label lokasi saat ditutup, mis. "Toko" atau "Bazar Plaza Senayan". */
  label: string;
  /** Peran yang menutup: kasir biasa, atau admin yang membuka layar ini. */
  peran: "kasir" | "admin" | "owner";
  jumlahTransaksi: number;
  uangMasuk: number;
  tunai: number;
  transfer: number;
  qris: number;
  pengembalian: number;
  pengembalianDp: number;
  pengembalianBatal: number;
  /** Waktu ISO saat tombol tutup ditekan. */
  ditutupPada: string;
}

export interface KasirDB extends DBSchema {
  settings: { key: "utama"; value: SettingsRecord };
  products: {
    key: UUID;
    value: ProdukRecord;
    indexes: { "by-arsip": number; "by-nama": string };
  };
  product_photos: {
    key: UUID;
    value: FotoRecord;
    indexes: { "by-produk": UUID };
  };
  bazars: {
    key: UUID;
    value: BazarRecord;
    indexes: { "by-status": string };
  };
  bazar_items: {
    key: UUID;
    value: BazarItemRecord;
    indexes: { "by-bazar": UUID; "by-produk": UUID };
  };
  bazar_biaya: {
    key: UUID;
    value: BiayaBazarRecord;
    indexes: { "by-bazar": UUID; "by-tanggal": string };
  };
  transactions: {
    key: UUID;
    value: TransaksiRecord;
    indexes: { "by-waktu": string; "by-bazar": UUID; "by-nomor": string };
  };
  transaction_items: {
    key: UUID;
    value: ItemTransaksiRecord;
    indexes: { "by-transaksi": UUID };
  };
  payments: {
    key: UUID;
    value: PembayaranRecord;
    indexes: { "by-transaksi": UUID };
  };
  parked_carts: {
    key: UUID;
    value: KeranjangTertahanRecord;
    indexes: { "by-dibuat": string };
  };
  outbox: {
    key: UUID;
    value: OutboxRecord;
    indexes: { "by-record": string };
  };
  journal: {
    key: UUID;
    value: JournalRecord;
    indexes: { "by-waktu": string; "by-dokumen": UUID };
  };
  pelanggan: {
    key: UUID;
    value: PelangganRecord;
    indexes: { "by-nama": string };
  };
  pengiriman: {
    key: UUID;
    value: PengirimanRecord;
    indexes: { "by-dokumen": UUID; "by-pelanggan": UUID };
  };
  logSinkron: {
    key: UUID;
    value: LogSinkronRecord;
    indexes: { "by-waktu": string };
  };
  bayangan: {
    key: string;
    value: BayanganRecord;
    indexes: { "by-jenis": string };
  };
  tutupHarian: {
    key: UUID;
    value: TutupHarianRecord;
    indexes: { "by-tanggal": string };
  };
}


let dbPromise: Promise<IDBPDatabase<KasirDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<KasirDB>> {
  if (!dbPromise) {
    dbPromise = openDB<KasirDB>(DB_NAME, DB_VERSION, {
      async upgrade(db, oldVersion, _newVersion, tx) {
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "id" });
        }

        if (!db.objectStoreNames.contains("products")) {
          const s = db.createObjectStore("products", { keyPath: "id" });
          s.createIndex("by-arsip", "arsip");
          s.createIndex("by-nama", "nama");
        }

        if (!db.objectStoreNames.contains("product_photos")) {
          const s = db.createObjectStore("product_photos", { keyPath: "id" });
          s.createIndex("by-produk", "produkId");
        }

        if (!db.objectStoreNames.contains("bazars")) {
          const s = db.createObjectStore("bazars", { keyPath: "id" });
          s.createIndex("by-status", "status");
        }

        if (!db.objectStoreNames.contains("bazar_items")) {
          const s = db.createObjectStore("bazar_items", { keyPath: "id" });
          s.createIndex("by-bazar", "bazarId");
          s.createIndex("by-produk", "produkId");
        }

        if (!db.objectStoreNames.contains("bazar_biaya")) {
          const s = db.createObjectStore("bazar_biaya", { keyPath: "id" });
          s.createIndex("by-bazar", "bazarId");
          s.createIndex("by-tanggal", "tanggal");
        }

        if (!db.objectStoreNames.contains("transactions")) {
          const s = db.createObjectStore("transactions", { keyPath: "id" });
          s.createIndex("by-waktu", "waktu");
          s.createIndex("by-bazar", "bazarId");
          s.createIndex("by-nomor", "nomorResi");
        }

        if (!db.objectStoreNames.contains("transaction_items")) {
          const s = db.createObjectStore("transaction_items", { keyPath: "id" });
          s.createIndex("by-transaksi", "transaksiId");
        }

        if (!db.objectStoreNames.contains("payments")) {
          const s = db.createObjectStore("payments", { keyPath: "id" });
          s.createIndex("by-transaksi", "transaksiId");
        }

        if (!db.objectStoreNames.contains("parked_carts")) {
          const s = db.createObjectStore("parked_carts", { keyPath: "id" });
          s.createIndex("by-dibuat", "dibuatPada");
        }

        if (!db.objectStoreNames.contains("outbox")) {
          const s = db.createObjectStore("outbox", { keyPath: "id" });
          s.createIndex("by-record", "idRecord");
        }

        if (!db.objectStoreNames.contains("journal")) {
          const s = db.createObjectStore("journal", { keyPath: "id" });
          s.createIndex("by-waktu", "waktu");
          s.createIndex("by-dokumen", "dokumenId");
        }

        if (!db.objectStoreNames.contains("pelanggan")) {
          const s = db.createObjectStore("pelanggan", { keyPath: "id" });
          s.createIndex("by-nama", "nama");
        }

        if (!db.objectStoreNames.contains("pengiriman")) {
          const s = db.createObjectStore("pengiriman", { keyPath: "id" });
          s.createIndex("by-dokumen", "dokumenId");
          s.createIndex("by-pelanggan", "pelangganId");
        }

        // Store baru Fase 2B (v5): log sinkronisasi + bayangan gabung 3-arah.
        // Hanya dibuat bila belum ada; tidak ada data lama yang disentuh.
        if (!db.objectStoreNames.contains("logSinkron")) {
          const s = db.createObjectStore("logSinkron", { keyPath: "id" });
          s.createIndex("by-waktu", "waktu");
        }

        if (!db.objectStoreNames.contains("bayangan")) {
          const s = db.createObjectStore("bayangan", { keyPath: "id" });
          s.createIndex("by-jenis", "jenis");
        }

        // Store baru (c, tes klik 22 Nov 2026; v6): catatan penutupan
        // harian kasir. Hanya dibuat bila belum ada; tidak ada data lama
        // yang disentuh.
        if (!db.objectStoreNames.contains("tutupHarian")) {
          const s = db.createObjectStore("tutupHarian", { keyPath: "id" });
          s.createIndex("by-tanggal", "tanggal");
        }

        // Migrasi ringan v2 -> v3: isi kolom baru di transactions tanpa merusak data lama.
        // Data lama tidak punya jenisDokumen/arahStok/pelangganId; kita isi dari field `jenis`
        // yang masih dipertahankan. Tidak ada baris yang dihapus atau ditulis ulang utuh.
        if (oldVersion < 3) {
          const storeTrx = tx.objectStore("transactions");
          let cursor = await storeTrx.openCursor();
          while (cursor) {
            const v = cursor.value as TransaksiRecord & { jenisDokumen?: JenisDokumen };
            if (v.jenisDokumen === undefined) {
              const jenisDokumen = (v.jenis === "po" ? "pesanan" : "penjualan") as JenisDokumen;
              const arahStok: ArahStok = jenisDokumen === "jasa" ? "tidak_ada" : "keluar";
              await cursor.update({ ...v, jenisDokumen, arahStok, pelangganId: null });
            }
            cursor = await cursor.continue();
          }
        }

        // Migrasi ringan v3 -> v4 (Fase 2A, BU-32/34): tambah kolom PIN baru
        // dengan null (belum diatur). Tidak ada baris yang dihapus; data lama
        // (termasuk transaksi Tante) tidak disentuh sama sekali.
        if (oldVersion < 4) {
          const storeSettings = tx.objectStore("settings");
          const utama = (await storeSettings.get("utama")) as
            | (SettingsRecord & { pinOwnerHash?: string | null; pinKasirTokoHash?: string | null })
            | undefined;
          if (utama && (utama.pinOwnerHash === undefined || utama.pinKasirTokoHash === undefined)) {
            await storeSettings.put({
              ...utama,
              pinOwnerHash: utama.pinOwnerHash ?? null,
              pinKasirTokoHash: utama.pinKasirTokoHash ?? null,
            });
          }
          const storeBazar = tx.objectStore("bazars");
          let cursorBazar = await storeBazar.openCursor();
          while (cursorBazar) {
            const b = cursorBazar.value as BazarRecord & { pinKasirHash?: string | null };
            if (b.pinKasirHash === undefined) {
              await cursorBazar.update({ ...b, pinKasirHash: null });
            }
            cursorBazar = await cursorBazar.continue();
          }
        }
      },
      blocked() {
        console.warn("Kasir Kayesa: pembaruan database tertahan — tutup tab lain lalu muat ulang.");
      },
    });
  }
  return dbPromise;
}

/** Untuk tes: paksa membuka ulang koneksi (mis. setelah indexedDB dihapus). */
export function resetKoneksiDB(): void {
  dbPromise = null;
}
