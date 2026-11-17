# Catatan Diskusi & Keputusan — KAYESA'S CLOTHING

**Status berkas:** catatan berjalan (bukan catatan historis fase, bukan penawaran harga).
**Dibuat:** 12 November 2026 (Asia/Jakarta)
**Untuk:** Andri dan AI agent penerus
**Sifat:** hanya mencatat hasil diskusi. **Belum ada kode yang diubah, belum ada deploy,
belum ada keputusan fase berikutnya, dan belum ada penawaran harga.**

Sumber acuan: `Kronologi_Proyek_Aplikasi_Kasir_KAYESA’s.md` (handoff 12 Nov 2026) dan
tinjauan repo pada commit `8095458`.

---

## 1. Keputusan yang SUDAH disetujui Andri

| # | Topik | Keputusan | Tanggal |
| --- | --- | --- | --- |
| K-01 | Keluaran dokumen | **PNG sebagai keluaran utama, PDF sebagai cadangan** | 12 Nov 2026 |
| K-02 | Model dokumen pesanan jahit | **Satu dokumen dua wajah**: berjudul INVOICE saat masih ada tagihan; berubah menjadi RESI / BUKTI PEMBAYARAN saat sudah lunas | 12 Nov 2026 |
| K-03 | Perangkat sasaran | **iPhone, iPad, dan Android**. Tante: iPhone. Kemungkinan salah satu kasir memakai Android nanti | 12 Nov 2026 (revisi) |
| K-04 | Nama usaha | **KAYESA'S CLOTHING** nama lengkap/logo; **KAYESA** nama utama. **PERINTAH TEGAS (16 Nov 2026):** DUA nama ini SATU-SATUNYA yang dipakai untuk proyek ini. Ejaan lain WAJIB dihilangkan & tidak boleh dipakai atau dibuat baru oleh agent mana pun: "KAYESA'S CLOTHING", "KAYESA", "KAYESA", "KAYESA", "KAYESA". Tulis persis **KAYESA'S CLOTHING** dan **KAYESA** di semua dokumen/kode/mockup/materi | 12 Nov 2026 (dikunci tegas 16 Nov) |
| K-05 | URL situs | `kasir-KAYESA.pages.dev` **diganti setelah DP masuk** | 12 Nov 2026 |
| K-06 | Bukti kebutuhan PNG | Tante sudah memakai aplikasi di iPhone, lalu **screenshot resi** untuk dikirim. Ini bukti nyata kebutuhan gambar | 12 Nov 2026 |
| K-07 | Model bisnis | Aplikasi dijual **modular bertahap** (Tahap 1 s/d 6) sebagai satu aplikasi terintegrasi | 12 Nov 2026 |
| K-08 | Layanan pendamping | Aplikasi + **pendampingan awal 3–4x pertemuan** sampai Tante terbiasa. Peran **admin** (input data 1 per 1) ditawarkan **terpisah** nanti bila Tante terlihat kewalahan; digital marketing juga terpisah | 12 Nov 2026 |
| K-09 | Struktur penawaran | **Terpisah**: (1) paket aplikasi + pendampingan awal 3–4x pertemuan; (2) admin; (3) digital marketing — masing-masing ditawarkan sendiri | 12 Nov 2026 |
| K-10 | Uji iPhone | **PASS** — aplikasi diuji di iPhone Tante dan berfungsi baik. Risiko R1 Tahap 1 turun | 12 Nov 2026 |
| K-11 | Skema pembayaran | **DP di awal**, **pelunasan saat aplikasi siap pakai** | 12 Nov 2026 |
| K-12 | Uang transport pendampingan | Pendampingan **bisa dikondisikan**; Tante boleh memberi tambahan uang transport | 12 Nov 2026 |
| K-13 | Sapaan ke owner | **"Tante"** atau **"Tante Sita"** (bukan Shita) | 12 Nov 2026 |
| K-14 | **Harga paket Tahap 1** | **Rp 7.000.000** — aplikasi + pendampingan awal 3–4x pertemuan. Masih **usulan Andri**, belum disepakati Tante | 12 Nov 2026 |
| K-15 | **DP & pelunasan Tahap 1** | **DP Rp 2.000.000** saat mulai; **pelunasan Rp 5.000.000** saat aplikasi siap dipakai Tante (mengisi K-11 dengan angka) | 12 Nov 2026 |
| K-16 | **Urutan pengiriman penawaran** | Kirim **manfaat dulu (Versi A-0, tanpa angka)**; angka disampaikan **hanya bila Tante bertanya** | 12 Nov 2026 |
| K-17 | **Lembar kesepakatan** | Rancangan `docs/LEMBAR-KESEPAKATAN-TAHAP-1.md` dibuat. **Belum dikirim ke Tante.** Isian C-01 s/d C-09 menunggu keputusan Andri | 12 Nov 2026 |
| K-18 | **Posisi proyek ke Tante** | Dibingkai **"dibuat dari nol"**: sistem dirancang & dibuat khusus untuk KAYESA. Aplikasi lama hanya **bahan rujukan** (kebiasaan Tante, faktur lama), **bukan** dasar bangunan. Kalimat "melanjutkan/tidak membangun ulang" **dilarang** di semua materi ke Tante | 12 Nov 2026 |
| K-19 | **Scope Tahap 1 vs transkrip Tante** | Tetap **dokumen jahit dulu (Rp 7 juta)**. Stok & stock opname (yang disebut Tante sebagai "PR pertama") tetap di **tahap lanjut, tanpa angka**. Jangan janjikan stok masuk Tahap 1 | 13 Nov 2026 |
| K-20 | **Penawaran DITERIMA Tante** | Tawaran disetujui. **14 Nov 2026** | 14 Nov 2026 |
| K-21 | **Skema pembayaran final** | **DP Rp 2.000.000** saat mulai → **Rp 3.000.000** saat aplikasi siap trial → **Rp 2.000.000** pelunasan setelah selesai pendampingan 3–4x offline. **Total Rp 7.000.000** (menggantikan K-15 yang sebelumnya DP 2 + pelunasan 5). Tiga termin, bukan dua | 14 Nov 2026 |
| K-22 | **Arah teknis berikutnya** | Siapkan **roadmap & blueprint pengembangan** supaya pondasi kuat untuk menjadi **ERP kecil** di kemudian hari | 14 Nov 2026 |
| BU-01 | **Asas "satu model dokumen, banyak jenis"** | **DISETUJUI.** Setiap aliran uang & pergerakan barang adalah satu "dokumen" ber-`jenisDokumen` + ber-`arahStok`; barang, jasa, dan uang hanyalah baris dokumen berbeda sifat. Menyusul di M0: `jenis`→`jenisDokumen` (string union tertutup + versi, tambah `"jasa"`), tambah `arahStok` (`keluar`/`masuk`/`tidak_ada`), cadangkan kolom `pelangganId` (tanpa tabel sekarang). Tidak ada mikroservice/ORM/refactor besar; sumber kebenaran tetap di perangkat (offline-first) | 14 Nov 2026 |
| BU-02 | **Bentuk ledger minimal (`journal`)** | **DISETUJUI dengan catatan.** Sedikit keribetan di sisi pengembangan sekarang sengaja diterima, daripada harus merombak saat aplikasi sudah dipakai transaksi & pencatatan real. Catatan Andri: *"kalau ada cara yang lebih reliabel boleh disarankan"* — lihat Rincian BU-02 | 14 Nov 2026 |
| BU-03 | **M0 terpisah vs menyatu dgn Tahap 1** | **TERPISAH DULU (Opsi B).** Fondasi kuat & stabil dikerjakan tersendiri (murni skema/migrasi: `jenisDokumen` + `arahStok` + kerangka `journal`), baru Tahap 1 menumpuk di atasnya. Alasan Andri: *"lebih baik buat pondasi yang kuat dan stabil; ketika ada penambahan fungsi & fitur, dasarnya tidak perlu ada yang diubah."* Konsekuensi: M0 jadi milestone tersendiri; urutan commit & kenaikan `DB_VERSION` + `upgrade()` dikerjakan di M0 (risiko B-1) | 14 Nov 2026 |
| BU-04 | **Nama `jenisDokumen`: ID vs EN** | **BAHASA INDONESIA (Opsi A).** Dipakai `jenisDokumen` + `arahStok`, konsisten dengan nama domain kode lama (`jenis`, `statusBayar`, `namaPemesan`, `rekening`) yang sudah bulat bahasa Indonesia | 14 Nov 2026 |
| BU-05 | **Pemisahan uang usaha/pribadi** | **LABEL `pemilik` (Opsi A) → DIREVISI jadi DUA KOLOM `pemilik` + `sumber` (lihat BU-07).** Tiap catatan keuangan diberi `pemilik` (untuk keperluan siapa) + `sumber` (dari dompet mana), laporan tinggal filter. Tanpa akuntansi ganda; sederhana untuk Tante (>62 th) | 14 Nov 2026 (revisi) |
| BU-06 | **Kategori jurnal: tertutup vs bisa isi sendiri** | **KATEGORI DEKLARATIF + PILIHAN ISI SENDIRI.** Daftar awal tetap bawaan (penjualan, dp, pelunasan, biaya_bahan, upah, listrik, lain_lain); **ditambah opsi "isi sendiri"** supaya Tante bisa menambah kategori baru. Kategori yang pernah dibuat tersimpan & muncul sebagai pilihan berikutnya, memudahkan Tante mencatat transaksi sejenis tanpa mengetik ulang. Laporan & konsistensi tetap terjaga karena kategori tersimpan (tidak free-text setiap kali) | 14 Nov 2026 |
| BU-07 | **Skema `pemilik` vs `sumber`** | **DUA KOLOM `pemilik` + `sumber`.** `sumber` = dari dompet mana uang keluar/masuk (usaha/pribadi); `pemilik` = untuk keperluan siapa (usaha/pribadi). Menampung dua kebutuhan Tante: (1) mencatat sumber dana belanja (beli bahan pakai uang pribadi vs uang toko), (2) mencatat pemakaian uang usaha untuk keperluan pribadi. Jurnal otomatis (kasir/dokumen): `pemilik=usaha`+`sumber=usaha`, tak tampil & tak bisa diubah. Jurnal manual: Tante pilih keduanya, default `usaha` (untuk transaksi harian tak perlu sentuh). Tetap satu tabel, satu-arah, recompute | 14 Nov 2026 |
| BU-08 | **Aturan isi jurnal: apa yang dicatat & batas manual** | **A — Jurnal hanya mencatat uang yang BENAR-BENAR bergerak** (DP/pelunasan dicatat sebesar nominal diterima; piutang/sisa tagihan TIDAK masuk jurnal, itu urusan status dokumen). **B — Batas tegas:** penjualan/DP/pelunasan HANYA lewat kasir, TIDAK bisa dibuat manual; tombol manual hanya untuk pengeluaran/titipan/ambil pribadi. Menjamin "satu rupiah diterima = satu baris jurnal, tidak pernah dua". **Catatan Andri:** user manula terbiasa catat manual, perlu pengaman anti-dobel-input & pengingat jumlah cocok vs transaksi real — lihat BU-09 | 14 Nov 2026 |
| BU-09 | **Pengaman anti-dobel & pengingat akurasi (user manula)** | **A — "Tutup Kas Harian" NANTI di Tahap 4** (bandingkan saldo aplikasi vs uang fisik real). **B — "Deteksi dobel-input" + "peringatan nominal tak wajar" SEJAK AWAL di jurnal manual.** Deteksi dobel: cek nominal+kategori+tanggal sama → konfirmasi "sudah tercatat? (Ya/Tidak)", tidak memblokir. Peringatan wajar: nominal jauh di atas kebiasaan kategori → konfirmasi (cegah salah ketik digit). Prinsip: pengaman muncul HANYA saat patut curiga, tak menambah langkah wajib; tombol selalu Ya/Tidak | 14 Nov 2026 |
| BU-10 | **Pembagian peran & perangkat** | **Kasir dan pencatatan keuangan adalah DUA PERAN yang bisa BEDA ORANG & BEDA PERANGKAT.** Tante fokus pada **catatan pengeluaran & belanja** (jurnal manual); **kasir dipegang staff/karyawan** di perangkat berbeda. Kebutuhan ini menegaskan arah multi-user/role + sync dua arah (yang di blueprint roadmap disebut "Tahap 2") lebih awal dari skema "satu perangkat satu owner". Rancangan UI/UX harus memisahkan dua peran itu dan menjaga *simplicity* untuk Tante (yang hanya melihat bagian pengeluaran/belanja) | 14 Nov 2026 |
| BU-11 | **Urutan: role + sync dua arah ditarik maju, tapi TERSEMBUNYI** | **DISETUJUI.** Role + sync dua arah (semula "Tahap 2") **dibangun lebih awal dan bekerja di belakang layar** (Tante belum melihatnya). **Fitur/laporan lengkap baru di-unlock per tahap**, hanya setelah harga & termin pembayaran tiap tahap disepakati (sesuai model penjualan modular K-07). Prinsip: pondasi kuat dulu, fitur disiapkan tetapi **tidak ditampilkan** sampai tahapnya dibuka | 14 Nov 2026 |
| BU-12 | **Cakupan Tahap 1 yang dijanjikan (Rp 7jt)** | **DIKUNCI dari pesan ke Tante (11–14 Nov 2026).** Tahap 1 HANYA: (1) catat pesanan jahitan (nama pemesan, model/jenis, ukuran, biaya jasa, perkiraan selesai — jasa, tak kurangi stok); (2) catat uang masuk (DP & pelunasan bertahap + tanggal); (3) dokumen otomatis invoice→resi/bukti (K-02); (4) satu tombol bagikan gambar PNG ke WhatsApp (K-01); (5) invoice untuk menagih sopan. **TIDAK dijanjikan di Tahap 1:** stok, kasir staff multi-perangkat yang terlihat, laporan keuangan lengkap, buku kas, pencatatan pengeluaran/belanja. Pencatatan pengeluaran/belanja Tante (BU-07…BU-09) adalah bagian "keuangan" yang dibuka di tahap BERIKUTNYA | 14 Nov 2026 |
| BU-13 | **Struktur pesanan jahit** | **DISETUJUI — satu pesanan = satu dokumen + banyak baris pembayaran bertahap.** Satu pesanan = SATU dokumen ber-`jenisDokumen:"jasa"` + `arahStok:"tidak_ada"`; DP & pelunasan adalah **baris `payments`** di bawahnya (bukan dokumen terpisah), tiap baris payment otomatis menurunkan satu baris `journal` masuk (dp/pelunasan). Pesanan jadi satu kesatuan yang mudah dilacak "sudah bayar berapa" | 14 Nov 2026 |
| BU-14 | **Field wajib/opsional pesanan jahit** | **DISETUJUI.** Wajib: `namaPemesan`, `model/jenis` (kode model KC1/KC2), `biayaJasa`. Opsional: `kontak` (WA), `ukuran`, `perkiraanSelesai`, `catatan`. `biayaJasa` integer Rupiah sebagai sumber "total" dokumen; `kontak` boleh kosong (untuk tombol bagikan/tagih) | 14 Nov 2026 |
| BU-15 | **Struktur biaya: satu baris vs multi-baris** | **JANGAN DIKUNCI satu baris.** `biayaJasa` **tetap tampil** (biaya pokok), **dipisah** dengan **opsi "biaya lainnya"** yang bisa **ditulis manual & tersimpan** untuk transaksi berikutnya (konsisten dgn BU-06: kategori tersimpan, tidak mengetik ulang). Jadi ada biaya pokok jasa + biaya tambahan opsional yang reusable. Rincian penuh "jahit+bahan" tetap menyusul di tahap produksi/stok | 14 Nov 2026 |
| BU-16 | **Rekening di dokumen** | **SELALU TAMPIL** di semua dokumen (invoice & resi/bukti), konsisten dgn faktur lama Tante; Tante tak perlu memilih kapan muncul | 14 Nov 2026 |
| BU-17 | **Aturan sisa tagihan & judul otomatis** | **A — judul otomatis (K-02):** `sisa>0` → INVOICE/NOTA PESANAN, `sisa=0` → RESI/BUKTI PEMBAYARAN; `sisa = total − terbayar`. **Ditambah opsi cetak**: beri PILIHAN format cetak yang mana (fitur bisa dimatikan/disembunyikan setelah dapat feedback langsung dari Tante). **B — Boleh bayar LEBIH dari total** di sisi KASIR (terutama tunai → tampilkan nominal KEMBALIAN); namun sistem tetap **mencatat utuh sesuai pembayaran/pelunasan penuh** (tidak memotong). **C — Void diperbolehkan** dengan **alasan jelas yang tercatat**; riwayat transaksi **harus terlihat di sisi kasir** | 14 Nov 2026 |
| BU-18 | **Pintu pemasukan = SATU (antar-muka kasir)** | **DISETUJUI & DIKUNCI.** Pintu uang masuk hanya SATU: antar-muka kasir. Semua DP/cicilan/pelunasan pesanan jahit **dibayar lewat kasir** (bukan form pesanan terpisah). Kasir punya dua alur: (1) jual barang/langsung, (2) terima pembayaran pesanan jahit — keduanya boleh bayar lebih + tampil KEMBALIAN (sesuai BU-17.B "b"), dan KEMBALIAN berlaku di kedua alur. Implikasi: pemasukan TIDAK bisa dicatat manual — konsisten dengan batas BU-08.B | 14 Nov 2026 |
| BU-19 | **Penomoran dokumen (`NO:`)** | **PENDING — belum terkonfirmasi dari Tante.** Informasi sementara: Tante memakai **`KC` sebagai kode WAJIB di invoice**. Usulan nomor tampil `INV-yyyymmdd-ℓℓℓ` + `id` UUID internal (untuk sync) belum diputuskan; tunggu konfirmasi Tante. | 14 Nov 2026 (pending) |
| BU-20 | **Status dokumen** | **DISETUJUI — tiga status:** `terbuka` (belum lunas), `lunas` (sisa=0), `batal` (void + alasan, tetap terlihat di riwayat). Daftar dipisah: "belum lunas" vs "riwayat" (status lunas/batal) | 14 Nov 2026 |
| BU-21 | **Arti kode `KC`** | **`KC` = KODE INVOICE/NOTA yang dikeluarkan Tante**, contoh dugaan `KC-20261011` (kode usaha + tanggal). Ini adalah CADANGAN SKEMA NOMOR DOKUMEN (beririsan dengan BU-19), BUKAN kode model produk (KC1/KC2) dan BUKAN elemen kop statis. **Masih HIPOTESIS** — Andri belum dapat contoh nota yang sudah terisi; format final menunggu contoh nota asli dari Tante. Terkait: `model/jenis` di BU-14 tetap field bebas, tak terkait awalan `KC` | 14 Nov 2026 (hipotesis, menunggu contoh nota) |
| BU-22 | **Alur input pesanan** | **A — SETUJU: input pesanan pakai langkah berurutan (wizard)**, satu pertanyaan per layar (bukan satu form panjang). **B — DIPERLUAS: kasir JUGA boleh membuat/mencatat pesanan** (bukan hanya terima uang), antisipasi kasir terima pesanan di bazar/toko lain; penyesuaian mungkin setelah aplikasi jadi. **C — SEMENTARA setuju** urutan pemesan→detail jahitan→biaya→simpan; **perlu konfirmasi ulang**. Catatan: A & B disiapkan draft WA untuk Tante; harga parts (kain/payet/jasa) siapa yang input → parkir | 15 Nov 2026 |
| BU-23 | **Alur pembayaran di kasir** | **A — SETUJU: catat metode** (tunai default / transfer BCA). **B — SETUJU: satu penerimaan = satu baris `payments`** (nominal bebas: DP/cicilan/lunas/lebih). **C — SETUJU** alur: pilih pesanan belum lunas → masukkan nominal diterima → hitung otomatis (sisa/kembalian) → simpan + bagikan dokumen | 15 Nov 2026 
| BU-24 | **Dua tombol/alur kasir** | **SETUJU — kasir punya DUA alur besar:** **"Pesanan"** (jasa: pesan jahitan, permak gaun, dll → `jenisDokumen:"jasa"`, tak kurangi stok) dan **"Penjualan"** (jual barang jadi hasil produksi → `jenisDokumen:"penjualan"`, kurangi stok). Ini dua arah stok dari asas BU-01. Catatan: "Penjualan" = tahap STOK (Tahap 3), di Tahap 1 tombolnya BELUM di-unlock (sesuai BU-11 tersembunyi & BU-12) | 15 Nov 2026 |
| BU-25 | **Susunan dokumen PNG** | **B-04 (ejaan) — SETUJU:** nama besar **"KAYESA"**, logo tetap "KAYESA'S CLOTHING" (gambar, dibiarkan), jangan campur ejaan di teks badan. **B-05 (kotak) — SEMENTARA setuju:** kop/kaki ikut faktur lama dulu (kotak PERHATIAN!!! + Hormat Kami + rekening), bisa diubah kemudian. **KOREKSI pemahaman:** ukuran font & tema yang "bisa disesuaikan" itu untuk **UI APLIKASI** (Andri janjikan Tante bisa atur besar huruf), BUKAN dokumen. **Ukuran font & layout NOTA/dokumen = FIX (tetap, satu template pasti)**, tidak mengikuti pengaturan font aplikasi | 15 Nov 2026 |
| BU-26 | **Tombol "Bagikan" dokumen** | **A/B/C — SETUJU.** (A) "Bagikan" memakai share sheet native (langsung pilih WhatsApp, tanpa screenshot manual). (B) ada tombol kedua "Simpan ke Foto" untuk arsip galeri. (C) invoice yang dibagikan dipakai juga untuk menagih sopan (menampilkan SISA). Catatan: PDF cadangan BELUM dihapus (K-01: PNG utama, PDF tetap untuk arsip/cetak) | 15 Nov 2026 |
| BU-27 | **Riwayat pengiriman dokumen** | **WAJIB — Tante harus bisa tahu SIAPA saja pelanggan yang SUDAH dikirimi pengingat tagihan / resi.** Jadi perlu log/riwayat "dokumen apa dikirim ke siapa, kapan". Ini kebutuhan pelacakan baru (mendukung CRM Tahap 6 & kebiasaan Tante tak lupa menagih). Detail struktur log dibahas di bagian berikutnya | 15 Nov 2026 |
| BU-28 | **Struktur riwayat pengiriman & `pelangganId`** | **A — SETUJU: tanam `pelangganId` dari sekarang** (bukan baru Tahap 6), supaya saat CRM di-acc & dibayar tinggal "buka" (meringankan kerja, selaras BU-01 & BU-11). **B — OPSI 2 (final):** log `pengiriman` menunjuk `pelangganId` + `dokumenId`; entitas tipis `pelanggan {id, nama, kontak}` dibuat OTOMATIS saat pesanan dibuat (tanpa beban input Tante); log tercatat otomatis saat tombol Bagikan. **C — SETUJU:** tanda "✓ sudah/belum dikirim" per baris di daftar pesanan. Struktur lengkap di Rincian BU-28 | 15 Nov 2026 |
| BU-29 | **Tampilan daftar pesanan** | **DISETUJUI.** Dua tab besar **"Belum Lunas"** dan **"Riwayat"**. Tab **"Belum Lunas" terbuka pertama**. Pesanan tampil sebagai **kartu besar** berisi nama pemesan, jenis jahitan, sisa pembayaran, dan status dokumen yang pernah dibagikan. **Ketuk kartu untuk membuka detail pesanan.** Tab **"Riwayat"** menampilkan pesanan **lunas/batal** dengan label status. Tampilan dibuat sederhana agar Tante cukup melihat dan mengetuk tanpa bingung. | 15 Nov 2026 |
| BU-30 | **Pengingat tagihan** | **OPSI A — DISETUJUI (16 Nov 2026).** Daftar "perlu ditagih" (pesanan belum lunas yang perkiraan selesainya lewat) tanpa notifikasi otomatis dulu. Notifikasi/reminder otomatis (Opsi B) bisa menyusul setelah feedback | 16 Nov 2026 |
| BU-31 | **Penyimpanan data & sinkronisasi (Sheet vs lokal)** | **DISETUJUI (16 Nov 2026).** Data transaksi TETAP offline-first di perangkat (IndexedDB + salinan D1), BUKAN Google Sheet. Google Sheet hanya dipakai sebagai alat **impor stok awal (batch, sekali)** via template/CSV, saat tahap stok (Tahap 3). Sifat online: bila jaringan memadai, Tante tetap bisa akses data online; kasir bisa kirim transaksi tersimpan di device ke jurnal online. Perangkat tetap otoritatif, sync dua arah (BU-11, tersembunyi) | 16 Nov 2026 |
| BU-32 | **Pengaturan ukuran font & tema UI (aktivasi sekarang)** | **DISETUJUI (16 Nov 2026).** Tante bisa atur SENDIRI ukuran huruf & warna tema di dalam aplikasi (menu Pengaturan), sesuai janji ke Tante (transkrip 14 Nov) & parkir P-03. BATAS TEGAS (BU-25): pengaturan ini HANYA untuk UI/UX aplikasi; ukuran font & layout NOTA/DOKUMEN tetap FIX, tidak mengikuti setelan ini. Simplicity: kontrol besar & mudah, default ramah manula | 16 Nov 2026 |

### Rincian BU-02 — cara lebih reliabel (double-entry lite)

Andri membuka pintu: *"kalau ada cara yang lebih reliabel boleh disarankan."* Bentuk `journal`
satu-arah (section 5.2 blueprint) sudah cukup dan tetap disepakati; di bawah ini saran agar lebih
reliabel **tanpa jadi akuntansi penuh** (jangan over-engineer untuk Tante):

- **Satu jurnal = dua baris pasangan (debit/kredit lite).** Bukan satu baris `arah masuk | keluar`,
  melainkan dua baris berpasangan lewat `jurnalId` yang sama: mis. "penjualan tunai" = baris
  *Kas masuk Rp X* + baris *Pendapatan Rp X*. Keuntungannya: **saldo tiap buku selalu 0 bila
  dijumlahkan** (debit = kredit), jadi salah catat/salah hitung langsung ketahuan otomatis.
- **`nominal` selalu bertanda** (masuk positif, keluar negatif) atau dibedakan kolom `debit`/`kredit`
  — pilih satu konvensi, jangan campur.
- **Jurnal tetap turunan (recompute) dari dokumen** — sumber kebenaran tidak berubah. Dua baris itu
  dibangkitkan otomatis dari dokumen, batal/gugur otomatis saat dokumen dibatalkan.
- **Kategori dibuat deklaratif** (daftar kategori usaha Tante), bukan bebas ketik, supaya laporan
  konsisten dan Tante (>62 th) tinggal pilih.
- **Status _pending vs posted_** (tahap 4) berguna untuk jurnal manual (pengeluaran) yang baru sah
  setelah dicek — ini nanti, bukan M0.

> Kesimpulan: saran ini **memperkuat** BU-02 (tetap bagian 5), tidak mengubah arah. Bila Andri
> mau versi *double-entry lite* ini dipakai, tandai sebagai BU-02 (revisi) di diskusi lanjut.

**Keputusan final BU-02 (14 Nov 2026):** Andri **tetap memakai `journal` satu-arah** (seperti
blueprint bagian 5.2). Saran *double-entry lite* **tidak diambil** — prioritas *simplicity* bagi
pengguna, dengan hasil tetap akurat (akurasi dijaga lewat asas *jurnal = turunan/recompute dari
dokumen*, yang sudah melekat di BU-02 sejak awal).

### Rincian BU-28 — opsi struktur log pengiriman yang lebih baik

Andri minta saran opsi terbaik untuk log "siapa sudah dikirimi". Dua pilihan:

**Opsi 1 — log menempel ke dokumen (paling ringan).** Tabel `pengiriman` berisi baris per event,
menunjuk `dokumenId`. Kelebihan: simpel, mudah dilacak per pesanan. Kekurangan: kalau satu
pelanggan punya banyak pesanan, riwayat "pelanggan ini sudah dikirimi apa saja" harus ditarik
lewat gabungan beberapa dokumen.

**Opsi 2 (DISARANKAN) — log menunjuk ke `pelangganId` (entitas pelanggan ditanam dini).**
Sesuai BU-28.A (tanam `pelangganId` sekarang), log `pengiriman` menyimpan `pelangganId` (atau
`dokumenId` + `pelangganId`). Karena pelanggan jadi entitas sejak awal, nanti Tante bisa buka
satu **tampilan per pelanggan**: nama, semua pesanannya + "kiriman terakhir invoice tgl X /
reminder tgl Y". Ini persis kebutuhan CRM Tahap 6 — dan karena ditanam sekarang, Tahap 6 tinggal
"dibuka", bukan dibangun ulang.

> Rekomendasi: **Opsi 2.** Struktur minimal:
> `pelanggan { id, nama, kontak }` (entitas tipis, dibuat otomatis saat pesanan dibuat) +
> `pengiriman { id, dokumenId, pelangganId, waktu, jenis (invoice/resi), tujuan }`.
> Ini tidak menambah beban input Tante — `pelanggan` terbentuk otomatis dari form pesanan
> (BU-22), dan log tercatat otomatis saat tombol Bagikan ditekan.

### Rincian K-01 — PNG utama, PDF cadangan
- Tante membagikan **gambar PNG** lewat share sheet iOS → WhatsApp. Satu ketuk, tanpa aplikasi lain.
- PNG bisa disimpan ke aplikasi **Foto** dan ditunjukkan langsung dari galeri.
- PDF **tetap ada** untuk arsip dan cetak rapi; bukan lagi tombol utama.
- Susunan isi PNG dan PDF berasal dari **satu sumber yang sama**, agar tidak ada dua kebenaran.

### Rincian K-02 — satu dokumen dua wajah

- Satu jenis transaksi baru untuk **pesanan jahit**; **tidak mengurangi stok** (jasa, bukan barang).
- Judul dokumen mengikuti status pembayaran:
  - masih ada sisa tagihan → **INVOICE / NOTA PESANAN** (menampilkan total, DP, sisa)
  - sudah lunas → **RESI / BUKTI PEMBAYARAN** (tanpa baris sisa)
- Tante hanya perlu **satu tombol Bagikan**; judul menyesuaikan sendiri.

### Rincian K-03 — dampak iPhone/iPad (temuan tinjauan kode)

Temuan pada commit `8095458`, **belum diperbaiki** (menunggu instruksi):

| Temuan | Dampak |
| --- | --- |
| Tombol "Simpan PDF" memakai `a.download` | **Tidak berfungsi di iOS Safari**. Hanya tombol **Bagikan** yang andal. |
| Pesan "PDF disimpan di folder Unduhan" | **Menyesatkan** di iOS: iPhone/iPad tidak punya folder Unduhan seperti Android. |
| `docs/PANDUAN-PEMILIK.md` bagian 1 | Ditulis untuk **Android/Chrome** ("titik tiga", "folder Unduhan"). Langkah iOS berbeda: **Safari → tombol Bagikan → Tambahkan ke Layar Utama**. |
| Manifest PWA | Sudah `display: standalone` + `apple-touch-icon` ada → **fondasi iOS sudah benar** |
| Uji iPad/iPhone | **Belum pernah dilakukan**; PDF, share sheet, penyimpanan lokal, dan mode offline belum terbukti di iOS |

---

## 2. Yang sudah dibahas tetapi BELUM diputuskan

| # | Pertanyaan | Pilihan yang diajukan | Status |
| --- | --- | --- | --- |
| B-01 | Field pesanan jahit | biaya jasa, kode model (KC1/KC2), ukuran, perkiraan selesai | belum diputuskan |
| B-02 | Apakah jasa jahit boleh punya beberapa baris (mis. jahit + bahan) | satu baris biaya jasa vs rincian | belum diputuskan |
| B-03 | Rekening di semua dokumen atau hanya bila ada sisa | ikut faktur lama (selalu) vs perilaku aplikasi sekarang (bila ada sisa) | belum diputuskan |
| B-04 | Ejaan di dokumen | faktur lama menulis "KAYESA" dan logo "KAYESA'S CLOTHING" | usul: seragam **KAYESA'S CLOTHING** |
| B-05 | Kotak "PERHATIAN!!!" dan "Hormat Kami" | ikut faktur lama | belum diputuskan |
| B-06 | Printer thermal | merek/model belum diketahui | belum diputuskan |
| B-07 | Nama tampilan aplikasi | masih "KAYESA" di dalam kode | belum diputuskan |

---

## 3. Bahan acuan yang sudah diterima

### 3.1 Contoh faktur lama (foto) — format nota kosong pre-print

| Bagian | Isi |
| --- | --- |
| Kop | Logo KC, tulisan **KAYESA**, alamat **Jl. Tarumanegara No. 41** (Sebelah Pempak Nyai), **Ploso Ciptum 15419** |
| Kontak | WA **0812 1141 4017** dan WA **0821 1376 5892** |
| Kepala | **NO:**, **TANGGAL**, **KEPADA YTH.** |
| Isi | **BANYAKNYA · NAMA BARANG · HARGA · Jumlah** |
| Kaki | **TOTAL RP.** |
| Penutup | **REK BCA 676 017 885 (NARSHITA DEWI)**, kotak **PERHATIAN!!!**, **Hormat Kami,** |

Catatan: faktur ini adalah **nota penjualan**, bukan nota jahit khusus. **Tidak ada kolom DP/sisa** —
itu tambahan yang dibicarakan Tante dan belum ada di kertas lama.

### 3.2 Logo usaha

Gambar logo KC (hitam-putih, cincin teks "KAYESA'S CLOTHING") sudah diterima.
Rencana pemakaian: **diunggah Tante sendiri melalui menu Pengaturan**, bukan disimpan di repo.

---

## 4. Batasan yang tetap berlaku

- **Jangan mulai Phase 1** sampai Andri memberi instruksi.
- **Jangan mengubah kode, dokumen historis, atau deploy** tanpa permintaan jelas.
- Catatan historis `docs/project-history/` bersifat **immutable** (tidak boleh ditimpa).
- **Tanpa R2, tanpa billing, tanpa kartu, tanpa langganan.** Semua prosesor gambar/PDF
  berjalan di perangkat.
- **Harga Tahap 1 sudah diusulkan: Rp 7.000.000** (DP Rp 2.000.000, pelunasan
  Rp 5.000.000) — lihat K-14 & K-15. Statusnya **usulan**, bukan kesepakatan.
  Angka Rp4–5 juta dan 75 juta lama adalah estimasi percakapan, sudah tidak dipakai.
  Tahap 2 dan 3 belum dihitung.
- Nama butik yang benar: **KAYESA'S CLOTHING**. Ejaan lama "KAYESA"/"KAYESA" hanya ada di kode/dokumen lama.
- **PRINSIP DESAIN (ditegaskan Andri, 14 Nov 2026):** *simplicity itu wajib untuk UI/UX* — bukan
  preferensi, melainkan syarat. Kita (pengembang) wajib memikirkan & merancang supaya simplicity
  untuk user tercapai. Setiap keputusan UI/UX harus diuji: "apakah Tante (>62 th) cukup melihat
  & mengetuk, tanpa bingung memilih/berpikir?"

---

## 5. Langkah berikutnya (menunggu Andri)

1. ~~Kirim penawaran ke Tante~~ **SELESAI** — tawaran **DITERIMA** (K-20), skema bayar final
   tiga termin (K-21): DP Rp 2jt → Rp 3jt saat siap trial → Rp 2jt pelunasan pasca pendampingan.
2. ~~Diskusi blueprint pondasi ERP kecil~~ **SELESAI** — kelima keputusan BU-01 … BU-05 sudah
   diputuskan dan dicatat (lihat tabel bagian 1).
3. ~~Keputusan arsitektur dibahas satu per satu~~ **SELESAI** — tiap keputusan tercatat sebagai
   `BU-xx` di berkas ini dan statusnya sudah "diputuskan" di blueprint.
4. **Menunggu Andri:** perintah untuk mulai mengerjakan **M0** (fondasi: `jenisDokumen` +
   `arahStok` + kerangka `journal`), terpisah dulu dari Tahap 1 (BU-03).
5. Fase berikutnya / pengerjaan kode **hanya** dimulai atas permintaan Andri.

---

## 5b. Parkir / dibahas kemudian (parking lot)

Tempat Andri menitipkan hal yang terlintas di tengah diskusi, supaya tidak hilang dan dibahas
kemudian. Dicatat apa adanya, belum diputuskan.

| # | Catatan Andri | Status |
| --- | --- | --- |
| P-01 | **Siapa yang input harga parts** (kain, payet, jasa, dll)? Perlu dikonfirmasi ulang. Terkait BU-15 (biaya lain) & BU-22 | menunggu |
| P-02 | **BU-22.A & BU-22.B** (wizard input + siapa yang input pesanan) → draft WA disiapkan, **menunggu balasan Tante (±1–2 hari)**. BU-22 ditandai on-hold sampai balasan masuk | menunggu balasan Tante |
| P-03 | **Pengaturan ukuran font & tema APLIKASI** (yang Andri janjikan Tante bisa atur sendiri) — bagian UI, belum dirancang detailnya. Catatan: ini TIDAK memengaruhi ukuran font nota/dokumen (BU-25: dokumen fix) | menunggu (Tahap 1, detail UI) |
| P-04 | **Klarifikasi K-23…K-26 (SELESAI audit 16 Nov).** Audit (HASIL_AUDIT.md) menyimpulkan: **K-23, K-24, K-25 TIDAK ADA** — tabel K di CATATAN berhenti di K-22; kemungkinan nomor lompat/bukan keputusan riil. **K-26 = alias BU-16** (rekening selalu tampil; BCA 676 017 885 a.n. NARSHITA DEWI). **Kandidat mockup terbaru = v10** (nota/resi), bukan v8/v9; bazar v4 tetap disetujui-bekukan. **Konflik merek:** mockup lama menulis KAYESA (salah); kunci final = **KAYESA** (lihat K-04) | selesai (klarifikasi) |

---

## 6. Jembatan antar-sesi (dibuat 14 Nov 2026)

Diskusi blueprint **dipindah ke sesi baru** (model **DeepSeek-Pro**), atas permintaan Andri,
supaya konteksnya bersih. Agent sesi baru wajib membaca urut:

1. `docs/BLUEPRINT-ARP-KECIL.md` — blueprint + daftar keputusan BU-01 … BU-05.
2. `docs/CATATAN-DISKUSI.md` (berkas ini) — keputusan K-01 … K-22.

Lalu lanjut membahas BU-01 … BU-05 **satu per satu** (jangan menumpuk), dan mencatat tiap
keputusan sebagai `BU-xx` di sini + mengisi status "menunggu → diputuskan" di blueprint.

**Teks prompt pembuka untuk disalin ke sesi baru:**

> Bahas keputusan arsitektur blueprint ERP kecil satu per satu, mulai dari BU-01.
> Baca dulu `git/docs/BLUEPRINT-ARP-KECIL.md` dan `git/docs/CATATAN-DISKUSI.md`.
> Jangan mulai ngoding; jangan tanya ulang keputusan yang sudah ada (K-xx).
> Setiap keputusan Andri, catat sebagai `BU-xx` di CATATAN-DISKUSI.md dan isi statusnya di blueprint.