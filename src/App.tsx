import { useEffect, useState } from "react";
import Beranda from "./screens/Beranda.tsx";
import Placeholder from "./screens/Placeholder.tsx";
import { ambilSettings, type SettingsRecord } from "./db/repositori.ts";
import { mintaPenyimpananPermanen } from "./pwa/register.ts";

export type Layar =
  | { nama: "beranda" }
  | { nama: "pilih-barang" }
  | { nama: "keranjang" }
  | { nama: "pesanan" }
  | { nama: "barang" }
  | { nama: "bazar" }
  | { nama: "ringkasan" }
  | { nama: "pengaturan" };

/**
 * Kerangka aplikasi Phase 2.
 *
 * Navigasi memakai state biasa (bukan router) karena MVP punya sedikit layar
 * dan satu perangkat. Fase berikutnya boleh mengganti bila perlu riwayat browser.
 */
export default function App() {
  const [layar, setLayar] = useState<Layar>({ nama: "beranda" });
  const [settings, setSettings] = useState<SettingsRecord | null>(null);
  const [storagePermanen, setStoragePermanen] = useState<boolean | null>(null);

  useEffect(() => {
    ambilSettings()
      .then(setSettings)
      .catch(() => setSettings(null));

    mintaPenyimpananPermanen()
      .then(setStoragePermanen)
      .catch(() => setStoragePermanen(false));
  }, []);

  function kembali() {
    setLayar({ nama: "beranda" });
  }

  const judul: Record<Exclude<Layar["nama"], "beranda">, string> = {
    "pilih-barang": "Pilih Barang",
    keranjang: "Keranjang",
    pesanan: "Pesanan",
    barang: "Barang",
    bazar: "Bazar",
    ringkasan: "Ringkasan",
    pengaturan: "Pengaturan",
  };

  return (
    <div className="app">
      {layar.nama !== "beranda" && (
        <header className="appbar">
          <button type="button" className="appbar__back" onClick={kembali}>
            ‹ Kembali
          </button>
          <span className="appbar__title">{judul[layar.nama]}</span>
        </header>
      )}

      {layar.nama === "beranda" ? (
        <Beranda
          settings={settings}
          storagePermanen={storagePermanen}
          buka={(nama) => setLayar({ nama })}
        />
      ) : (
        <Placeholder
          nama={layar.nama}
          settings={settings}
          storagePermanen={storagePermanen}
        />
      )}
    </div>
  );
}
