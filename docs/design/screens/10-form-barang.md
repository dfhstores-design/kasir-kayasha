# Layar 10 — Form Barang

**Tugas utama:** menyimpan barang baru atau perubahan dengan cepat, tanpa kolom yang tidak perlu.

```
┌──────────────────────────────────────┐
│  ‹ Kembali     Barang Baru           │
├──────────────────────────────────────┤
│  Nama barang                         │
│  [ Blus Linen Lengan Panjang      ]  │
│                                      │
│  Harga jual                          │
│  [ Rp 180.000                     ]  │
│                                      │
│  Stok siap jual                      │
│  [ 4                              ]  │
│                                      │
│  Foto (0 dari 3)                     │
│  ┌────────┐ ┌────────┐ ┌────────┐    │
│  │ [foto] │ │  +     │ │  +     │    │
│  └────────┘ └────────┘ └────────┘    │
│  [ Ambil Foto ]  [ Pilih dari Galeri ]│
│                                      │
│  ▸ Isian tidak wajib (kode, catatan) │  ← dilipat
│                                      │
├──────────────────────────────────────┤
│  ┌────────────────────────────────┐  │
│  │         Simpan Barang          │  │
│  └────────────────────────────────┘  │
│  Arsipkan barang                     │  ← hanya saat mengubah
└──────────────────────────────────────┘
```

## Isi & perilaku

| Kolom | Aturan |
| --- | --- |
| Nama | Wajib, ≥ 2 huruf. Teks bantu: "Contoh: Blus Linen Lengan Panjang" |
| Harga jual | Wajib, angka bulat ≥ 1. Pemisah ribuan otomatis |
| Stok siap jual | Wajib, angka bulat ≥ 0. 0 = tampil "Stok habis" di katalog |
| Foto | Maksimal 3. Slot kosong jadi tombol tambah. Foto pertama = thumbnail |
| Kode barang (opsional) | Teks bebas, contoh "BL-01" |
| Catatan (opsional) | Contoh "Bahan linen, warna krem", maks 2 baris |
| Simpan Barang | Nonaktif bila ada kolom wajib yang belum benar |
| Arsipkan barang | Hanya saat mengubah; konfirmasi: "Arsipkan barang ini? Barang tidak akan muncul di katalog." |

## Perilaku foto

- Setelah memilih/ambil foto: kompres di perangkat (±1600 px, 250–400 KB) lalu tampilkan pratinjau
  dengan tombol **Ganti** dan **Hapus**.
- Foto ke-4 tidak dapat ditambahkan: slot tambah hilang saat sudah 3 foto, dengan tulisan
  "Maksimal 3 foto".
- Menghapus foto meminta konfirmasi satu kali.
- Mengganti foto tidak meminta konfirmasi (mudah diperbaiki).

## Aturan

- Form awal hanya tiga kolom wajib + foto; isian opsional dilipat di bawah.
- Bilamana ada isian salah: pesan **"Perbaiki: <hal>"** di bawah kolom, bukan di atas layar.
- Setelah simpan → kembali ke Daftar Barang dengan barang baru di urutan A–Z.
- Tidak ada tombol Hapus permanen. Barang tanpa transaksi boleh dihapus **hanya** dari detail
  arsip, dengan konfirmasi dua langkah; barang yang pernah terjual hanya bisa diarsipkan.

---

## Pembaruan Phase 1 lanjutan (stok gudang)

| Kolom | Perubahan |
| --- | --- |
| **Stok gudang** | Label diganti dari "Stok siap jual" menjadi **"Stok gudang"**, teks bantu: "Barang yang ada di toko. Yang dibawa ke bazar diatur di menu Bazar." |
| Alokasi bazar | **Tidak diisi di sini.** Ada baris baca-saja "Bazar sekarang: 12 pcs" bila ada bazar aktif |

Angka yang diketik pemilik di form ini **adalah stok gudang**. Stok bazar hanya berubah lewat
layar Alokasi (16) dan Tutup Bazar (17), sehingga tidak ada dua tempat yang membingungkan.

---

## Pembaruan Phase 3 — indikator progres foto **WAJIB**

Permintaan pemilik (10 Nov 2026): *"wajib ada indikator progress ketika upload foto"*.

Saat foto diproses, layar **selalu** menampilkan indikator progres. Tidak ada pemrosesan diam-diam.

| Tahap | Tulisan | Persen |
| --- | --- | --- |
| Membaca berkas | `Membaca foto…` | 0 |
| Mengecilkan | `Mengecilkan foto…` | 15 |
| Mengompres | `Mengompres foto…` | 40 |
| Menyimpan | `Menyimpan foto…` | 85 |
| Selesai | `Foto siap` | 100 |
| Gagal | pesan galat (mis. `Foto tidak dapat dibaca.`) | tanpa batang |

```
┌──────────────────────────────────────┐
│ Mengompres foto…                  40%│
│ ███████████░░░░░░░░░░░░░░░░░░░░░░░░░ │
└──────────────────────────────────────┘
```

Aturan:

1. **Tulisan + angka persen selalu ada**, bukan hanya batang warna.
2. Memakai `role="progressbar"` + `aria-valuenow`, dan `aria-live="polite"` agar pembaca layar
   mengumumkan tahapnya.
3. Persen **tidak** mencapai 100 sebelum benar-benar selesai (maksimal 99 selama berjalan).
4. Keadaan gagal jelas bertekstur khusus (latar peringatan) dan **tidak** menampilkan `0%` —
   menampilkan pesan galat saja.
5. **Unggah ke cloud** (Phase 6) memakai indikator terpisah dengan teks `Mengunggah 1 dari 3 foto…`.
   Pada Phase 3 baris itu berbunyi **`Tersimpan di perangkat`** — jujur menyebut foto belum dikirim,
   bukan berpura-pura selesai mengunggah.
6. Foto tetap bisa diambil **saat offline**; progresnya tetap berjalan karena semua di perangkat.

Kode: `src/lib/progresFoto.ts` (logika, 14 tes) dan `src/components/IndikatorProgres.tsx` (tampilan).

---

## Pembaruan Phase 3 — foto resolusi tinggi (>80 MB)

Permintaan pemilik: *"perlu antisipasi ukuran foto yang diupload memiliki resolusi tinggi dengan
ukuran 1 file >80MB"*.

Melakukan decode foto 108 MP sekaligus bisa memakai **±400 MB RAM** dan membuat tab Android
**crash** (bukan error yang bisa ditangkap). Karena itu berkas disaring berlapis:

| Lapis | Pemeriksaan | Batas |
| --- | --- | --- |
| 1. Sebelum decode | tipe berkas harus gambar | JPEG · PNG · WebP · HEIC/HEIF (type kosong juga diterima) |
| 1. Sebelum decode | ukuran berkas | ditolak di atas **150 MB** |
| 1. Sebelum decode | berkas > **10 MB** → tandai "besar" | memakai jalur decode hemat memori |
| 2. Saat decode | berkas besar didecode dengan `createImageBitmap(file, { resizeWidth: 1600 })` | memori puncak jauh lebih kecil |
| 3. Setelah decode | resolusi maksimum | ditolak di atas **150 MP** |
| 4. Mengecilkan | pengecilan **bertahap** (maks 2× per langkah) lewat kanvas perantara | memori puncak terkendali |
| 5. Kompres | kualitas 0,82 → 0,50 sampai ≤ 400 KB | sesuai target |

Pesan galat ditampilkan **satu kali** di panel progres (mode gagal), bukan diulang di tempat lain:

- `Foto terlalu besar (160.0 MB). Maksimal 150 MB.`
- `Berkas ini bukan foto.`
- `Foto terlalu besar resolusinya (300 megapiksel). Maksimal 150 megapiksel.`
- `Foto tidak dapat dibaca. Coba foto lain.`

Bila foto besar sedang diproses, muncul keterangan
`Foto besar — sedang dikecilkan. Mohon tunggu sebentar.` di atas indikator progres.

### Hasil uji nyata (Chrome, 10 Nov 2026)

| Foto masukan | Hasil |
| --- | --- |
| 48 MP, **43,9 MB** JPEG (noise) | ✅ **1600×1200 WebP, 329 KB** — masuk target 250–400 KB |
| 160 MB JPEG | ✅ ditolak sebelum decode, pesan jelas, **jumlah foto tidak berubah**, tidak ada batang progres |
| 3000×2000, 104 KB | ✅ 1600×1067 WebP, 6 KB |

Bila `createImageBitmap` tidak tersedia (browser lama) atau gagal (mis. HEIC), dipakai `<img>`
lalu pengecilan bertahap dengan jalur yang sama.

Kode: `src/lib/kompresiFoto.ts` — `periksaBerkasFoto`, `periksaResolusi`, `jalurPengecilan`
(33 tes, termasuk pemeriksaan bahwa `createImageBitmap` **tidak dipanggil** untuk berkas 200 MB).
