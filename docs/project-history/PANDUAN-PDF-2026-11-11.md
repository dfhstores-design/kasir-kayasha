# Panduan Pemilik — versi PDF

- **Tanggal:** 11 November 2026 (Asia/Jakarta)
- **Berkas:** [`docs/PANDUAN-PEMILIK.pdf`](PANDUAN-PEMILIK.pdf) — 3 halaman, ±22 KB, A4
- **Sumber:** [`docs/PANDUAN-PEMILIK.md`](PANDUAN-PEMILIK.md)
- **Pembuat:** `scripts/buat-panduan-pdf.mjs` (`npm run panduan:pdf`)

---

## Untuk siapa

**Ibu**, pemilik butik, usia di atas 62 tahun. Karena itu PDF dirancang untuk dibaca di kertas
atau di HP:

- huruf 11 pt, jarak baris lega
- nomor bagian besar dan berwarna jelas
- kotak "Penting" untuk peringatan
- tabel "Bila ada masalah" dua kolom
- footer nomor halaman

## Isi

11 bagian, sama persis dengan versi Markdown:

1. Memasang aplikasi di HP · **alamat aplikasi kini tercantum** (`https://kasir-kayesha.pages.dev`)
2. Mengisi data butik · 3. Menambah barang · 4. Membuka bazar · 5. Menjual barang
6. Pre-order · 7. Menutup bazar · 8. Melihat untung
9. **Membuat cadangan (SANGAT PENTING)** · 10. Bila ada masalah · 11. Hal yang perlu diketahui

## Dua perbaikan isi yang ikut dilakukan

| # | Sebelum | Sesudah |
| --- | --- | --- |
| 1 | Bagian 11 berbunyi "Data disimpan di HP ini saja. Tidak ada di internet (**selama Phase 6 belum dikerjakan**)" | Diperbarui: data di HP, dan bila ada internet dikirim sebagai **salinan** ke server; HP tetap utama; cadangan berkas tetap wajib |
| 2 | Bagian 1: "Buka tautan aplikasi yang diberikan" | Ditambah alamat yang bisa **diketik langsung** di Chrome |

Tanpa perbaikan ini, panduan yang dicetak akan memberi informasi yang **salah**.

## Cara membuat ulang

```powershell
npm run panduan:pdf
```

Ubah `docs/PANDUAN-PEMILIK.md`, jalankan perintah di atas, PDF menyesuaikan otomatis.

## Catatan teknis

- Memakai **pdf-lib** yang sudah menjadi dependensi aplikasi — tanpa layanan tambahan.
- A4, margin 56 pt, font Helvetica/HelveticaBold (font standar PDF, tidak perlu diunduh).
- Font standar hanya mendukung **WinAnsi**, sehingga `→ − – ’ “ ” • …` diganti padanan ASCII
  (`->`, `-`, `'`, dst.) agar tidak ada teks yang hilang.
- Parser Markdown menangani: judul, paragraf, daftar bernomor dan bersarang,
  **lanjutan butir daftar**, kutipan (kotak), tabel, dan pemisah.

## Verifikasi yang dijalankan

| Uji | Hasil |
| --- | --- |
| PDF dibuat | ✅ 3 halaman, 21,8 KB |
| Render tiap halaman ke PNG lalu **diperiksa secara visual** | ✅ 3 halaman diperiksa |
| Teks lengkap (bandingkan dengan sumber) | ✅ **5.444** karakter PDF vs **5.462** karakter sumber |
| 11 judul bagian | ✅ semua ADA |
| Alamat aplikasi | ✅ ADA |
| Skrip dapat dijalankan ulang | ✅ |
| `npm run lint` · `npm run typecheck` | ✅ 0 · 0 |

## Bug yang ditemukan saat membuat PDF

| # | Bug | Perbaikan |
| --- | --- | --- |
| 1 | Butir daftar yang berlanjut ke baris berikutnya **terpisah** dan tercetak di atas daftar (butir 6 bagian 2) | Parser mengenali baris lanjutan menjorok dan menyambungkannya ke butir sebelumnya |
| 2 | Kalimat penutup tercetak **dua kali** | Skrip tidak lagi menambahkan kalimat yang sudah ada di sumber |
| 3 | `WinAnsi cannot encode "→"` — pembuatan gagal total | Peta pengganti karakter sebelum digambar |

## Langkah berikutnya

- Cetak PDF dan letakkan di dekat meja kasir saat pameran.
- Kirim PDF-nya ke WhatsApp Ibu sehingga bisa dibuka di HP kapan saja.
- Bila isi panduan berubah, jalankan `npm run panduan:pdf` agar PDF tidak tertinggal.
