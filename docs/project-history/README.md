# Aturan Catatan Historis Proyek

Folder ini adalah **sumber wajib** dokumentasi serah-terima proyek Kasir Kayasha.
Setiap fase meninggalkan satu catatan baru yang cukup dibaca agent lain tanpa perlu percakapan sebelumnya.

## Nama berkas

```
PHASE-<nomor dua digit>-<YYYY-MM-DD>-<HHMM>.md
```

Contoh: `PHASE-03-2026-11-12-2035.md`

- Waktu memakai **waktu lokal Asia/Jakarta** (WIB).
- Jika dua catatan dibuat pada menit yang sama, tambahkan nomor urut: `...-2035-2.md`.
- Catatan lama **tidak boleh** ditimpa, dihapus, atau diganti nama.
- Jangan memakai satu berkas yang terus ditimpa sebagai satu-satunya dokumentasi.
- Catatan awal (bila bukan kegiatan fase), misalnya penetapan workspace, memakai nomor `00`
  dan keterangan di judulnya.

## Isi wajib setiap catatan

1. **Fase** dan **tanggal/waktu lokal** pembuatan.
2. **Tujuan** fase.
3. **Pekerjaan yang selesai** — hanya yang benar-benar dikerjakan.
4. **File yang dibuat / diubah** — daftar path.
5. **Keputusan dan alasannya.**
6. **Perintah penting** yang dijalankan (tanpa secret).
7. **Hasil tes yang benar-benar dijalankan** — jangan mengaku lulus bila tidak dijalankan.
8. **Masalah yang belum beres / ditunda.**
9. **Cara melanjutkan** untuk agent berikutnya.
10. **Tugas aman berikutnya.**

## Larangan

- Jangan menulis secret, token, kredensial, atau data pelanggan nyata.
- Jangan menyalin nomor rekening atau data pribadi ke catatan; cukup sebut "diisi lewat Pengaturan".
- Jangan menyalin isi log yang memuat data transaksi.

## Salinan Google Drive

- Lokasi: Google Drive → `AI GPT/Kasir Kayasha/project-history/`.
- Salin catatan baru **sebagai berkas baru** dengan nama yang sama; jangan mengganti berkas lama.
- Jika Drive tidak tersedia, dokumentasi lokal tetap wajib; sebutkan di catatan bahwa salinan
  Drive belum dibuat.

## Daftar catatan

| Tanggal | Berkas | Ringkasan |
| --- | --- | --- |
| 2026-11-10 12:35 | [PHASE-00-2026-11-10-1235.md](PHASE-00-2026-11-10-1235.md) | Phase 0 — audit repo, penetapan workspace lokal + repo + Drive, brief proyek, kuota resmi |
| 2026-11-10 13:05 | [PHASE-01-2026-11-10-1305.md](PHASE-01-2026-11-10-1305.md) | Phase 1 — 5 alur pengguna, spesifikasi visual (kontras terukur), 14 layar + wireframe |
| 2026-11-10 13:45 | [PHASE-01B-2026-11-10-1345.md](PHASE-01B-2026-11-10-1345.md) | Phase 1B — bazar & stok, parkir maks 3, jenis/status transaksi, resi thermal 58/80 mm (+3 layar → 17) |
| 2026-11-10 13:50 | [PHASE-01C-2026-11-10-1350.md](PHASE-01C-2026-11-10-1350.md) | Phase 1C — PDF sebagai output resi, sapaan otomatis dari jam, ongkir 0/nominal/belum ditentukan |

> **Catatan urutan rilis:** commit Phase 0 yang dipush ke GitHub (10 Nov 12:26 WIB) masih memuat
> tabel di atas tanpa baris PHASE-01; baris tersebut ditambahkan pada commit Phase 1. Isi catatan
> PHASE-00 sendiri tidak diubah.
