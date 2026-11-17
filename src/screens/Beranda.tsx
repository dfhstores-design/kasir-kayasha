import { useEffect, useState } from "react";
import StatusSinkron from "../components/StatusSinkron.tsx";
import { daftarParkir, daftarProduk, profilTerisi, type ProdukRecord } from "../db/repositori.ts";
import type { SettingsRecord } from "../db/schema.ts";
import type { BazarRecord } from "../db/schema.ts";
import type { Layar } from "../App.tsx";

interface Props {
  settings: SettingsRecord | null;
  storagePermanen: boolean | null;
  /** Bazar yang sedang aktif (null = penjualan memakai stok gudang). */
  bazar: BazarRecord | null;
  /** Peran aktif: kasir dibatasi pada transaksi bazar aktif saja. */
  peran: "kasir" | "admin";
  onMintaAdmin: () => void;
  onKeluarAdmin: () => void;
  /** Membuka Biaya Bazar; App yang menyertakan objek bazar aktif. */
  onBiayaBazar: () => void;
  /** Layar tanpa parameter saja; layar yang butuh objek dibuat di App. */
  buka: (nama: Exclude<Layar["nama"], "biaya-bazar" | "detail-barang" | "form-barang" | "alokasi-bazar" | "tutup-bazar" | "tersimpan">) => void;
}

/**
 * Beranda — docs/design/screens/01-beranda.md.
 * Menu kasir: Penjualan, Pesanan Jahit, Masuk Admin. Admin tambah Barang,
 * Ringkasan, Pengaturan, dan bagian Mini ERP (admin-only). Panel bazar dan
 * status simpan. Tidak ada menu tersembunyi.
 */
export default function Beranda({ settings, storagePermanen, bazar, peran, onMintaAdmin, onKeluarAdmin, onBiayaBazar, buka }: Props) {
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

      {bazar ? (
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
            {peran === "admin" ? "Ketuk untuk mengatur barang & biaya bazar" : "Ketuk untuk melihat bazar"}
          </span>
          {peran === "admin" && (
            <span className="soft">Untuk membuka bazar baru, tutup bazar ini dulu di layar Bazar.</span>
          )}
        </button>
      ) : peran === "admin" ? (
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
      ) : (
        <div className="panel panel--warn" role="status">
          <strong>Belum ada bazar aktif.</strong>
          <p style={{ margin: "0.25rem 0 0" }}>Minta admin membuka bazar.</p>
        </div>
      )}

      <div className="tiles">
        {peran === "admin" || bazar ? (
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

        {peran === "admin" ? (
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
          </>
        ) : (
          <button type="button" className="tile" onClick={onMintaAdmin}>
            Masuk Admin
          </button>
        )}
      </div>

      {peran === "kasir" && !bazar && (
        <p className="hint" id="alasan-jual" style={{ margin: 0 }}>
          Kasir hanya mencatat transaksi saat ada bazar aktif.
        </p>
      )}

      {peran === "admin" && (
        <div>
          <p className="h2" style={{ margin: "1rem 0 0.5rem" }}>
            Mini ERP
          </p>
          <div className="tiles" aria-label="Mini ERP — segera hadir">
            {["Catatan Keuangan", "Catat Belanja", "Laporan Keuangan", "Data Pelanggan", "Pengeluaran"].map((label) => (
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

      {peran === "admin" && (
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
          <button type="button" className="btn btn--ghost btn--small" onClick={() => buka("atur-pin")}>
            Atur PIN Admin
          </button>
          <p className="soft" style={{ margin: 0 }}>
            Masuk sebagai admin.
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
