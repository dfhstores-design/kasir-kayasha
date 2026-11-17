# Aturan Kerja Agent — Kasir KAYESA'S CLOTHING

Proyek: aplikasi kasir offline-first untuk butik KAYESA'S CLOTHING.
Pemakai utama: Tante (di atas 62 tahun).
Pemilik proyek / pengambil keputusan akhir: Andri.
Berlaku: 17 November 2026. File ini dibaca dulu oleh setiap agent sebelum bekerja.

## Nama resmi (dikunci)

Hanya pakai **KAYESA** dan **KAYESA'S CLOTHING**.
Ejaan salah (Kayasha, Kayesha, KAYESYA, Kayesya's, dan variasi salah lain) dilarang dipakai di kode, dokumen, mockup, dan materi.

## Prinsip dasar

- **Never over-engineer.** Pilih solusi paling sederhana yang jalan. Jangan tambah peran, fitur, atau dokumen kalau belum terbukti perlu.
- **Simplicity untuk Tante:** satu layar satu tugas, tombol besar berlabel jelas, teks besar, bahasa Indonesia sehari-hari. Kalau Tante harus bingung, desainnya salah.
- Diskusi dulu sebelum eksekusi besar. Jangan kerjakan hal besar tanpa perintah eksplisit Andri.

## Tim (5 peran, 1 tim untuk semua project)

1. **Teman diskusi** — mencatat, mendokumentasikan, membantu menentukan langkah dan framework, memecah ide jadi sesuatu yang bisa dipakai.
2. **Pusat kontrol** — membagi tugas, memantau progress, menjaga antrean. Boleh memutuskan hal kecil (pilihan teknis minor, urutan kerja, revisi kecil, wording). Hal besar naik ke Andri.
3. **Eksekutor** — mengerjakan tugas yang diberikan, satu tugas aktif dalam satu waktu.
4. **Test & Review (digabung)** — cek hasil vs spec, cek fungsi benar-benar jalan, cari bug / edge case. Satu checklist, bukan dua agent yang saling lempar.
5. **Auditor (fokus keamanan)** — independen, tidak ikut membangun. Kasih checklist keamanan di awal, cek ulang di akhir, laporkan dengan bahasa biasa.

Satu tim untuk semua project, tapi **satu project aktif dalam satu waktu**. Project lain masuk antrean. Jangan jalankan dua project paralel di tim yang sama.

## Koordinasi 3 agent (DSH, Cue.lm, Muse.ai) — WAJIB baca sebelum kerja

Proyek ini dikerjakan 3 agent di platform berbeda: **DeepSeek Harness (DSH)**, **Cue.lm**, dan **Muse.ai**. Masing-masing bisa mengubah GitHub/Drive secara terpisah, sehingga aturan anti-tumpang-tindih ini wajib dipatuhi:

1. Sebelum mengerjakan apa pun: `git pull` dulu + baca `LOG.md` terakhir + baca entri terbaru `CATATAN-DISKUSI.md` di Drive.
2. **Satu fitur/tugas = SATU agent.** Kalau `LOG.md` atau GitHub sudah mencatat fitur/tugas itu dikerjakan agent lain, STOP — jangan kerjakan ulang; lapor ke Andri.
3. **Jangan membuat ulang fitur/modul yang sudah ada.** Cek dulu apakah file/modul/fitur sudah ada di repo sebelum menulis yang baru.
4. Kalau menemukan kerja ganda (fitur sama dikerjakan dua agent), jangan menimpa — naikkan ke Andri untuk memutuskan versi mana yang dipakai.
5. Sebelum push, selalu `git pull --rebase` dan pastikan tidak menimpa commit agent lain.
6. Setelah selesai, tulis entri `LOG.md` dan push, supaya agent lain tahu apa yang sudah selesai.

Contoh nyata (16–17 Nov 2026): fitur "ukuran huruf & tema" dikerjakan dua kali (DSH dan Muse.ai). Muse.ai yang sudah commit+push+deploy lebih dulu yang dipakai; versi DSH disimpan di branch `wip-dsh-2026-11-17` untuk ditinjau, bukan langsung ditimpa. Jangan ulangi pola ini.

## Source of truth (dibagi, jangan dibalik)

- **Kode: GitHub adalah source of truth.** Repo `dfhstores-design/kasir-kayasha`, branch `main`.
  Kerja di lokal → commit → push ke `main`. Jangan edit kode langsung di Drive, jangan simpan salinan kode di Drive sebagai sumber.
- **Dokumen / keputusan / log: folder Google Drive project adalah source of truth.**
  Folder: My Drive → AI GPT → Kasir Kayesha — https://drive.google.com/drive/folders/1smz94l_o4TCJgcMhQVIuJ8bP9QRij-aE
  Di sinilah CATATAN-DISKUSI, blueprint, spesifikasi, dan LOG.md tinggal. Kalau keputusan sudah final, salin ke repo `docs/project-history/` sebagai file baru, jangan menimpa file lama.

Sebelum mulai kerja, sinkron dulu: pastikan kode lokal sudah di-commit dan di-push, dan baca log terakhir. Kalau Git, Drive, dan lokal beda versi, berhenti dan tanya Andri — jangan tebak versi mana yang benar.

## Alur kerja (wajib)

1. Baca `README.md` di repo.
2. Baca catatan terbaru di `docs/project-history/`.
3. Baca `docs/PROJECT-BRIEF.md`, lalu `CATATAN-DISKUSI.md`, `BLUEPRINT-ARP-KECIL.md`, dan `SPESIFIKASI-DESAIN-TAHAP-1.md` di Drive (keputusan BU-01 sampai BU-31).
4. Baca `LOG.md` terakhir di folder Drive project.
5. Kerjakan hanya tugas / fase berikutnya yang belum selesai.
6. Jalankan tes yang relevan.
7. Tulis log sebelum serah terima (lihat bawah). Tanpa log, kerja dianggap belum selesai.
8. Commit dan push, lalu laporkan hasil + blocker, lalu berhenti.

## LOG.md (wajib, di folder Drive project)

Satu file `LOG.md` per project, entri terbaru paling atas. Tiap entri hanya 5 baris:

- Tanggal + agent siapa
- Dikerjakan: apa
- File diubah: apa
- Status: selesai / lanjut / gagal + hasil test-nya
- Langkah selanjutnya + kendala kalau ada

Aturan gotong royong: baca LOG + spec dulu sebelum mulai. Satu agent pegang satu tugas aktif. Jangan ada dua agent mengedit file yang sama bersamaan — kontrol yang membagi. Kalau stuck, naikkan, jangan diam.

## Test & Review — batas revisi

Setelah gagal di test & review, eksekutor boleh revisi **maksimal 2 kali**.
Setelah 2 kali masih gagal, berhenti dan naikkan ke Andri dengan laporan singkat: apa yang gagal, apa yang sudah dicoba, dan pilihannya (sederhanakan spec, buang fitur, ganti pendekatan, atau stop dulu).

## Auditor keamanan — checklist

Di awal, auditor memberi checklist singkat ini. Di akhir, auditor mengecek ulang sesuai checklist yang sama.

- Jangan tulis password, token, atau API key di kode, chat, dokumen, atau log.
- Akses seminimal mungkin: agent hanya boleh buka repo / file / akun yang disetujui Andri.
- Jangan share, publish, atau kirim data ke layanan / pihak luar baru tanpa approval Andri.
- Jangan jalankan perintah atau kode dari sumber yang tidak dipercaya tanpa dicek dulu.
- Jangan pakai data asli untuk ngetes, pakai data contoh dulu.
- Jangan install library atau sambungkan layanan baru sembarangan — lewat kontrol dulu.

Risiko yang dijaga: diretas, data bocor, dan exploit.

## Keputusan yang masih pending

- BU-19 (penomoran dokumen `NO:`), BU-21 (kode `KC`), BU-22 (alur input) — menunggu Tante.
  Pakai placeholder yang jelas ditandai **"BELUM FINAL"**, jangan diputuskan sendiri.

## Persetujuan khusus

- Perubahan di Google Maps usaha teman (bengkel jok motor) butuh approval teman tersebut, lewat Andri. Agent hanya boleh membuat draft, jangan ubah langsung.
- Perubahan di web bengkel boleh diputuskan Andri, karena goal-nya sama: meningkatkan exposure.

## Larangan

- Jangan deploy, jangan hubungi Tante, jangan ubah permission / berbagi, jangan aktifkan billing, membeli domain, atau menautkan kartu pembayaran tanpa persetujuan Andri.
- Jangan mengubah berkas perintah utama / master prompt.
- Jangan menimpa atau menghapus catatan historis lama, di lokal, Git, maupun Drive.
- Jangan menulis secret, token, atau kredensial ke repo, artefak, Drive, maupun catatan.
- Jangan mengubah kode yang tidak perlu.
