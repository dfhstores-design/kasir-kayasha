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
