import { useEffect, useState } from "react";
import { jumlahAntrean, sinkronkan, jedaCobaLagi, type RingkasanSinkronisasi, type StatusSync } from "../sync/mesin.ts";

/** Alamat endpoint sinkronisasi; kosong = sinkronisasi tidak aktif (aplikasi tetap jalan). */
const URL_SYNC = import.meta.env.VITE_SYNC_URL ?? "";

/**
 * Indikator status sinkronisasi di beranda (Fase 2B, BU-33).
 *
 * Prinsip yang dijaga:
 *  - Penjualan TIDAK menunggu jaringan: komponen ini hanya membaca antrean.
 *  - Saat offline, tulisan tetap tenang dan berbahasa sederhana
 *    ("Belum terkirim, tersimpan di HP dulu.") — bukan peringatan merah,
 *    tanpa istilah database/jurnal.
 *  - Kegagalan dicoba ulang otomatis dengan jeda yang makin panjang.
 *  - Tiap putaran juga MENARIK perubahan dari perangkat lain (bukan hanya kirim).
 */
export default function StatusSinkron() {
  const [r, setR] = useState<RingkasanSinkronisasi | null>(null);
  const [coba, setCoba] = useState(0);

  useEffect(() => {
    let hidup = true;
    let tunda: ReturnType<typeof setTimeout> | undefined;

    const jalan = async () => {
      const antrean = await jumlahAntrean().catch(() => 0);
      if (!hidup) return;

      if (!URL_SYNC) {
        setR({
          status: "mati",
          antrean,
          terakhirBerhasil: null,
          terakhirTarik: null,
          ditarik: { transaksiBaru: 0, transaksiDigabung: 0, produk: 0, bazar: 0 },
          konflik: 0,
          pesan: null,
        });
        return;
      }

      const token = import.meta.env.VITE_SYNC_TOKEN;
      const hasil = await sinkronkan(token ? { url: URL_SYNC, token } : { url: URL_SYNC });
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
    if (s === "gagal") return "Belum terkirim, tersimpan di HP dulu.";
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
