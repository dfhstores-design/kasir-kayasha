# Layar 11 — Pengaturan

**Tugas utama:** mengisi identitas butik dan data resi sekali saja, lalu tidak disentuh lagi.

```
┌──────────────────────────────────────┐
│  ‹ Kembali     Pengaturan            │
├──────────────────────────────────────┤
│  ┌────────────────────────────────┐  │
│  │ Nama & kontak butik          › │  │
│  ├────────────────────────────────┤  │
│  │ Logo resi                    › │  │
│  ├────────────────────────────────┤  │
│  │ Rekening tujuan              › │  │
│  ├────────────────────────────────┤  │
│  │ Teks penutup resi            › │  │
│  ├────────────────────────────────┤  │
│  │ Lihat contoh resi            › │  │
│  ├────────────────────────────────┤  │
│  │ Kunci menu (PIN)             › │  │
│  ├────────────────────────────────┤  │
│  │ Cadangan & pemulihan         › │  │
│  └────────────────────────────────┘  │
│                                      │
│  Kasir Kayasha versi 0.x.x           │
│  Tersimpan di perangkat ini          │
└──────────────────────────────────────┘
```

## Sub-layar

### Nama & kontak butik
Nama butik (wajib) · Alamat/kontak (opsional, tampil di resi) → Simpan.

### Logo resi
Pratinjau logo saat ini · **Unggah logo** / **Ganti logo** / **Hapus logo** (konfirmasi).
Saran: "Gambar persegi, latar putih." Logo tampil proporsional di resi (tidak dipotong).

### Rekening tujuan
Daftar rekening: nama bank, nomor rekening, nama pemilik. Tiap baris punya **Gunakan di resi (aktif)**.
Bisa tambah lebih dari satu, hanya satu yang aktif. Contoh format ditampilkan di bawah kolom:
"BCA · 1234567890 · Siti Aminah".

### Teks penutup resi
Satu kolom teks bebas, contoh: "Terima kasih, sampai jumpa di pameran berikutnya!" — boleh kosong.

### Lihat contoh resi
Pratinjau resi dengan logo, nama, rekening aktif, dan teks penutup saat ini (data contoh).

### Kunci menu (PIN)
Mengatur 4 angka untuk membuka Pengaturan & Barang. Bila kosong → tidak terkunci.
Pesan bila lupa: petunjuk pemulihan (lihat Phase 7).

### Cadangan & pemulihan
→ Status Simpan & Backup (layar 14).

## Aturan

- Pengaturan adalah daftar pilihan besar, **bukan** tab kecil atau ikon.
- Perubahan berlaku untuk transaksi baru; resi lama tidak berubah (menyimpan salinan sendiri).
- Nomor rekening **tidak pernah** ditampilkan di luar layar Pengaturan dan resi.

---

## Pembaruan Phase 1 lanjutan (resi thermal)

Pilihan baru di daftar Pengaturan:

| Pilihan | Isi |
| --- | --- |
| **Sapaan resi** | **Otomatis dari jam** (Pagi/Siang/Sore/Malam). Hanya sakelar `Tampilkan sapaan: Ya/Tidak` — tidak dipilih manual (B-09) |
| **Rekening tujuan** | Boleh **2 rekening** ditampilkan di resi (contoh: BNI + BCA); satu ditandai **utama** |
| **Format resi** | `PDF A5` (satu-satunya output MVP). Pilihan `Thermal 58/80 mm` diberi label **"to be develop"** dan tidak bisa dipilih |
| **Baris tambahan resi** | Sakelar: `Nomor resi` · `Rincian diskon` · `Pembayaran & sisa`. Dimatikan = resi persis seperti contoh |
| **Ongkir** | `Selalu tampilkan baris ongkir: Ya` (bawaan Ya, sesuai B-10) |
| **Bazar** | Tautan ke layar Bazar (15) |

Alamat resi kini punya kolom terpisah: **alamat (2 baris)**, **kota + kode pos**, dan **telepon**
(maksimal 2) — mengikuti susunan contoh resi.

### Khusus fitur *to be develop*

Bagian **"Segera hadir"** di bawah Pengaturan, dipisah garis, berisi satu baris:
**"Cetak printer thermal — sedang disiapkan"**. Tidak ada tombol aktif, tidak ada tautan palsu.
Ini memberi tahu fitur datang tanpa membuat pengguna menebak.
