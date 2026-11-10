# Kasir Kayasha — Spesifikasi Bazar, Parkir, dan Resi Thermal

Ditambahkan pada **Phase 1 lanjutan** (10 November 2026, 13:30 WIB) berdasarkan keputusan pemilik
dan contoh resi thermal yang dilampirkan.

Berkas ini melengkapi [`FLOW.md`](FLOW.md), [`UI-SPEC.md`](UI-SPEC.md), dan `screens/`.
Bila ada perbedaan, berkas ini yang berlaku untuk ketiga topik di bawah.

---

## 1. Keputusan pemilik (10 Nov 2026)

| # | Pertanyaan | Jawaban pemilik |
| --- | --- | --- |
| B-01 | Hubungan stok gudang dan stok bazar | **Stok gudang jadi acuan utama; tiap bazar menetapkan alokasi.** Gudang berkurang saat barang dialokasikan ke bazar; penjualan mengurangi saldo bazar. |
| B-02 | Printer | **Printer thermal 58 mm / 80 mm (Bluetooth).** Tetap ada PDF sebagai cadangan. |
| B-03 | Usaha bernama "DAPUR OPA" | **Hanya contoh format.** Nama, logo, dan alamat diganti data Kayasha Clothing. Yang ditiru susunannya. |
| B-04 | Batas dari perintah utama | **Tetap ikut seluruh larangan perintah utama** — tanpa diskon persen, tanpa hapus permanen barang, satu perangkat kasir. |
| B-05 | Jumlah transaksi parkir | **Maksimal 3**, tiap parkir **diberi nama pembeli**. |
| B-06 | Jenis transaksi | Tunai / Transfer Bank / QRIS |
| B-07 | Status transaksi | Lunas / DP / Belum dibayar |
| B-08 | Fitur bazar | Ada. Stok bazar berbeda dari stok gudang. |

---

## 2. Bazar dan stok

### 2.1 Dua angka stok

Setiap barang memiliki **satu stok gudang** dan **satu saldo bazar per bazar**.

| Angka | Arti | Berubah karena |
| --- | --- | --- |
| **Stok gudang** | Jumlah barang yang masih ada di toko/gudang | Dialokasikan ke bazar, ditarik kembali dari bazar, barang baru masuk |
| **Saldo bazar** | Jumlah barang yang benar-benar ada di meja bazar | Penjualan, pembatalan penjualan, alokasi tambahan, penarikan sisa |

Aturan yang dijaga ketat:

1. `saldo_bazar = total_dialokasikan − total_terjual_di_bazar − total_ditarik`
   (dihitung dari catatan alokasi, bukan diubah langsung).
2. Jual di bazar **hanya** mengurangi saldo bazar. Stok gudang **tidak** berubah.
3. Total alokasi tidak boleh melebihi stok gudang. Stok gudang tidak boleh negatif.
4. Saldo bazar tidak boleh negatif; penjualan ditolak bila melebihi saldo.
5. Transaksi **menyimpan snapshot** `stok_sumber = "bazar"` + `bazar_id`, sehingga riwayat tidak
   berubah saat bazar diarsipkan.
6. Barang yang tidak dialokasikan ke bazar yang sedang aktif **tidak muncul** di katalog bazar.

### 2.2 Satu bazar aktif

Master prompt menetapkan **satu perangkat dan satu alur kerja**. Karena itu:

- Hanya **satu bazar aktif** pada satu waktu. Membuka bazar baru menutup bazar sebelumnya.
- Daftar bazar tetap tersimpan untuk riwayat dan laporan.
- Bila belum ada bazar aktif, Beranda menampilkan panel "Belum ada bazar aktif" dengan tombol
  **Buka Bazar**. Penjualan cepat memakai stok gudang sampai bazar dibuka.

### 2.3 Alur

**Buka bazar** (`screens/15-bazar.md`):

```
Barang (admin) → tab Bazar → + Buka Bazar
   → nama bazar (mis. "Pameran Mall Kelapa Gading, 15–20 Nov")
   → tanggal mulai/selesai (opsional)
   → Simpan → masuk ke layar Alokasi Barang
```

**Alokasi barang** (`screens/16-alokasi-bazar.md`):

```
Daftar barang (nama, stok gudang, saldo bazar) → isi "Bawa ke bazar" per barang
   → ringkasan: "18 barang, 240 pcs" → Simpan
```

**Tutup bazar** (`screens/17-tutup-bazar.md`):

```
Ringkasan: terjual berapa, sisa berapa, uang yang masuk
   → isi "Sisa dibawa kembali ke gudang" per barang
   → Tutup Bazar → stok gudang bertambah sesuai sisa yang dikembalikan
```

---

## 3. Parkir transaksi (maksimal 3)

**Tujuan:** menahan keranjang yang belum selesai ketika pembeli sedang memilih atau membayar,
agar bisa melayani pembeli lain yang sudah selesai belanja.

Aturan:

1. Keranjang yang diparkir diberi **nama pembeli** (wajib, maks 20 huruf) supaya yakin mana yang
   dilanjutkan. Nama hanya untuk layar, tidak dicetak di resi.
2. Maksimal **3** parkir. Saat sudah 3, tombol "Parkir" dinonaktifkan dengan kalimat
   "Sudah ada 3 transaksi tertahan. Selesaikan salah satu dulu."
3. Parkir menyimpan snapshot isi keranjang: barang, jumlah, diskon item, diskon total, metode bayar.
4. **Parkir tidak mengurangi stok.** Stok baru berkurang saat transaksi disimpan. Semua parkir
   divalidasi ulang terhadap saldo bazar saat dilanjutkan (saldo bisa sudah berubah).
5. Bila saldo tidak cukup saat dilanjutkan, tampilkan: "Stok Blus Linen tinggal 1, keranjang
   tertahan berisi 2. Ubah jumlah dulu." — tombol simpan nonaktif, isi parkir **tidak** hilang.
6. Parkir bertahan setelah aplikasi ditutup (tersimpan di IndexedDB).
7. Parkir **dihapus** saat: transaksi disimpan, atau pemilik menekan "Hapus parkir" (konfirmasi).
8. Parkir **tidak** masuk ringkasan penjualan dan tidak masuk antrean sync.

Tata letak (`screens/04-keranjang.md` diperbarui):

```
┌──────────────────────────────────────┐
│  ‹ Kembali     Keranjang             │
│  Nama pembeli: [ Bu Sari      ]      │  ← dipakai saat parkir
├──────────────────────────────────────┤
│  (isi keranjang…)                    │
├──────────────────────────────────────┤
│  Tertahan (2 dari 3)                 │
│  ┌────────────────────────────────┐  │
│  │ Bu Dewi · 2 barang · Rp 400.000│  │
│  │ 14:02                          │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │ Bu Rina · 1 barang · Rp 180.000│  │
│  └────────────────────────────────┘  │
├──────────────────────────────────────┤
│  TOTAL Rp 560.000                    │
│  [ Parkir ]  [ Simpan Transaksi ]    │
└──────────────────────────────────────┘
```

- "Tertahan" hanya tampil bila ada parkir.
- Mengetuk parkir: bila keranjang sekarang berisi, bertanya sekali
  "Keranjang sekarang akan diparkir juga. Lanjutkan ke keranjang Bu Dewi?".

---

## 4. Jenis transaksi dan status

| Jenis | Kapan dipakai |
| --- | --- |
| **Tunai** | Uang fisik diterima di tempat |
| **Transfer Bank** | Uang masuk ke rekening |
| **QRIS** | Pembayaran QR |

| Status | Arti | Boleh di resi non-PO? |
| --- | --- | --- |
| **Lunas** | Sudah dibayar penuh | Ya |
| **DP** | Sebagian dibayar, ada sisa | Ya (biasanya PO, tetapi boleh untuk pesanan antar) |
| **Belum dibayar** | Belum ada uang masuk | Ya — misalnya barang diambil dulu, dibayar kemudian |

Perubahan dari rancangan sebelumnya: status pembayaran **tidak lagi dibatasi** pada alur PO.
Transaksi barang siap jual boleh disimpan sebagai **Belum dibayar** dengan nominal 0, asalkan
jenis transaksi dipilih dan tercatat di resi. Sisa tagihan dihitung dari total dikurangi pembayaran.

Status **pesanan** (Diproses / Siap / Selesai / Dibatalkan) tetap hanya untuk PO, seperti semula.

---

## 5. Resi thermal (format dari contoh)

Mengikuti susunan contoh resi, dengan data butik sendiri.

```
          [ LOGO — persegi, hitam-putih ]
              NAMA BUTIK
        Alamat baris 1
        Alamat baris 2
        KOTA KODE POS
        Telepon 1, Telepon 2
        ────────────────────────────────
  11 Nov 2026 14:20                    #7
  - Sore -                     ← sapaan (opsional)
────────────────────────────────────────
BLOK PRODUK (tebal)
  25x 10.000                    250.000
BLOK PRODUK (tebal)
  2x 42.000                      84.000
────────────────────────────────────────
Ongkos kirim                    Rp25.000
────────────────────────────────────────
Total                           Rp359.000
                            Belum Dibayar
        **TERIMA KASIH**
        Ibu Siti Aminah
        BNI 0971092588
        BCA 8810295431
              [teks penutup]
```

### Aturan pengambilan dari contoh

| Elemen contoh | Dipakai? | Catatan |
| --- | --- | --- |
| Susunan vertikal, rata tengah untuk kop | Ya | Dipertegas |
| Logo kotak hitam-putih di atas nama | Ya | Timpaan logo berwarna → hitam putih otomatis |
| Format angka `250.000` (tanpa Rp) di daftar barang | Ya | `Rp` hanya di Total dan Ongkir, persis contoh |
| `#7` = nomor urut di kanan atas | Ya | Nomor urut hari itu (`#7`), dan nomor resi lengkap `KYS-0012` di bawahnya |
| Tanggal `11 Mei 2026 15:53` | Ya | Format Indonesia |
| `- Sore -` sapaan | Ya, **opsional** | Diisi di Pengaturan: *Pagi / Siang / Sore / Malam / kosong* |
| "Ongkos kirim" | Ya | Hanya tampil bila ada ongkir yang ditagihkan butik |
| "Belum Dibayar" di bawah Total | Ya | Mengikuti status: Lunas (tanpa tulisan) / DP / Belum Dibayar |
| Nama pemilik + 2 rekening | Ya | Rekening yang ditandai aktif, maksimal 2 ditampilkan |
| Teks penutup + emoji | Ya, **opsional** | Emoji hanya bila printer mendukung; PDF selalu mendukung |
| **Diskon persen** (`25x 10.000` = Rp 10.000/unit, bukan persen) | Ya | Semua angka Rupiah. Diskon tetap **nominal**, sesuai perintah utama |

### Baris tambahan yang saya usulkan (tidak ada di contoh)

1. **Nomor resi** `KYS-0012` di bawah `#7` — kronologi jangka panjang, sekaligus untuk mencari.
2. **Baris diskon** `Diskon @ Rp 2.000 × 25` bila ada diskon item, dan **`Diskon total`** bila ada.
3. **Baris pembayaran** `Bayar (Transfer)  Rp 200.000` bila status DP — tanpa ini pembeli tidak tahu
   sisa tagihannya.
4. **Sisa tagihan** `Sisa  Rp 159.000` untuk DP/Belum dibayar.
5. **Label `PRE-ORDER` + tanggal siap** bila transaksi PO.

Ketiga tambahan ini boleh dimatikan pemilik di Pengaturan bila ingin resi persis seperti contoh.

### Ukuran kertas

| Format | Kapan |
| --- | --- |
| Thermal **58 mm** (lebar cetak ±32 karakter) | Printer thermal kecil — **format utama** |
| Thermal **80 mm** (lebar cetak ±48 karakter) | Printer thermal lebar |
| PDF **A5** | Cadangan untuk dibagikan lewat WhatsApp |

Tata letak dibuat dari panjang karakter, bukan piksel: nama barang yang panjang dipotong dengan
"…" dan nama lengkap tetap tampil di detail transaksi aplikasi.

### Batasan printer (jujur di muka)

- Web Bluetooth di PWA **hanya** bekerja dengan printer BLE/GATT. Banyak printer thermal memakai
  Bluetooth Classic (SPP) yang **tidak** bisa dipakai langsung dari browser.
- Saya **tidak** akan menampilkan tombol cetak sebagai fitur siap pakai sebelum model printer
  diuji. Tombol baru muncul setelah pengujian pada Phase 5 berhasil.
- Sampai printer terbukti: **PDF selalu tersedia** dan itulah yang dijanjikan.
- Agar uji lebih mudah, Pengaturan menyediakan **"Uji printer"** dengan contoh resi.

---

## 6. Layar yang bertambah / berubah

| Layar | Status | Alasan |
| --- | --- | --- |
| `15-bazar.md` | **baru** | Buka bazar, daftar bazar, tutup bazar |
| `16-alokasi-bazar.md` | **baru** | Bawa barang ke bazar |
| `17-tutup-bazar.md` | **baru** | Hitung sisa & kembalikan ke gudang |
| `04-keranjang.md` | **diubah** | Nama pembeli + daftar parkir + tombol Parkir |
| `05-transaksi-tersimpan.md` | diubah | Menyebut status bayar & tombol Cetak (bila printer teruji) |
| `06-resi.md` | **diubah** | Format thermal 58/80 mm + tombol Cetak |
| `09-daftar-barang.md` | diubah | Kolom stok gudang + saldo bazar |
| `10-form-barang.md` | diubah | Stok gudang vs alokasi bazar |
| `11-pengaturan.md` | diubah | Sapaan, 2 rekening, uji printer, format resi |
| `01-beranda.md` | diubah | Bazar aktif + panel "Belum ada bazar aktif" |

## 7. Fase

Fitur baru menambah pekerjaan, jadi urutan fase disesuaikan (lihat `PROJECT-BRIEF.md` bagian 8):

| Fase | Perubahan |
| --- | --- |
| Phase 2 | Skema IndexedDB bertambah: `bazars`, `bazar_allocations` (alokasi & penarikan), `parked_carts` |
| Phase 3 | Katalog + **stok gudang** + penjualan langsung |
| **Phase 3B (baru)** | **Bazar, alokasi, tutup bazar, parkir transaksi** |
| Phase 4 | PO, DP, ongkir, diskon, status bayar |
| **Phase 5** | Resi thermal 58/80 mm + PDF, logo, rekening, **uji printer** |
| Phase 6 | D1 + R2 |
| Phase 7 | QA, backup, deployment, panduan pemilik |
