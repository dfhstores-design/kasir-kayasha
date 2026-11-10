import { useEffect, useState } from "react";
import { daftarParkir, daftarProduk, profilTerisi, type ProdukRecord } from "../db/repositori.ts";
import type { SettingsRecord } from "../db/schema.ts";
import type { BazarRecord } from "../db/schema.ts";
import type { Layar } from "../App.tsx";

interface Props {
  settings: SettingsRecord | null;
  storagePermanen: boolean | null;
  /** Bazar yang sedang aktif (null = penjualan memakai stok gudang). */
  bazar: BazarRecord | null;
  buka: (nama: Layar["nama"]) => void;
}

/**
 * Beranda — docs/design/screens/01-beranda.md.
 * Lima tujuan besar, panel bazar, dan status simpan. Tidak ada menu tersembunyi.
 */
export default function Beranda({ settings, storagePermanen, bazar, buka }: Props) {
  const [jumlahBarang, setJumlahBarang] = useState<number | null>(null);
  const [parkir, setParkir] = useState(0);

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
        <p className="h1">Kasir Kayasha</p>
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
          <span className="soft">Ketuk untuk mengatur barang bazar</span>
        </button>
      ) : (
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
      )}

      <div className="tiles">
        <button type="button" className="tile tile--hero" onClick={() => buka("pilih-barang")}>
          Jual Barang
        </button>
        <button type="button" className="tile" onClick={() => buka("pesanan")}>
          Pesanan
        </button>
        <button type="button" className="tile" onClick={() => buka("barang")}>
          Barang
        </button>
        <button type="button" className="tile" onClick={() => buka("ringkasan")}>
          Ringkasan
        </button>
        <button type="button" className="tile" onClick={() => buka("pengaturan")}>
          Pengaturan
        </button>
      </div>

      {jumlahBarang === 0 && (
        <p className="soft" style={{ margin: 0 }}>
          Belum ada barang. Tambahkan barang dulu.
        </p>
      )}

      <div style={{ marginTop: "auto" }}>
        {parkir > 0 && <p className="soft" style={{ margin: "0 0 0.25rem" }}>{parkir} transaksi tertahan</p>}
        <div className="status">
          <span className="dot" aria-hidden="true" />
          <span>Tersimpan di perangkat</span>
        </div>
        {storagePermanen === false && (
          <p className="soft" style={{ margin: "0.25rem 0 0" }}>
            Minta browser menyimpan data lebih lama: pasang aplikasi ke layar utama.
          </p>
        )}
      </div>
    </div>
  );
}
