-- Skema D1 untuk Kasir Kayesa — salinan cloud (Phase 6).
--
-- PRINSIP: D1 adalah SALINAN, bukan sumber kebenaran. Perangkat tetap sumber utama.
-- Sinkronisasi bersifat idempoten: mengirim ulang data yang sama TIDAK menggandakan baris.
--
-- Foto produk TIDAK disalin ke cloud (R2 tidak dipakai — keputusan pemilik, Q-02).
-- Bila R2 diaktifkan kelak, tambahkan tabel product_photos_r2 tanpa mengubah tabel lain.
--
-- Terapkan dengan:
--   npx wrangler d1 execute kasir-kayesha --remote --file=./db/schema.sql

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------- transaksi

CREATE TABLE IF NOT EXISTS transactions (
  id                TEXT PRIMARY KEY,
  nomor_resi        TEXT NOT NULL,
  waktu             TEXT NOT NULL,
  jenis             TEXT,                    -- deprecated: langsung | po (dipetakan dari jenis_dokumen)
  jenis_dokumen     TEXT NOT NULL,           -- penjualan | pesanan (DEPRECATED 18 Nov 2026: PO barang dihapus, dipertahankan demi riwayat lama) | jasa
  arah_stok         TEXT NOT NULL,           -- keluar | masuk | tidak_ada
  pelanggan_id      TEXT,                    -- UUID pelanggan (CRM, BU-28); null = belum ditautkan
  status_pesanan    TEXT NOT NULL,
  status_bayar      TEXT NOT NULL,
  bazar_id          TEXT,
  nama_pemesan      TEXT,
  kontak            TEXT,                    -- Fase 2B: kontak pemesan (pesanan jahit)
  catatan_pesanan   TEXT,                    -- Fase 2B
  perkiraan_siap    TEXT,                    -- Fase 2B
  alamat            TEXT,                    -- Fase 2B: alamat kirim
  nomor_urut_bulan  INTEGER,                 -- Fase 2B: nomor urut pesanan jahit (BU-19/21)
  jenis_bayar       TEXT,                    -- Fase 2B: tunai | transfer | qris
  ongkir_mode       TEXT NOT NULL,
  ongkir_nominal    INTEGER,
  subtotal_awal     INTEGER NOT NULL,
  diskon_item       INTEGER NOT NULL,
  diskon_total      INTEGER NOT NULL,
  total             INTEGER NOT NULL,
  dibatalkan_pada   TEXT,
  dibuat_pada       TEXT NOT NULL,
  diubah_pada       TEXT NOT NULL,
  -- catatan: 1 = berasal dari perangkat ini, untuk audit
  perangkat         TEXT
);

CREATE INDEX IF NOT EXISTS idx_transactions_waktu ON transactions (waktu);
CREATE INDEX IF NOT EXISTS idx_transactions_bazar ON transactions (bazar_id);

CREATE TABLE IF NOT EXISTS transaction_items (
  id             TEXT PRIMARY KEY,
  transaksi_id   TEXT NOT NULL,
  produk_id      TEXT,
  nama_snapshot  TEXT NOT NULL,
  harga_satuan   INTEGER NOT NULL,
  kuantitas      INTEGER NOT NULL,
  diskon_per_unit INTEGER NOT NULL,
  subtotal_bersih INTEGER NOT NULL,
  ukuran         TEXT,                    -- Fase 2B: ukuran/catatan khusus per item (BU-56)
  urutan          INTEGER,                 -- Fase 2B: urutan baris seperti diinput (BU-56)
  FOREIGN KEY (transaksi_id) REFERENCES transactions (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_items_transaksi ON transaction_items (transaksi_id);

CREATE TABLE IF NOT EXISTS payments (
  id            TEXT PRIMARY KEY,
  transaksi_id  TEXT NOT NULL,
  nominal       INTEGER NOT NULL,
  waktu         TEXT NOT NULL,
  metode        TEXT,
  catatan       TEXT,                    -- Fase 2B
  FOREIGN KEY (transaksi_id) REFERENCES transactions (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_payments_transaksi ON payments (transaksi_id);

-- ---------------------------------------------------------------- katalog

CREATE TABLE IF NOT EXISTS products (
  id           TEXT PRIMARY KEY,
  nama         TEXT NOT NULL,
  kode         TEXT,
  harga_jual   INTEGER NOT NULL,
  stok_gudang  INTEGER NOT NULL,
  catatan      TEXT,                    -- Fase 2B
  arsip        INTEGER NOT NULL DEFAULT 0,
  diubah_pada  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bazars (
  id          TEXT PRIMARY KEY,
  nama        TEXT NOT NULL,
  status      TEXT NOT NULL,
  lokasi      TEXT,
  mulai       TEXT,
  selesai     TEXT,
  catatan     TEXT,                    -- Fase 2B
  pin_kasir_hash TEXT,                 -- Fase 2B: hash PIN kasir bazar (BU-34)
  diubah_pada TEXT NOT NULL
);

-- ---------------------------------------------------------------- jejak sync

-- Mencatat setiap kiriman yang sudah diterima, agar retry tidak menggandakan data.
-- `kunci` = "<jenis>:<id>:<versi>".
CREATE TABLE IF NOT EXISTS sync_log (
  kunci        TEXT PRIMARY KEY,
  jenis        TEXT NOT NULL,
  id_record    TEXT NOT NULL,
  diterima_pada TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_log_jenis ON sync_log (jenis);

-- ---------------------------------------------------------------- journal

CREATE TABLE IF NOT EXISTS journal (
  id           TEXT PRIMARY KEY,
  arah         TEXT NOT NULL,            -- masuk | keluar
  kategori     TEXT NOT NULL,
  nominal      INTEGER NOT NULL,         -- integer Rupiah, > 0
  waktu        TEXT NOT NULL,
  dokumen_id   TEXT,                     -- dokumen asal; null = jurnal manual
  pemilik      TEXT NOT NULL,            -- usaha | pribadi
  sumber       TEXT NOT NULL,            -- usaha | pribadi
  catatan      TEXT
);

CREATE INDEX IF NOT EXISTS idx_journal_waktu ON journal (waktu);
CREATE INDEX IF NOT EXISTS idx_journal_dokumen ON journal (dokumen_id);

-- ---------------------------------------------------------------- pelanggan

CREATE TABLE IF NOT EXISTS pelanggan (
  id           TEXT PRIMARY KEY,
  nama         TEXT NOT NULL,
  kontak       TEXT
);

CREATE INDEX IF NOT EXISTS idx_pelanggan_nama ON pelanggan (nama);

-- ---------------------------------------------------------------- pengiriman

CREATE TABLE IF NOT EXISTS pengiriman (
  id           TEXT PRIMARY KEY,
  dokumen_id   TEXT NOT NULL,
  pelanggan_id TEXT NOT NULL,
  waktu        TEXT NOT NULL,
  jenis        TEXT NOT NULL,            -- invoice | resi
  tujuan       TEXT
);

CREATE INDEX IF NOT EXISTS idx_pengiriman_dokumen ON pengiriman (dokumen_id);
CREATE INDEX IF NOT EXISTS idx_pengiriman_pelanggan ON pengiriman (pelanggan_id);

-- ---------------------------------------------------------------- migrasi Fase 2B
--
-- Kolom baru di atas (kontak, catatan_pesanan, perkiraan_siap, alamat,
-- nomor_urut_bulan, jenis_bayar, ukuran, urutan, catatan, pin_kasir_hash)
-- hanya terbentuk otomatis di database BARU. Database yang SUDAH ADA
-- (mis. D1 trial kasir-kayasha-t2) perlu ALTER TABLE satu kali, mis.:
--   ALTER TABLE transactions ADD COLUMN kontak TEXT;
--   ALTER TABLE transactions ADD COLUMN catatan_pesanan TEXT;
--   ALTER TABLE transactions ADD COLUMN perkiraan_siap TEXT;
--   ALTER TABLE transactions ADD COLUMN alamat TEXT;
--   ALTER TABLE transactions ADD COLUMN nomor_urut_bulan INTEGER;
--   ALTER TABLE transactions ADD COLUMN jenis_bayar TEXT;
--   ALTER TABLE transaction_items ADD COLUMN ukuran TEXT;
--   ALTER TABLE transaction_items ADD COLUMN urutan INTEGER;
--   ALTER TABLE payments ADD COLUMN catatan TEXT;
--   ALTER TABLE products ADD COLUMN catatan TEXT;
--   ALTER TABLE bazars ADD COLUMN catatan TEXT;
--   ALTER TABLE bazars ADD COLUMN pin_kasir_hash TEXT;
-- Jangan jalankan ALTER dua kali pada kolom yang sama (SQLite menolak).
