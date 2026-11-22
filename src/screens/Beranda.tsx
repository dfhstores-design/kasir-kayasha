import { useEffect, useState } from "react";
import StatusSinkron from "../components/StatusSinkron.tsx";
import { daftarParkir, daftarProduk, profilTerisi, type ProdukRecord } from "../db/repositori.ts";
import type { SettingsRecord } from "../db/schema.ts";
import type { BazarRecord } from "../db/schema.ts";
import { bolehAdmin, bolehJualBarang, bolehLaporanOwner, labelLokasiKasir, type LokasiKasir, type Peran } from "../lib/peran.ts";
import type { Layar } from "../App.tsx";

interface Props {
  settings: SettingsRecord | null;
  storagePermanen: boolean | null;
  /** Bazar yang sedang aktif (null = penjualan memakai stok gudang). */
  bazar: BazarRecord | null;
  /** Jumlah bazar aktif (boleh lebih dari satu). */
  jumlahBazarAktif: number;
  /**
   * True selama pemuatan awal (seed + bazar) belum selesai. Selama ini
   * Beranda TIDAK boleh menyimpulkan "belum ada bazar" — itu quirk
   * first-load 17 Nov 2026: banner salah sebelum seed selesai dimuat.
   */
  memuatAwal: boolean;
  /** Peran aktif: kasir dibatasi pada transaksi bazar aktif saja. */
  peran: Peran;
  /** Lokasi kasir yang sedang aktif di perangkat ini (Fase 2A, BU-34). */
  lokasiKasir: LokasiKasir | null;
  onMintaAdmin: () => void;
  onKeluarAdmin: () => void;
  /** Membuka Biaya Bazar; App yang menyertakan objek bazar aktif. */
  onBiayaBazar: () => void;
  /** Layar tanpa parameter saja; layar yang butuh objek dibuat di App. */
  buka: (nama: Exclude<Layar["nama"], "biaya-bazar" | "detail-barang" | "form-barang" | "alokasi-bazar" | "tutup-bazar" | "tersimpan">) => void;
}

/**
 * Beranda — docs/design/screens/01-beranda.md.
 * Menu kasir: Penjualan, Pesanan Jahit, Masuk Admin, Masuk Owner,
 * Masuk Kasir. Admin tambah Barang, Ringkasan, Pengaturan, dan bagian
 * Mini ERP (admin-only). Owner tambah bagian Laporan Owner (admin TIDAK
 * boleh membuka laporan keuangan, BU-32). Panel bazar dan status simpan.
 * Tidak ada menu tersembunyi.
 */
export default function Beranda({ settings, storagePermanen, bazar, jumlahBazarAktif, memuatAwal, peran, lokasiKasir, onMintaAdmin, onKeluarAdmin, onBiayaBazar, buka }: Props) {
  const [jumlahBarang, setJumlahBarang] = useState<number | null>(null);
  const [parkir, setParkir] = useState(0);
  /** Notifikasi tombol placeholder Mini ERP (belum ada fungsi; admin-only). */
  const [pesan, setPesan] = useState<string | null>(null);

  useEffect(() => {
    daftarProduk()
      .then((p: ProdukRecord[]) => setJumlahBarang(p.length))
      .catch(() => setJumlahBarang(null));
    daftarParkir()
      .then((p) => setParkir(p.length))
      .catch(() => setParkir(0));
  }, []);

  const namaButik = settings?.namaButik?.trim();

  return (
    <div className="content">
      <div>
        <p className="h1">Kasir Kayesa</p>
        {namaButik && <p className="soft" style={{ margin: 0 }}>{namaButik}</p>}
      </div>

      {settings && !profilTerisi(settings) && (
        <div className="panel panel--ok">
          Ayo isi nama butik dulu.{" "}
          <button type="button" className="appbar__back" style={{ padding: 0 }} onClick={() => buka("pengaturan")}>
            Isi Pengaturan
          </button>
        </div>
      )}

      {memuatAwal ? (
        <div className="panel" role="status">
          Memuat bazar…
        </div>
      ) : bazar ? (
        <button
          type="button"
          className="card"
          style={{ textAlign: "left", font: "inherit", color: "inherit", cursor: "pointer" }}
          onClick={() => buka("bazar")}
        >
          <span className="soft" style={{ fontWeight: 700, color: "var(--accent-ink)" }}>
            BAZAR AKTIF
          </span>
          <div className="h2">{bazar.nama}</div>
          <span className="soft">
            {bolehAdmin(peran) ? "Ketuk untuk mengatur barang & biaya bazar" : "Ketuk untuk melihat bazar"}
          </span>
          {bolehAdmin(peran) && jumlahBazarAktif > 1 && (
            <span className="soft">Ada {jumlahBazarAktif} bazar aktif. Penjualan memakai bazar ini (terakhir dibuka).</span>
          )}
        </button>
      ) : bolehAdmin(peran) ? (
        <button
          type="button"
          className="card"
          style={{ textAlign: "left", font: "inherit", color: "inherit", cursor: "pointer" }}
          onClick={() => buka("bazar")}
        >
          <span className="soft">Belum ada bazar aktif. Penjualan memakai stok gudang.</span>
          <div className="h2" style={{ color: "var(--primary)" }}>
            Buka Bazar
          </div>
        </button>
      ) : lokasiKasir?.jenis === "toko" ? (
        // F14 (BU-66): kasir toko jualan dari stok gudang — tidak ada bazar
        // aktif bukan halangan, jadi bukan panel peringatan.
        <div className="panel panel--ok" role="status">
          <strong>Toko (Butik) — penjualan memakai stok gudang.</strong>
        </div>
      ) : (
        <div className="panel panel--warn" role="status">
          <strong>Belum ada bazar aktif.</strong>
          <p style={{ margin: "0.25rem 0 0" }}>Minta admin membuka bazar.</p>
        </div>
      )}

      <div className="tiles">
        {memuatAwal ? (
          <button type="button" className="tile tile--hero" disabled aria-describedby="alasan-jual">
            Penjualan
          </button>
        ) : bolehJualBarang(peran, lokasiKasir, bazar !== null) ? (
          <button type="button" className="tile tile--hero" onClick={() => buka("pilih-barang")}>
            Penjualan
          </button>
        ) : (
          <button type="button" className="tile tile--hero" disabled aria-describedby="alasan-jual">
            Penjualan
          </button>
        )}
        <button type="button" className="tile" onClick={() => buka("daftar-jahit")}>
          Pesanan Jahit
        </button>
        {/* Riwayat penjualan (C5): semua peran — sebelumnya riwayat
            penjualan barang tidak bisa dibuka dari layar mana pun. */}
        <button type="button" className="tile" onClick={() => buka("riwayat-penjualan")}>
          Riwayat Penjualan
        </button>

        {bolehAdmin(peran) ? (
          <>
            <button type="button" className="tile" onClick={() => buka("barang")}>
              Barang
            </button>
            <button type="button" className="tile" onClick={() => buka("ringkasan")}>
              Ringkasan
            </button>
            <button type="button" className="tile" onClick={() => buka("pengaturan")}>
              Pengaturan
            </button>
            {/* (d, tes klik 22 Nov 2026): dua tile ini dulu hanya ada di
                mode kasir (Tutup Harian) atau tidak ada sama sekali di
                Beranda (Riwayat Sinkron, hanya lewat Pengaturan) — admin
                yang baru menutup bazar tidak menemukannya lagi. Sekarang
                selalu tampil untuk admin, apa pun status bazar. */}
            <button type="button" className="tile" onClick={() => buka("tutup-harian")}>
              Tutup Harian
            </button>
            <button type="button" className="tile" onClick={() => buka("sinkronisasi")}>
              Riwayat Sinkron
            </button>
          </>
        ) : (
          <>
            <button type="button" className="tile" onClick={() => buka("tutup-harian")}>
              Tutup Harian
            </button>
            <button type="button" className="tile" onClick={onMintaAdmin}>
              Masuk Admin
            </button>
            <button type="button" className="tile" onClick={() => buka("masuk-owner")}>
              Masuk Owner
            </button>
            <button type="button" className="tile" onClick={() => buka("masuk-kasir")}>
              {lokasiKasir ? `Kasir: ${labelLokasiKasir(lokasiKasir)}` : "Masuk Kasir"}
            </button>
          </>
        )}
      </div>

      {peran === "kasir" && !memuatAwal && !bolehJualBarang(peran, lokasiKasir, bazar !== null) && (
        <p className="hint" id="alasan-jual" style={{ margin: 0 }}>
          Kasir bazar hanya mencatat transaksi saat ada bazar aktif.
        </p>
      )}

      {bolehAdmin(peran) && (
        <div>
          <p className="h2" style={{ margin: "1rem 0 0.5rem" }}>
            Mini ERP
          </p>
          <div className="tiles" aria-label="Mini ERP — segera hadir">
            {["Catatan Keuangan", "Catat Belanja", "Data Pelanggan", "Pengeluaran"].map((label) => (
              <button
                key={label}
                type="button"
                className="tile tile--segera"
                onClick={() => setPesan("sedang dalam pengembangan")}
              >
                <span>{label}</span>
                <span className="tile__sub">Segera</span>
              </button>
            ))}
          </div>
          {pesan && (
            <div className="panel panel--ok" role="status" style={{ marginTop: "0.5rem" }}>
              {pesan}
            </div>
          )}
        </div>
      )}

      {bolehLaporanOwner(peran) && (
        <div>
          <p className="h2" style={{ margin: "1rem 0 0.5rem" }}>
            Laporan Owner
          </p>
          <div className="tiles" aria-label="Laporan Owner — segera hadir">
            <button
              type="button"
              className="tile tile--segera"
              onClick={() => setPesan("sedang dalam pengembangan")}
            >
              <span>Laporan Keuangan</span>
              <span className="tile__sub">Segera</span>
            </button>
          </div>
          <p className="soft" style={{ margin: "0.25rem 0 0" }}>
            Laporan keuangan (buku besar, buku kecil, kas, HPP) hanya untuk owner. Admin tidak bisa membukanya.
          </p>
        </div>
      )}

      {bolehAdmin(peran) && (
        <>
          {bazar && (
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={onBiayaBazar}
            >
              Biaya Bazar
            </button>
          )}
          {peran === "admin" && (
            <>
              <button type="button" className="btn btn--ghost btn--small" onClick={() => buka("atur-pin")}>
                Atur PIN Admin
              </button>
              <button type="button" className="btn btn--ghost btn--small" onClick={() => buka("atur-pin-kasir-toko")}>
                Atur PIN Kasir Toko
              </button>
            </>
          )}
          {peran === "owner" && (
            <>
              <button type="button" className="btn btn--ghost btn--small" onClick={() => buka("atur-pin-owner")}>
                Atur PIN Owner
              </button>
              <button type="button" className="btn btn--ghost btn--small" onClick={() => buka("reset-pin-owner")}>
                Reset PIN Peran Lain
              </button>
            </>
          )}
          <p className="soft" style={{ margin: 0 }}>
            Masuk sebagai {peran === "owner" ? "owner" : "admin"}.
          </p>
          <button type="button" className="btn btn--ghost btn--small" onClick={onKeluarAdmin}>
            Keluar ke mode kasir
          </button>
        </>
      )}

      {jumlahBarang === 0 && (
        <p className="soft" style={{ margin: 0 }}>
          Belum ada barang. Tambahkan barang dulu.
        </p>
      )}

      <div style={{ marginTop: "auto" }}>
        {parkir > 0 && <p className="soft" style={{ margin: "0 0 0.25rem" }}>{parkir} transaksi tertahan</p>}
        <StatusSinkron />
        {storagePermanen === false && (
          <p className="soft" style={{ margin: "0.25rem 0 0" }}>
            Minta browser menyimpan data lebih lama: pasang aplikasi ke layar utama.
          </p>
        )}
      </div>
    </div>
  );
}
