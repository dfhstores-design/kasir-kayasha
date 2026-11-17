# Spesifikasi Desain Tahap 1 — Aplikasi Kasir KAYESA'S CLOTHING

**Status:** rekap perancangan arsitektur & desain. **Bukan perintah eksekusi; belum ada kode yang diubah.**
**Disusun:** 16 November 2026 (Asia/Jakarta)
**Sumber:** `BLUEPRINT-ARP-KECIL.md` + `CATATAN-DISKUSI.md` (keputusan K-01…K-22, BU-01…BU-31).
**Nama resmi (terkunci):** **KAYESA'S CLOTHING** (nama lengkap/logo) dan **KAYESA** (nama utama).
Ejaan lain apa pun dilarang dipakai — hanya dua nama resmi di atas yang berlaku.

---

## 0. Satu paragraf posisi

Tahap 1 membangun **pesanan jahit + uang masuk + dokumen** di atas fondasi yang sudah dikunci.
Ini bukan proyek terpisah dari ERP kecil, melainkan lapisan pertama yang menumpuk rapi di atas
asas *"satu model dokumen, banyak jenis"*. Tujuan: Tante (>62 th) cukup **melihat & mengetuk**
tanpa bingung (`simplicity` wajib), dan pondasi tidak perlu dirombak saat tahap berikutnya masuk.

---

## 1. Cakupan Tahap 1 (dikunci dari janji ke Tante — BU-12)

**Termasuk:**

1. Mencatat **pesanan jahitan**: nama pemesan, model/jenis, ukuran, biaya jasa, perkiraan selesai (jasa, tak kurangi stok).
2. Mencatat **uang masuk**: DP & pelunasan bertahap + tanggal.
3. **Dokumen otomatis**: invoice → resi/bukti (judul berubah sendiri).
4. **Satu tombol bagikan gambar (PNG)** ke WhatsApp.
5. Invoice untuk **menagih dengan sopan**.

**TIDAK termasuk (tahap lanjut):** stok, kasir staff multi-perangkat yang terlihat, laporan keuangan
lengkap, buku kas, pencatatan pengeluaran/belanja. Semua fitur itu disiapkan tersembunyi (BU-11) dan
di-unlock per tahap setelah harga & termin disepakati.

---

## 2. Asas arsitektur (fondasi, berlaku ke semua tahap)

| # | Asas |
|---|---|
| **A-1** | Satu model dokumen, banyak jenis. Setiap aliran uang & pergerakan barang = satu "dokumen" ber-`jenisDokumen` + `arahStok`. Barang, jasa, uang = baris dokumen. |
| **A-2** | Jurnal (`journal`) satu-arah, **turunan (recompute)** dari dokumen — bukan ditulis manual dua kali. |
| **A-3** | Offline-first: sumber kebenaran di perangkat (IndexedDB), D1 = salinan. UUID di perangkat, outbox idempotent. |
| **A-4** | Nama domain pakai **bahasa Indonesia** (`jenisDokumen`, `arahStok`, `namaPemesan`, dll). |
| **A-5** | Tanpa mikroservice, tanpa ORM baru, tanpa pindah server. `idb` + fungsi murni. |

**Struktur model inti (dikunci):**

```
dokumen {
  id            UUID
  jenisDokumen  "penjualan" | "pesanan" | "jasa" | ...  (string union tertutup + versi)
  arahStok      "keluar" | "masuk" | "tidak_ada"
  status        "terbuka" | "lunas" | "batal"
  pelangganId   UUID | null        (ditanam dini — CRM Tahap 6)
  namaPemesan, kontak, model/jenis, ukuran, biayaJasa, perkiraanSelesai, catatan
  terbayar, total, sisa           (turunan; sisa = total − terbayar)
}

payments { id, dokumenId, nominal, metode (tunai/transfer), tanggal }   // baris bertahap

journal { id, arah (masuk/keluar), kategori, nominal, waktu, dokumenId,
          pemilik (usaha/pribadi), sumber (usaha/pribadi), catatan }     // turunan

pelanggan { id, nama, kontak }      // entitas tipis, dibuat otomatis

pengiriman { id, dokumenId, pelangganId, waktu, jenis (invoice/resi), tujuan }  // log kirim
```

---

## 3. Model pesanan jahit

| Keputusan | Isi |
|---|---|
| **BU-13** | Satu pesanan = satu dokumen `jenisDokumen:"jasa"` + `arahStok:"tidak_ada"` + banyak baris `payments` (bukan dokumen terpisah). |
| **BU-14** | Wajib: `namaPemesan`, `model/jenis`, `biayaJasa`. Opsional: `kontak`, `ukuran`, `perkiraanSelesai`, `catatan`. |
| **BU-15** | `biayaJasa` (pokok) + opsi **"biaya lain"** manual yang tersimpan untuk transaksi berikutnya (reusable). |
| **BU-20** | Status: `terbuka` (belum lunas) / `lunas` (sisa=0) / `batal` (void + alasan). |

---

## 4. Alur kasir & pembayaran

| Keputusan | Isi |
|---|---|
| **BU-18** | **Pintu pemasukan SATU: antar-muka kasir.** Semua DP/cicilan/pelunasan dibayar lewat kasir (bukan form pesanan). |
| **BU-24** | Kasir punya **dua tombol/alur**: **"Pesanan"** (`jasa`) dan **"Penjualan"** (`penjualan`, kurangi stok — di-unlock di tahap stok). |
| **BU-22.B** | Kasir **juga boleh membuat/mencatat pesanan** (antisipasi terima pesanan di bazar/toko lain). |
| **BU-23** | Alur bayar: pilih pesanan belum lunas → masukkan nominal → hitung otomatis (sisa/kembalian) → simpan + bagikan dokumen. Metode: tunai (default) / transfer BCA. Satu penerimaan = satu baris `payments`. |
| **BU-17.B** | Boleh bayar **lebih** dari total (tunai) → tampil **kembalian**; sistem mencatat utuh sesuai pembayaran penuh. |
| **BU-17.C** | Void diperbolehkan dengan alasan jelas & tercatat; riwayat transaksi terlihat di sisi kasir. |
| **BU-08** | Jurnal hanya mencatat uang yang **benar-benar bergerak** (nominal diterima); piutang/sisa TIDAK masuk jurnal. Pemasukan tidak bisa dibuat manual. |

---

## 5. Dokumen keluaran (PNG utama, PDF cadangan)

| Keputusan | Isi |
|---|---|
| **K-01 / BU-26** | PNG output utama, PDF cadangan (arsip/cetak). Tombol **"Bagikan"** (share sheet native → WhatsApp) + **"Simpan ke Foto"**. Invoice dipakai juga untuk menagih (menampilkan SISA). |
| **BU-17.A / K-02** | Judul otomatis: `sisa>0` → INVOICE/NOTA PESANAN; `sisa=0` → RESI/BUKTI PEMBAYARAN. Ada pilihan format cetak (bisa dimatikan setelah feedback Tante). |
| **BU-16 / K-26** | Rekening **selalu tampil** di semua dokumen: BCA · 676 017 885 a.n. NARSHITA DEWI. |
| **BU-25** | Nama besar **KAYESA**, logo **KAYESA'S CLOTHING** (gambar). Kop/kaki ikut faktur lama dulu (kotak PERHATIAN + Hormat Kami + rekening) — sementara. **Ukuran font & layout dokumen = FIX** (tidak mengikuti setelan font aplikasi). |

**Susunan dokumen (badan):** Kop (logo + KAYESA + alamat + kontak) → judul → `NO:` + `TANGGAL` +
`KEPADA YTH.` → detail (model/jenis · ukuran · perkiraan selesai) → biaya + TOTAL → DP/terbayar +
SISA (invoice) → rekening → penutup (PERHATIAN + Hormat Kami).

---

## 6. Input & tampilan (untuk Tante, `simplicity` wajib)

| Keputusan | Isi |
|---|---|
| **BU-22.A** | Input pesanan pakai **wizard** (langkah berurutan, satu pertanyaan per layar), bukan satu form panjang. |
| **BU-29** | Daftar pesanan = dua tab besar **"Belum Lunas"** (terbuka pertama) & **"Riwayat"**. Kartu besar: nama, jenis jahitan, sisa, status kirim. Ketuk kartu → detail. Riwayat = lunas/batal + label. |
| **BU-27 / BU-28** | Log pengiriman (`pengiriman` → `pelangganId` + `dokumenId`), tercatat otomatis saat Bagikan. Tanda ✓ "sudah/belum dikirim" per baris. `pelanggan` dibuat otomatis saat pesanan dibuat. |
| **BU-30** | Daftar **"perlu ditagih"** (belum lunas + perkiraan selesai lewat), tanpa notifikasi otomatis dulu (Opsi A). |
| **BU-09** | Pengaman jurnal manual: deteksi dobel-input (konfirmasi) + peringatan nominal tak wajar — sejak awal. "Tutup Kas Harian" → nanti Tahap 4. |

---

## 7. Keuangan & sinkronisasi (fondasi ke ERP kecil)

| Keputusan | Isi |
|---|---|
| **BU-02** | `journal` satu-arah, turunan dari dokumen (recompute). |
| **BU-06** | `kategori` deklaratif (penjualan, dp, pelunasan, biaya_bahan, upah, listrik, lain_lain) + opsi "isi sendiri" yang tersimpan. |
| **BU-07 / BU-05** | Dua kolom `pemilik` (untuk keperluan siapa) + `sumber` (dari dompet mana). Otomatis = `usaha/usaha`; manual = pilih, default `usaha`. |
| **BU-10** | Dua peran bisa beda orang & perangkat: Tante (catat pengeluaran/belanja) vs kasir (staff). |
| **BU-11** | Role + sync dua arah dibangun lebih awal, **tersembunyi** di balik layar; unlock per tahap. |
| **BU-31** | Data transaksi offline-first (IndexedDB + salinan D1). **Google Sheet hanya untuk impor stok awal (batch, sekali)** di Tahap 3. Bila jaringan memadai: akses online + kasir kirim ke jurnal online. Perangkat tetap otoritatif. |

---

## 8. Roadmap (urutan)

| Urutan | Isi | Terlihat |
|---|---|---|
| **M0** | Fondasi skema: `jenisDokumen` + `arahStok` + kerangka `journal` | tersembunyi |
| **Tahap 1** | Pesanan jahit + uang masuk + dokumen PNG | ✅ Tante |
| **Sync 2-arah + role** | Ditarik maju, dikerjakan tersembunyi | tersembunyi sampai dibuka |
| **Tahap berikutnya** | Pencatatan pengeluaran/belanja → stok → buku kas → HPP → CRM | unlock per tahap |

---

## 9. Masih pending (menunggu input eksternal)

| # | Keputusan | Yang menunggu |
|---|---|---|
| **BU-19** | Penomoran dokumen (`NO:`) | contoh nota asli / konfirmasi Tante |
| **BU-21** | Arti kode `KC` (dugaan: skema nomor `KC-YYYYMMDD`) | contoh nota asli terisi |
| **BU-22** | Alur input (wizard & siapa input) — sebagian sudah setuju | balasan Tante (±1–2 hari) |

---

*Dokumen ini adalah ringkasan keputusan, bukan pengganti `BLUEPRINT-ARP-KECIL.md` maupun
`CATATAN-DISKUSI.md`. Bila ada perbedaan, dua berkas sumber itulah yang otoritatif.*