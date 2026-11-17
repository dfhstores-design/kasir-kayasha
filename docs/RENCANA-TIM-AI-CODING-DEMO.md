# Rencana Tim AI — Coding Aplikasi (Demo Produk)

**Status:** spesifikasi pembentukan tim + scope coding demo. **Belum ada kode yang diubah.**
**Dibuat:** 16 November 2026 (Asia/Jakarta)

Tujuan: membentuk **tim AI** untuk mengerjakan aplikasi (coding) di belakang layar, dan **berhenti
ketika aplikasi bisa di-tes untuk demo produk** dengan lingkup: alur kerja kasir, alur kerja Tante,
sampai cetak resi & nota.

---

## 1. Scope demo (batas yang harus dicapai)

Demo harus bisa memakai 3 alur end-to-end:

1. **Alur kerja kasir** — buka kasir → dua tombol "Pesanan" / "Penjualan" (Penjualan di-unlock tahap stok, jadi untuk demo: pesanan + terima pembayaran). Terima DP/cicilan/pelunasan, hitung sisa & kembalian.
2. **Alur kerja Tante** — buat pesanan jahit (wizard), lihat daftar "Belum Lunas"/"Riwayat", lihat "perlu ditagih".
3. **Cetak resi & nota** — dokumen PNG (utama) + PDF (cadangan): invoice (sisa>0) vs resi/bukti (lunas), tombol Bagikan (share sheet) + Simpan ke Foto.

**BATAS tegas:** KODE HANYA, tidak deploy, tidak hubungi Tante, tidak ubah permission/berbagi.
Berhenti tepat ketika demo bisa dijalankan & ditest.

---

## 2. Keputusan yang wajib dipatuhi tim (sudah terkunci)

- Seluruh **BU-01 … BU-31** di `CATATAN-DISKUSI.md` + `SPESIFIKASI-DESAIN-TAHAP-1.md`.
- **Nama resmi:** KAYESA / KAYESA'S CLOTHING (jangan pakai ejaan lain).
- **Simplcity UI wajib.** Keuangan: jurnal turunan, `pemilik`+`sumber`, kategori deklaratif + isi sendiri.
- **M0 dulu (terpisah):** `jenisDokumen` + `arahStok` + kerangka `journal`, naik `DB_VERSION` + `upgrade()` (risiko B-1).
- **Jangan sentuh** file `project-history/*` dan jangan ubah kode yang tidak perlu.

---

## 3. Keputusan pending → pakai PLACEHOLDER (jelas "belum final")

| Keputusan | Placeholder saat coding | Catatan |
|---|---|---|
| BU-19 (penomoran `NO:`) | `KC.1-YYYYMMDD` (atau `INV-...`) | label "BELUM FINAL" di UI/generator; final menunggu Tante |
| BU-21 (kode `KC`) | sama seperti atas | hipotesis `KC-[nomor]-[tanggal]` |
| BU-22 (alur input) | wizard sesuai BU-22.A/B | sudah disepakati sebagian; sisanya placeholder |

Semua placeholder HARUS dikomentari/ditandai agar mudah diganti saat keputusan final masuk.

---

## 4. Struktur tim yang disarankan (untuk dipecah ke sub-agent)

Tim AI sebaiknya dipecah per peran agar tidak saling menimpa (koordinasi lewat berkas saja):

1. **Agent Fondasi (M0)** — migrasi `schema.ts`/`schema.sql`: `jenisDokumen`, `arahStok`, kerangka `journal`, `DB_VERSION` + `upgrade()`.
2. **Agent Logika Murni** — `lib/`: hitung `sisa = total - terbayar`, kembalian, snapshot, kategori, fungsi dokumen (PNG/PDF).
3. **Agent UI Kasir** — layar kasir + dua tombol + terima pembayaran.
4. **Agent UI Tante** — wizard pesanan + daftar (Belum Lunas/Riwayat) + perlu-ditagih.
5. **Agent Dokumen** — generator PNG (utama) + PDF (cadangan), share sheet + simpan ke foto.
6. **Agent Integrasi & Tes Demo** — merangkai semua, menjalankan ketiga alur end-to-end, laporkan hasil & blocker.

Aturan koordinasi: satu agent pegang satu area file; pantau `git status`; jangan saling menimpa; catat
progres di `docs/project-history/` (dengan nama baru, bukan menimpa).

---

## 5. Prompt untuk agent koordinator (salin ke sesi coding)

> Kamu adalah koordinator tim AI yang membangun aplikasi Kasir KAYESA'S CLOTHING untuk demo produk.
> Baca dulu urut & penuh: `BLUEPRINT-ARP-KECIL.md`, `CATATAN-DISKUSI.md`, `SPESIFIKASI-DESAIN-TAHAP-1.md`.
> Patuhi SEMUA keputusan BU-01…BU-31 di sana. M0 dikerjakan tersendiri dulu (BU-03).
> Untuk keputusan pending (BU-19/21/22), pakai placeholder yang JELAS ditandai "BELUM FINAL".
> Kerjakan coding DI BELAKANG LAYAR, pecah ke sub-agent per area (lihat struktur tim di atas).
> BERHENTI tepat ketika aplikasi bisa di-tes untuk demo 3 alur: kasir, Tante, cetak resi/nota.
> Jangan deploy, jangan hubungi Tante, jangan ubah permission. Lapor hasil + blocker ke Andri.

---

## 6. Penanda berhenti (definition of done)

- [ ] M0 selesai: skema `jenisDokumen` + `arahStok` + `journal` + migrasi `DB_VERSION`.
- [ ] Alur kasir jalan: buat/terima pembayaran, sisa & kembalian benar.
- [ ] Alur Tante jalan: wizard pesanan + daftar "Belum Lunas"/"Riwayat" + "perlu ditagih".
- [ ] Dokumen: PNG invoice/resi + PDF cadangan + tombol Bagikan & Simpan ke Foto.
- [ ] Semua nilai pending ditandai "BELUM FINAL".
- [ ] Demo 3 alur bisa dijalankan & ditest end-to-end.

Begitu semua checklist terpenuhi → **berhenti**, laporkan ke Andri (tidak lanjut deploy/demo ke Tante).