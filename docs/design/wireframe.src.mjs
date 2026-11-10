/*
 * Kasir Kayasha — data wireframe Phase 1
 *
 * Sumber kebenaran tata letak untuk wireframe interaktif. Dijalankan oleh
 * docs/design/tools/build-wireframe.mjs untuk menghasilkan artifacts/PHASE-01/wireframe.html.
 * Isi mengikuti docs/design/screens/*.md dan docs/design/UI-SPEC.md.
 *
 * Ditulis sebagai HTML kecil (bukan kerangka UI sungguhan) agar tidak bisa disalahartikan
 * sebagai aplikasi jadi. Tidak ada logika, penyimpanan, atau perhitungan di berkas ini.
 */

const appbar = (title, back = "‹ Kembali") =>
  `<div class="appbar"><span class="back">${back}</span><span>${title}</span></div>`;

export const SCREENS = [
  {
    no: "01",
    title: "Beranda",
    body: `
<div class="content">
  <div>
    <p class="h1" style="font-size:26px">Kasir Kayasha</p>
    <p class="muted" style="margin:2px 0 0">Kayasha Clothing</p>
  </div>
  <div class="okbox">Ayo isi nama butik dulu. <u>Isi Pengaturan</u></div>
  <div class="big">
    <button class="btn primary hero">Jual Barang</button>
    <button class="btn ghost">Pesanan</button>
    <button class="btn ghost">Barang</button>
    <button class="btn ghost">Ringkasan</button>
    <button class="btn ghost">Pengaturan</button>
  </div>
</div>
<div class="bottom">
  <div class="status"><span class="dot"></span> Tersimpan di perangkat · 12 transaksi hari ini</div>
</div>`,
  },

  {
    no: "02",
    title: "Pilih Barang",
    body: `
${appbar("Pilih Barang")}
<div class="content">
  <div class="input">🔍 Cari nama barang</div>
  <div class="grid2">
    <div class="card">
      <div class="thumb sq">foto blus</div>
      <div class="prodname">Blus Linen Lengan Panjang</div>
      <div class="price">Rp 180.000</div>
      <div class="muted" style="font-size:15px">Stok 4</div>
      <button class="btn primary small" style="width:100%;margin-top:8px">+ Tambah</button>
    </div>
    <div class="card">
      <div class="thumb sq">foto rok</div>
      <div class="prodname">Rok Plisket</div>
      <div class="price">Rp 220.000</div>
      <div class="muted" style="font-size:15px">Stok habis</div>
      <button class="btn primary small" style="width:100%;margin-top:8px" disabled>+ Tambah</button>
    </div>
    <div class="card">
      <div class="thumb sq">foto gamis</div>
      <div class="prodname">Gamis Abu</div>
      <div class="price">Rp 450.000</div>
      <div class="muted" style="font-size:15px">Stok 1</div>
      <button class="btn primary small" style="width:100%;margin-top:8px">+ Tambah</button>
    </div>
    <div class="card">
      <div class="thumb sq">tanpa foto</div>
      <div class="prodname">Kain Batik</div>
      <div class="price">Rp 150.000</div>
      <div class="muted" style="font-size:15px">Stok 6</div>
      <button class="btn primary small" style="width:100%;margin-top:8px">+ Tambah</button>
    </div>
  </div>
</div>
<div class="bottom">
  <div class="listrow"><span><b>Keranjang</b> · 2 barang</span><span class="chev money">Rp 400.000 ›</span></div>
</div>`,
  },

  {
    no: "03",
    title: "Detail Barang",
    body: `
${appbar("Detail Barang")}
<div class="content">
  <div class="thumb sq" style="font-size:15px">foto besar barang</div>
  <div class="center muted" style="font-size:14px">● ○ ○</div>
  <div>
    <p class="h2">Blus Linen Lengan Panjang</p>
    <p class="h1" style="margin:4px 0">Rp 180.000</p>
    <p class="muted" style="margin:0">Stok 4</p>
    <p class="muted" style="margin:4px 0 0">Bahan linen, warna krem</p>
  </div>
  <div>
    <span class="label">Jumlah</span>
    <div class="qty"><div class="step">−</div><div class="step num">1</div><div class="step">+</div></div>
    <p class="muted" style="font-size:15px;margin:6px 0 0">Stok tersisa 4.</p>
  </div>
</div>
<div class="bottom">
  <button class="btn primary">Tambah ke Keranjang</button>
</div>`,
  },

  {
    no: "04",
    title: "Keranjang",
    body: `
${appbar("Keranjang")}
<div class="content">
  <div class="card">
    <div class="row"><b>Blus Linen</b><span class="money">Rp 360.000</span></div>
    <div class="muted" style="font-size:15px">2 × Rp 180.000</div>
    <div class="qty" style="margin-top:8px">
      <div class="step">−</div><div class="step num">2</div><div class="step">+</div>
      <span class="muted" style="margin-left:auto"><u>Hapus</u></span>
    </div>
    <div style="margin-top:10px">
      <span class="label">Diskon per buah</span>
      <div class="input">Rp 10.000</div>
      <p class="muted" style="font-size:15px;margin:4px 0 0">− Rp 20.000</p>
    </div>
  </div>
  <div class="card">
    <div class="row"><b>Rok Plisket</b><span class="money">Rp 220.000</span></div>
    <div class="muted" style="font-size:15px">1 × Rp 220.000</div>
    <div class="qty" style="margin-top:8px">
      <div class="step">−</div><div class="step num">1</div><div class="step">+</div>
      <span class="muted" style="margin-left:auto"><u>Hapus</u></span>
    </div>
    <div style="margin-top:10px">
      <span class="label">Diskon per buah</span>
      <div class="input">Rp 0</div>
    </div>
  </div>
  <div class="card">
    <div class="row"><span>Subtotal</span><span class="money">Rp 580.000</span></div>
    <div class="row"><span>Diskon barang</span><span class="money">− Rp 20.000</span></div>
    <div class="hr"></div>
    <div class="row"><span>Setelah diskon</span><span class="money">Rp 560.000</span></div>
    <div style="margin-top:10px">
      <span class="label">Diskon total</span>
      <div class="input">Rp 0</div>
    </div>
  </div>
  <div class="card">
    <span class="label">Metode bayar</span>
    <div class="chips"><span class="chip ok">Tunai</span><span class="chip">Transfer</span><span class="chip">QRIS</span></div>
  </div>
</div>
<div class="bottom">
  <div class="row"><span class="h2">TOTAL</span><span class="total" style="font-size:28px">Rp 560.000</span></div>
  <button class="btn primary">Simpan Transaksi</button>
</div>`,
  },

  {
    no: "05",
    title: "Transaksi Tersimpan",
    body: `
<div class="content center">
  <div class="check">✓</div>
  <p class="h1">Transaksi tersimpan</p>
  <p class="muted" style="margin:0">Nomor <b>KYS-0012</b></p>
  <p class="muted" style="margin:0">Blus Linen, Rok Plisket</p>
  <p class="total" style="margin:14px 0 0">Rp 560.000</p>
  <div class="status" style="justify-content:center;margin-top:10px"><span class="dot"></span> Tersimpan di perangkat</div>
</div>
<div class="bottom">
  <button class="btn primary">Buat Resi</button>
  <button class="btn ghost">Transaksi Baru</button>
</div>`,
  },

  {
    no: "06",
    title: "Resi (pratinjau PDF)",
    body: `
${appbar("Resi KYS-0012")}
<div class="content">
  <div class="receipt">
    <div class="logobox"></div>
    <div class="center"><b>KAYASHA CLOTHING</b><br /><span class="muted" style="font-size:13px">Pameran, Jakarta</span></div>
    <div class="hr"></div>
    <div class="row"><span>Nomor</span><span>KYS-0012</span></div>
    <div class="row"><span>Tanggal</span><span>10 Nov 2026, 14:20</span></div>
    <div class="hr"></div>
    <div><b>Blus Linen</b></div>
    <div class="row"><span>2 × Rp 180.000</span><span>Rp 360.000</span></div>
    <div class="row muted"><span>Diskon @ Rp 10.000</span><span>− Rp 20.000</span></div>
    <div style="margin-top:6px"><b>Rok Plisket</b></div>
    <div class="row"><span>1 × Rp 220.000</span><span>Rp 220.000</span></div>
    <div class="hr"></div>
    <div class="row"><span>Subtotal</span><span>Rp 580.000</span></div>
    <div class="row"><span>Diskon barang</span><span>− Rp 20.000</span></div>
    <div class="row"><span>Diskon total</span><span>− Rp 0</span></div>
    <div class="hr"></div>
    <div class="row"><b>TOTAL</b><b>Rp 560.000</b></div>
    <div class="hr"></div>
    <div class="row"><span>Pembayaran</span><span>Tunai</span></div>
    <div class="center muted" style="font-size:13px;margin-top:8px">Terima kasih, sampai jumpa!</div>
  </div>
</div>
<div class="bottom">
  <button class="btn primary">Bagikan</button>
  <button class="btn ghost small">Simpan PDF</button>
</div>`,
  },

  {
    no: "07",
    title: "Pesanan (Pre-order)",
    body: `
${appbar("Pesanan")}
<div class="content">
  <button class="btn primary small">+ Pesanan Baru</button>
  <div class="input">🔍 Cari nama pemesan</div>
  <div class="muted" style="font-weight:700;margin-top:4px">Siap diambil atau dikirim (1)</div>
  <div class="listrow">
    <div style="flex:1">
      <b>KYS-PO-0003 · Ibu Sari</b>
      <div class="muted" style="font-size:15px">10 Nov · Sisa Rp 550.000</div>
      <div class="chips" style="margin-top:6px"><span class="chip warn">Siap</span></div>
    </div>
    <span class="chev">›</span>
  </div>
  <div class="muted" style="font-weight:700;margin-top:4px">Diproses (2)</div>
  <div class="listrow">
    <div style="flex:1">
      <b>KYS-PO-0002 · Ibu Dewi</b>
      <div class="muted" style="font-size:15px">9 Nov · Sisa Rp 200.000</div>
      <div class="chips" style="margin-top:6px"><span class="chip">Diproses</span><span class="chip ok">DP</span></div>
    </div>
    <span class="chev">›</span>
  </div>
  <div class="listrow">
    <div style="flex:1">
      <b>KYS-PO-0001 · Bu Rina</b>
      <div class="muted" style="font-size:15px">8 Nov · Lunas, menunggu diambil</div>
      <div class="chips" style="margin-top:6px"><span class="chip">Diproses</span><span class="chip ok">Lunas</span></div>
    </div>
    <span class="chev">›</span>
  </div>
  <div class="listrow"><span class="muted">Selesai (12)</span><span class="chev">▾</span></div>
</div>`,
  },

  {
    no: "08",
    title: "Detail Pesanan & Pembayaran",
    body: `
${appbar("Pesanan KYS-PO-0003")}
<div class="content">
  <div>
    <p class="h1">Ibu Sari</p>
    <p class="muted" style="margin:2px 0">0812-xxxx-xxxx · WhatsApp</p>
    <div class="chips"><span class="chip">Diproses</span><span class="chip warn">PRE-ORDER</span></div>
    <p class="muted" style="font-size:15px;margin:8px 0 0">Siap ± 20 Nov 2026</p>
  </div>
  <div class="card">
    <div class="row"><span>Gamis Abu · 1 × Rp 450.000</span><span class="money">Rp 450.000</span></div>
    <div class="row"><span>Kebaya · 1 × Rp 400.000</span><span class="money">Rp 400.000</span></div>
    <div class="hr"></div>
    <div class="row muted" style="font-size:15px"><span>Ongkir dibayar pembeli ke kurir</span><span>Tidak masuk tagihan butik</span></div>
  </div>
  <div class="warnbox">
    <div class="row"><span>Total pesanan</span><span class="money">Rp 850.000</span></div>
    <div class="row"><span>Sudah dibayar</span><span class="money">Rp 300.000</span></div>
    <div class="hr"></div>
    <div class="row"><b>SISA TAGIHAN</b><span class="money" style="font-size:22px">Rp 550.000</span></div>
  </div>
  <div class="card">
    <span class="label">Riwayat pembayaran</span>
    <div class="row"><span>10 Nov · DP · Transfer</span><span class="money">Rp 300.000</span></div>
  </div>
</div>
<div class="bottom">
  <button class="btn primary">Catat Pembayaran</button>
  <div class="grid2">
    <button class="btn ghost small">Lihat Resi</button>
    <button class="btn ghost small">Ubah Status</button>
  </div>
</div>`,
  },

  {
    no: "09",
    title: "Daftar Barang (Admin)",
    body: `
${appbar("Barang")}
<div class="content">
  <button class="btn primary small">+ Tambah Barang</button>
  <div class="input">🔍 Cari nama barang</div>
  <div class="listrow">
    <div class="thumb thumblist">foto</div>
    <div style="flex:1"><b>Blus Linen</b><div class="muted" style="font-size:15px">Rp 180.000 · Stok 4 · Aktif</div></div>
    <span class="chev">›</span>
  </div>
  <div class="listrow">
    <div class="thumb thumblist">foto</div>
    <div style="flex:1"><b>Rok Plisket</b><div class="muted" style="font-size:15px">Rp 220.000 · Stok habis · Aktif</div></div>
    <span class="chev">›</span>
  </div>
  <div class="listrow">
    <div class="thumb thumblist">foto</div>
    <div style="flex:1"><b>Gamis Lama</b><div class="muted" style="font-size:15px">Rp 300.000 · Stok 1 · Diarsipkan</div></div>
    <span class="chev">›</span>
  </div>
  <div class="listrow"><span class="muted">Tampilkan barang diarsipkan</span><span style="font-size:20px">☐</span></div>
</div>`,
  },

  {
    no: "10",
    title: "Form Barang",
    body: `
${appbar("Barang Baru")}
<div class="content">
  <div><span class="label">Nama barang</span><div class="input">Blus Linen Lengan Panjang</div></div>
  <div><span class="label">Harga jual</span><div class="input">Rp 180.000</div></div>
  <div><span class="label">Stok siap jual</span><div class="input">4</div></div>
  <div>
    <span class="label">Foto (1 dari 3)</span>
    <div class="grid3">
      <div class="thumb sq" style="font-size:13px">foto</div>
      <div class="thumb sq" style="font-size:26px">+</div>
      <div class="thumb sq" style="font-size:26px">+</div>
    </div>
    <div class="grid2" style="margin-top:10px">
      <button class="btn ghost small">Ambil Foto</button>
      <button class="btn ghost small">Pilih Galeri</button>
    </div>
  </div>
  <div class="listrow"><span>Isian tidak wajib (kode, catatan)</span><span class="chev">▸</span></div>
</div>
<div class="bottom">
  <button class="btn primary">Simpan Barang</button>
</div>`,
  },

  {
    no: "11",
    title: "Pengaturan",
    body: `
${appbar("Pengaturan")}
<div class="content">
  <div class="navitem">Nama & kontak butik <span>›</span></div>
  <div class="navitem">Logo resi <span>›</span></div>
  <div class="navitem">Rekening tujuan <span>›</span></div>
  <div class="navitem">Teks penutup resi <span>›</span></div>
  <div class="navitem">Lihat contoh resi <span>›</span></div>
  <div class="navitem">Kunci menu (PIN) <span>›</span></div>
  <div class="navitem">Cadangan & pemulihan <span>›</span></div>
  <p class="muted" style="font-size:15px;margin:8px 0 0">Kasir Kayasha · Tersimpan di perangkat ini</p>
</div>`,
  },

  {
    no: "12",
    title: "Ringkasan Hari Ini",
    body: `
${appbar("Ringkasan")}
<div class="content">
  <p class="h2">Hari ini, 10 November 2026</p>
  <div class="card"><span class="label">Transaksi</span><div class="total">12</div></div>
  <div class="card"><span class="label">Penjualan (setelah diskon)</span><div class="total" style="font-size:28px">Rp 3.240.000</div></div>
  <div class="card"><span class="label">Uang yang diterima</span><div class="total" style="font-size:28px">Rp 3.050.000</div><div class="muted" style="font-size:15px">Termasuk DP pesanan</div></div>
  <div class="card"><span class="label">Sisa pembayaran pesanan</span><div class="total" style="font-size:28px">Rp 950.000</div></div>
  <div class="hr"></div>
  <div class="listrow"><span>Transaksi hari ini</span><span class="chev">›</span></div>
  <div class="listrow"><span>Status simpan & cadangan</span><span class="chev">›</span></div>
</div>`,
  },

  {
    no: "13",
    title: "Riwayat Transaksi",
    body: `
${appbar("Transaksi")}
<div class="content">
  <div class="input">🔍 Cari nomor atau nama barang</div>
  <div class="chips"><span class="chip ok">Hari ini</span><span class="chip">7 hari</span><span class="chip">Semua</span></div>
  <p class="muted" style="margin:6px 0 0;font-weight:700">10 November 2026</p>
  <div class="listrow">
    <div style="flex:1"><b>KYS-0012</b> <span class="muted" style="font-size:15px">14:20</span>
      <div class="muted" style="font-size:15px">Tunai · Rp 560.000</div></div>
    <span class="chip ok">Lunas</span>
  </div>
  <div class="listrow">
    <div style="flex:1"><b>KYS-0011</b> <span class="muted" style="font-size:15px">13:05</span>
      <div class="muted" style="font-size:15px">Tunai · Rp 180.000</div></div>
    <span class="chip ok">Lunas</span>
  </div>
  <div class="listrow">
    <div style="flex:1"><b class="strike">KYS-0010</b> <span class="muted" style="font-size:15px">11:40</span>
      <div class="muted" style="font-size:15px">Rp 0 · dibatalkan</div></div>
    <span class="chip off">Dibatalkan</span>
  </div>
</div>`,
  },

  {
    no: "14",
    title: "Status Simpan & Backup",
    body: `
${appbar("Simpan & Cadangan")}
<div class="content">
  <div class="warnbox">
    <div class="row"><b>● Tersimpan di perangkat</b></div>
    <p style="margin:6px 0 0">Ada 3 perubahan menunggu dikirim ke internet.</p>
    <p style="margin:6px 0 0;font-size:15px">Terakhir tersinkron: 10 Nov 2026, 13:58</p>
    <button class="btn ghost small" style="width:100%;margin-top:10px">Coba Lagi</button>
  </div>
  <span class="label">Cadangan di HP ini</span>
  <div class="navitem">Simpan cadangan (JSON) <span>›</span></div>
  <div class="navitem">Simpan daftar transaksi (CSV) <span>›</span></div>
  <div class="navitem">Pulihkan dari cadangan <span>›</span></div>
  <div class="card">
    <span class="label">Data tersimpan seperti apa?</span>
    <p class="muted" style="margin:0;font-size:15px">Aplikasi ini bekerja tanpa internet. Semua transaksi disimpan di HP ini lebih dulu. Bila internet tersedia, salinan dikirim ke cloud secara otomatis.</p>
  </div>
</div>`,
  },
];

export const DEVICE_VIEWS = [{ id: "hp", label: "HP kecil · 360 × 740 px" }];
