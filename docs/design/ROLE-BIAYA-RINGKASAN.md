# Kasir Kayesha — Peran Admin & Kasir, Biaya Bazar, dan Ringkasan

Ditetapkan **10 November 2026** atas permintaan pemilik. Dokumen ini **merevisi** sebagian
perintah utama (`Kasir_Butik_Pameran_—_Master_Prompt_untuk_AI_Agent.md`) dan mengalahkan isi
dokumen lain untuk topik di bawah.

---

## 0. Revisi perintah utama (resmi)

Perintah utama bagian "Kontek dan batasan" melarang **akun banyak pegawai** dan
**role bertingkat**. Pemilik memutuskan revisi pada **10 Nov 2026** dengan alasan operasional:
di pameran, pemilik perlu melayani pelanggan tanpa bisa mencatat biaya/menutup bazar, sementara
penjaga booth hanya boleh mencatat transaksi.

| Butir perintah utama | Status |
| --- | --- |
| "tidak ada kasir kedua/ketiga" | **DIGANTI** — boleh ada peran kasir di perangkat yang sama |
| "Jangan menambah akun banyak pegawai … role bertingkat" | **DIGANTI** — boleh ada **2 peran** (admin & kasir) |
| "satu perangkat kasir aktif" | **TETAP** — masih satu perangkat, tanpa sinkronisasi antar-perangkat |
| Biaya operasional/bazar (tidak diatur di perintah utama) | **DITAMBAH** — dicatat sebagai pengeluaran bazar |
| Larangan lain (diskon persen, hapus permanen, billing, dll.) | **TETAP BERLAKU** |

Keputusan ini dicatat juga di `docs/PROJECT-BRIEF.md` dan catatan historis fase terkait.

---

## 1. Dua peran

| Peran | Boleh |
| --- | --- |
| **Admin** (pemilik) | Semua: buka/tutup bazar, atur barang bazar, catat & hapus biaya bazar, kelola katalog, pengaturan, ringkasan harian, ringkasan akhir bazar, hitung ulang sisa |
| **Kasir** | Mencatat transaksi pada **bazar aktif** saja, melihat stok bazar & katalog, memarkir transaksi. **Tidak** bisa mengubah katalog, biaya, atau menutup bazar |

### 1.1 Cara masuk (PIN lokal)

- PIN **4–6 angka** disimpan di perangkat (`settings.pinHash`, hash SHA-256 + salt).
- Tanpa PIN diatur: aplikasi terbuka dalam **mode kasir** (aman untuk penjaga booth).
- Ketuk **"Masuk sebagai Admin"** → masukkan PIN → mode admin sampai keluar / aplikasi ditutup.
- Admin dapat memilih **keluar ke mode kasir** kapan saja.
- PIN salah 5× → tunggu 30 detik. PIN tidak pernah ditulis ke log.

### 1.2 Saat bazar ditutup / tidak ada bazar

Kasir tetap bisa **melihat** katalog, tetapi tombol *Jual Barang* dinonaktifkan dengan
kalimat: **"Belum ada bazar aktif. Minta admin membuka bazar."**
Ini sesuai permintaan: kasir hanya mencatat transaksi **atas proyek aktif**.

> Penjualan dari stok gudang (tanpa bazar) hanya dapat dilakukan **admin**.

---

## 2. Proyek Bazar

Bazar menjadi **proyek** dengan data lengkap:

| Field | Aturan |
| --- | --- |
| Nama | wajib |
| Tanggal mulai / selesai | opsional |
| Lokasi | opsional |
| Catatan | opsional |
| Status | `aktif` · `selesai` |
| Biaya | daftar pengeluaran (bagian 3) |
| Ringkasan | omzet, biaya, laba, pcs, transaksi |

**Satu bazar aktif** pada satu waktu (tidak berubah).

---

## 3. Biaya bazar

Kategori tetap:

1. **Sewa booth**
2. **Transport**
3. **Konsumsi**
4. **Perlengkapan**
5. **Lainnya**

| Field | Aturan |
| --- | --- |
| Kategori | salah satu di atas |
| Judul | wajib, mis. "Sewa booth Blok C" |
| Nominal | integer Rupiah > 0 |
| Tanggal | wajib, bawaan hari ini |
| Catatan | opsional |

Aturan:

- Hanya **admin** yang dapat menambah/menghapus biaya.
- Biaya **tidak** memengaruhi total transaksi pelanggan — hanya perhitungan laba.
- Menghapus biaya meminta konfirmasi satu kali; penghapusan dicatat di ringkasan.
- Biaya tetap terlihat setelah bazar ditutup (untuk ringkasan akhir).

---

## 4. Hitung ulang sisa sebelum dikembalikan

Sebelum menutup bazar, admin menghitung **fisik** barang di meja bazar:

```
selisih = fisik_dihitung − sisa_tercatat
```

- `sisa_tercatat` = dibawa − terjual − ditarik (dari sistem).
- `fisik_dihitung` = angka yang diketik admin.
- Selisih **negatif** = barang kurang (hilang/salah catat).
- Selisih **positif** = barang lebih (mungkin terjual tanpa tercatat).

Pemilik memilih per barang apa yang dikembalikan ke gudang:

- **Kembalikan = fisik** (bawaan) → yang kembali ke gudang adalah angka fisik.
- Selisih dicatat pada `bazar_items.selisih` dan **ditampilkan** di layar penutupan,
  tidak disembunyikan.
- Bila selisih ≠ 0, layar menampilkan peringatan sebelum menutup:
  **"3 barang selisih. Periksa lagi sebelum menutup."**

Sisa yang tidak dikembalikan tetap dianggap habis (aturan Phase 3B).

---

## 5. Ringkasan

### 5.1 Ringkasan harian (admin)

Untuk hari yang dipilih (bawaan hari ini), pada bazar aktif atau terakhir:

| Angka | Arti |
| --- | --- |
| Transaksi | jumlah transaksi tidak dibatalkan |
| Omzet | Σ total transaksi hari itu |
| Terjual | jumlah pcs |
| Tunai / Transfer / QRIS | omzet per metode bayar |
| Biaya bazar hari itu | Σ biaya bertanggal hari itu |

### 5.2 Ringkasan total setelah bazar ditutup

| Angka | Arti |
| --- | --- |
| Omzet bazar | Σ total semua transaksi bazar itu |
| Biaya bazar | Σ semua biaya |
| **Laba bazar** | omzet − biaya |
| Terjual / dibawa | pcs |
| Sisa dikembalikan | pcs |
| Selisih stok | pcs (jika ada) |
| Rincian biaya | per kategori |

Laba dapat **negatif** dan harus ditampilkan apa adanya (tidak dibulatkan ke nol).

---

## 6. Hak akses ringkas

| Aksi | Kasir | Admin |
| --- | --- | --- |
| Jual barang (bazar aktif) | ✅ | ✅ |
| Parkir transaksi | ✅ | ✅ |
| Lihat katalog & stok bazar | ✅ | ✅ |
| Buka / tutup bazar | ❌ | ✅ |
| Alokasi barang ke bazar | ❌ | ✅ |
| Catat / hapus biaya bazar | ❌ | ✅ |
| Tambah/ubah/arsip barang | ❌ | ✅ |
| Pengaturan (PIN, rekening, logo) | ❌ | ✅ |
| Ringkasan harian & akhir | ❌ | ✅ |
| Hitung ulang sisa | ❌ | ✅ |

Kasir yang menekan fitur admin mendapat panel:
**"Fitur ini untuk admin. Ketuk 'Masuk sebagai Admin'."**

---

## 7. Fase

| Fase | Isi |
| --- | --- |
| **Phase 3C (baru)** | Role + PIN, bazar sebagai proyek (tanggal/lokasi), biaya bazar + kategori, hitung ulang sisa, ringkasan harian & akhir |
| Phase 4 | Pre-order, DP, ongkir menyusul, ringkasan umum |
| Phase 5 | Resi PDF |

## 8. Yang TIDAK berubah

- Satu perangkat, tanpa multi-cabang, tanpa langganan.
- Tanpa akun email/server; PIN murni lokal sehingga tetap bekerja offline.
- Larangan diskon persen, hapus permanen barang, billing, dan analitik pihak ketiga.
- Total transaksi pelanggan tidak pernah terpengaruh biaya bazar.
