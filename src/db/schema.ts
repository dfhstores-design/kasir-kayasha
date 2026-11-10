/**
 * Skema IndexedDB Kasir Kayasha.
 *
 * Aturan dari CONTEXT: jangan pakai localStorage untuk data transaksi utama.
 * Semua data bisnis ada di IndexedDB, ditulis SEBELUM menunggu server.
 *
 * Store:
 *   settings        profil usaha, logo, rekening, sapaan (1 record kunci "utama")
 *   products        barang + stok gudang (stok bazar disimpan terpisah)
 *   product_photos  foto terkompresi, urutan 1–3 per barang
 *   bazars          satu bazar aktif pada satu waktu
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

export const DB_NAME = "kasir-kayasha";
export const DB_VERSION = 2;

export type UUID = string;

export interface Rekening {
  id: UUID;
  namaBank: string;
  nomor: string;
  namaPemilik: string;
  /** Hanya satu yang utama; itulah yang dicetak di resi. */
  utama: boolean;
}

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
  /** PIN 4 angka untuk menu Pengaturan & Barang; null = tidak terkunci. */
  pinHash: string | null;
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
  /** "aktif" atau "selesai". Hanya satu yang aktif. */
  status: "aktif" | "selesai";
  ringkasanTerjual: number | null;
  ringkasanDibawa: number | null;
  ringkasanSisa: number | null;
  ditutupPada: string | null;
  createdAt: string;
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
  waktu: string;
  /** "langsung" (barang siap jual) atau "po" (pre-order). */
  jenis: "langsung" | "po";
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

export interface OutboxRecord {
  id: UUID;
  jenisRecord: "produk" | "transaksi" | "pembayaran" | "settings";
  idRecord: string;
  aksi: "upsert";
  percobaan: number;
  terakhirDicoba: string | null;
  dibuatPada: string;
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
}

let dbPromise: Promise<IDBPDatabase<KasirDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<KasirDB>> {
  if (!dbPromise) {
    dbPromise = openDB<KasirDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
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
      },
      blocked() {
        console.warn("Kasir Kayasha: pembaruan database tertahan — tutup tab lain lalu muat ulang.");
      },
    });
  }
  return dbPromise;
}

/** Untuk tes: paksa membuka ulang koneksi (mis. setelah indexedDB dihapus). */
export function resetKoneksiDB(): void {
  dbPromise = null;
}
