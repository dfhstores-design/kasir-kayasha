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
