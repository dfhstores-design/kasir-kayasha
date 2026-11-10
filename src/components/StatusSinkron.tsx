import { useEffect, useState } from "react";
import { jumlahAntrean, kirimAntrean, jedaCobaLagi, type RingkasanSync, type StatusSync } from "../sync/mesin.ts";

/** Alamat endpoint sinkronisasi; kosong = sinkronisasi tidak aktif (aplikasi tetap jalan). */
const URL_SYNC = import.meta.env.VITE_SYNC_URL ?? "";

/**
 * Indikator status sinkronisasi di beranda.
 *
 * Prinsip yang dijaga:
 *  - Penjualan TIDAK menunggu jaringanan: komponen ini hanya membaca antrean.
 *  - Saat offline, tulisan tetap tenang ("tersimpan di perangkat") — bukan peringatan merah.
 *  - Kegagalan dicoba ulang otomatis dengan jeda yang makin panjang.
 */
export default function StatusSinkron() {
  const [r, setR] = useState<RingkasanSync | null>(null);
  const [coba, setCoba] = useState(0);

  useEffect(() => {
    let hidup = true;
    let tunda: ReturnType<typeof setTimeout> | undefined;

    const jalan = async () => {
      const antrean = await jumlahAntrean().catch(() => 0);
      if (!hidup) return;

      if (!URL_SYNC || antrean === 0) {
        setR({
          status: URL_SYNC ? "siap" : "mati",
          antrean,
          terakhirBerhasil: null,
          pesan: null,
        });
        return;
      }

      const token = import.meta.env.VITE_SYNC_TOKEN;
      const hasil = await kirimAntrean(token ? { url: URL_SYNC, token } : { url: URL_SYNC });
      if (!hidup) return;
      setR(hasil);

      if (hasil.status === "gagal" || hasil.status === "menunggu") {
        tunda = setTimeout(() => {
          setCoba((n) => n + 1);
        }, jedaCobaLagi(coba));
      }
    };

    void jalan();
    return () => {
      hidup = false;
      if (tunda) clearTimeout(tunda);
    };
  }, [coba]);

  const tampil = (s: StatusSync, antrean: number) => {
    if (s === "mati") return "Tersimpan di perangkat";
    if (s === "siap") return "Tersimpan di perangkat & cloud";
    if (s === "gagal") return `${antrean} data menunggu tersambung`;
    if (s === "menunggu") return antrean > 0 ? `${antrean} data menunggu dikirim` : "Tersambung";
    if (s === "mengirim") return "Mengirim…";
    return "Tersimpan di perangkat";
  };

  const status = r?.status ?? "mati";
  const jumlah = r?.antrean ?? 0;

  return (
    <div className="status">
      <span className="dot" aria-hidden="true" />
      <span>{tampil(status, jumlah)}</span>
    </div>
  );
}
