import { useEffect, useState } from "react";
import {
  bacaLogSinkron,
  bacaTerakhirBerhasil,
  bacaTerakhirTarik,
  daftarAntrean,
  sinkronkan,
  type AntreanTampil,
} from "../sync/mesin.ts";
import type { LogSinkronRecord } from "../db/schema.ts";
import type { Peran } from "../lib/peran.ts";
import { formatTanggalJam } from "../lib/tanggal.ts";

interface Props {
  /** Peran aktif: catatan sinkronisasi hanya dibaca owner (BU-33). */
  peran: Peran;
}

/**
 * Riwayat sinkronisasi (Fase 2B, BU-33).
 *
 * Yang ditampilkan:
 *  - Kapan terakhir berhasil kirim & tarik.
 *  - Daftar data yang belum terkirim (bisa dilihat & dilacak) — dengan
 *    bahasa sederhana, tanpa istilah database/jurnal.
 *  - Catatan sinkronisasi (pengaman diam-diam): HANYA untuk owner.
 *
 * Layar ini hanya membaca — tidak mengubah apa pun.
 */
export default function RiwayatSinkron({ peran }: Props) {
  // Alamat endpoint sinkronisasi — dibaca tiap render (bukan sekali saat
  // modul dimuat) supaya tes bisa memasang URL lewat stubEnv.
  // Kosong = sinkronisasi tidak aktif di build ini.
  const URL_SYNC = import.meta.env.VITE_SYNC_URL ?? "";
  const [antrean, setAntrean] = useState<AntreanTampil[] | null>(null);
  const [terakhirKirim, setTerakhirKirim] = useState<string | null>(null);
  const [terakhirTarik, setTerakhirTarik] = useState<string | null>(null);
  const [log, setLog] = useState<LogSinkronRecord[] | null>(null);
  /** Hasil kirim manual terakhir (null = belum pernah menekan). */
  const [hasilKirim, setHasilKirim] = useState<string | null>(null);
  const [mengirim, setMengirim] = useState(false);

  const muat = async () => {
    setAntrean(await daftarAntrean());
    setTerakhirKirim(await bacaTerakhirBerhasil());
    setTerakhirTarik(await bacaTerakhirTarik());
    if (peran === "owner") setLog(await bacaLogSinkron());
  };

  /**
   * Kirim sekarang (e, tes klik 22 Nov 2026): dulu layar ini hanya membaca
   * — tombol "Segarkan" hanya memuat ulang tampilan, tidak mengirim apa
   * pun, dan sync hanya jalan dari Beranda. Bila antrean macet ("Belum
   * pernah" terkirim), tidak ada jalan keluar dari layar ini. Sekarang
   * tombol ini benar-benar menjalankan satu putaran sinkronisasi (kirim
   * lalu tarik) dan menampilkan hasilnya dengan jujur — termasuk bila
   * gagal (pesan kesalahannya ditampilkan, bukan ditelan diam-diam).
   */
  const kirimSekarang = async () => {
    if (!URL_SYNC || mengirim) return;
    setMengirim(true);
    setHasilKirim(null);
    try {
      const token = import.meta.env.VITE_SYNC_TOKEN;
      const hasil = await sinkronkan(token ? { url: URL_SYNC, token } : { url: URL_SYNC });
      if (hasil.status === "siap") {
        setHasilKirim("Semua data sudah terkirim.");
      } else if (hasil.status === "menunggu") {
        setHasilKirim(`Masih ada ${hasil.antrean} data menunggu dikirim. Dicoba lagi otomatis.`);
      } else if (hasil.status === "mati") {
        setHasilKirim("Sinkronisasi belum diatur di aplikasi ini.");
      } else {
        setHasilKirim(hasil.pesan ?? "Belum terkirim, tersimpan di HP dulu.");
      }
    } catch {
      setHasilKirim("Belum terkirim, tersimpan di HP dulu.");
    } finally {
      await muat();
      setMengirim(false);
    }
  };

  useEffect(() => {
    let hidup = true;
    (async () => {
      const a = await daftarAntrean();
      const kirim = await bacaTerakhirBerhasil();
      const tarik = await bacaTerakhirTarik();
      const catatan = peran === "owner" ? await bacaLogSinkron() : null;
      if (!hidup) return;
      setAntrean(a);
      setTerakhirKirim(kirim);
      setTerakhirTarik(tarik);
      if (catatan !== null) setLog(catatan);
    })();
    return () => {
      hidup = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tampilWaktu = (waktu: string | null) => (waktu ? formatTanggalJam(waktu) : "Belum pernah");

  return (
    <div className="content">
      <div className="panel">
        <div>
          <strong>Terakhir berhasil kirim:</strong> {tampilWaktu(terakhirKirim)}
        </div>
        <div>
          <strong>Terakhir berhasil tarik:</strong> {tampilWaktu(terakhirTarik)}
        </div>
        <div>
          <strong>Menunggu dikirim:</strong> {antrean === null ? "…" : `${antrean.length} data`}
        </div>
      </div>

      <h2>Menunggu dikirim</h2>
      {antrean === null ? (
        <p>Memuat…</p>
      ) : antrean.length === 0 ? (
        <p>Semua sudah terkirim.</p>
      ) : (
        <>
          <p className="soft">Belum terkirim, tersimpan di HP dulu.</p>
          <ul>
            {antrean.map((a) => (
              <li key={a.id}>
                <strong>
                  {a.jenis}: {a.judul}
                </strong>
                <span className="soft" style={{ display: "block", fontSize: "0.9rem" }}>
                  {a.subjudul}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {peran === "owner" && (
        <>
          <h2>Catatan sinkronisasi</h2>
          {log === null ? (
            <p>Memuat…</p>
          ) : log.length === 0 ? (
            <p>Belum ada catatan.</p>
          ) : (
            <ul>
              {log.map((l) => (
                <li key={l.id}>
                  <strong>{l.judul}</strong>
                  <span className="soft" style={{ display: "block", fontSize: "0.9rem" }}>
                    {formatTanggalJam(l.waktu)} — {l.rincian}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <button type="button" className="btn" onClick={() => void muat()}>
        Segarkan
      </button>
      <button
        type="button"
        className="btn btn--primary"
        onClick={() => void kirimSekarang()}
        disabled={!URL_SYNC || mengirim}
        style={{ marginLeft: "0.5rem" }}
      >
        {mengirim ? "Mengirim…" : "Kirim Sekarang"}
      </button>
      {!URL_SYNC && (
        <p className="soft" style={{ margin: "0.5rem 0 0" }}>
          Sinkronisasi belum diatur di aplikasi ini — data hanya tersimpan di HP.
        </p>
      )}
      {hasilKirim && (
        <div className="panel panel--ok" role="status" style={{ marginTop: "0.5rem" }}>
          {hasilKirim}
        </div>
      )}
    </div>
  );
}
