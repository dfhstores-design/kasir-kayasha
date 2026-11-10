import { useState } from "react";
import {
  buatCadangan,
  buatCsvTransaksi,
  NAMA_BERKAS_CADANGAN,
  periksaCadangan,
  pulihkanCadangan,
  type BerkasCadangan,
} from "../db/cadangan.ts";
import { daftarTransaksi } from "../db/repositori.ts";

interface Props {
  /** Dipanggil setelah pemulihan berhasil agar seluruh layar memuat ulang. */
  onDipulihkan: () => void;
}

/**
 * Cadangan & pemulihan (docs/design/screens/14-status-simpan.md).
 *
 * Prinsip:
 *  - ekspor = satu berkas JSON berisi semuanya (termasuk foto & logo)
 *  - pemulihan SELALU menampilkan ringkasan isi dulu, lalu konfirmasi
 *  - mode "ganti" hanya dipilih pemilik secara sadar
 */
export default function Cadangan({ onDipulihkan }: Props) {
  const [pesan, setPesan] = useState<string | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [calon, setCalon] = useState<{ berkas: BerkasCadangan; ringkas: string[] } | null>(null);
  const [gantiSemua, setGantiSemua] = useState(false);

  function unduh(blob: Blob, nama: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nama;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function eksporJson() {
    setSibuk(true);
    setGalat(null);
    setPesan(null);
    try {
      const h = await buatCadangan();
      if (!h.ok) {
        setGalat(h.pesan);
        return;
      }
      unduh(h.blob, NAMA_BERKAS_CADANGAN(new Date()));
      setPesan("Cadangan disimpan di folder Unduhan.");
    } finally {
      setSibuk(false);
    }
  }

  async function eksporCsv() {
    setSibuk(true);
    setGalat(null);
    setPesan(null);
    try {
      const trx = await daftarTransaksi();
      const csv = buatCsvTransaksi(trx);
      unduh(new Blob([csv], { type: "text/csv;charset=utf-8" }), "Transaksi-KasirKayesha.csv");
      setPesan("Daftar transaksi (CSV) disimpan di folder Unduhan.");
    } finally {
      setSibuk(false);
    }
  }

  async function pilihBerkas(berkas: File) {
    setGalat(null);
    setPesan(null);
    setCalon(null);
    const teks = await berkas.text();
    const h = periksaCadangan(teks);
    if (!h.ok) {
      setGalat(h.pesan);
      return;
    }
    setCalon({ berkas: h.berkas, ringkas: h.ringkas });
  }

  async function pulihkan() {
    if (!calon) return;
    const konfirmasi = gantiSemua
      ? "Ganti SEMUA data dengan isi cadangan? Data sekarang akan dihapus lebih dulu."
      : "Gabungkan isi cadangan ke data sekarang? Data yang ada tidak dihapus.";
    if (!window.confirm(konfirmasi)) return;

    setSibuk(true);
    setGalat(null);
    try {
      const h = await pulihkanCadangan(calon.berkas, { mode: gantiSemua ? "ganti" : "gabung" });
      if (!h.ok) {
        setGalat(h.pesan);
        return;
      }
      setPesan("Cadangan berhasil dipulihkan.");
      setCalon(null);
      setGantiSemua(false);
      onDipulihkan();
    } finally {
      setSibuk(false);
    }
  }

  return (
    <>
      <div className="content">
        {galat && (
          <div className="panel panel--warn" role="alert">
            {galat}
          </div>
        )}
        {pesan && (
          <div className="panel panel--ok" role="status">
            {pesan}
          </div>
        )}

        <div className="card">
          <span className="label">Simpan cadangan</span>
          <p className="hint" style={{ marginTop: 0 }}>
            Satu berkas berisi semua data: barang, foto, bazar, transaksi, pembayaran, dan pengaturan.
          </p>
          <button type="button" className="btn btn--primary btn--small" onClick={eksporJson} disabled={sibuk}>
            Simpan cadangan (JSON)
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--small"
            style={{ marginTop: "0.5rem" }}
            onClick={eksporCsv}
            disabled={sibuk}
          >
            Simpan daftar transaksi (CSV)
          </button>
        </div>

        <div className="card">
          <span className="label">Pulihkan dari cadangan</span>
          <p className="hint" style={{ marginTop: 0 }}>
            Pilih berkas cadangan. Isinya diperiksa dulu sebelum ada data yang ditulis.
          </p>
          <label className="btn btn--ghost btn--small" style={{ justifyContent: "center" }}>
            Pilih berkas cadangan
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void pilihBerkas(f);
                e.target.value = "";
              }}
            />
          </label>

          {calon && (
            <div className="panel panel--warn" style={{ marginTop: "0.75rem" }} role="status">
              <strong>Isi cadangan yang dipilih:</strong>
              <ul style={{ margin: "0.25rem 0 0", paddingLeft: "1.25rem" }}>
                {calon.ringkas.length === 0 ? <li>tidak ada data</li> : calon.ringkas.map((r) => <li key={r}>{r}</li>)}
              </ul>
              <label className="tampil-arsip" style={{ marginTop: "0.5rem" }}>
                <input type="checkbox" checked={gantiSemua} onChange={(e) => setGantiSemua(e.target.checked)} />
                Ganti semua data (hapus data sekarang lebih dulu)
              </label>
              <button
                type="button"
                className="btn btn--primary btn--small"
                style={{ marginTop: "0.5rem" }}
                onClick={pulihkan}
                disabled={sibuk}
              >
                {sibuk ? "Memulihkan…" : "Pulihkan sekarang"}
              </button>
            </div>
          )}
        </div>

        <p className="hint">
          Data tersimpan di HP ini. Membuat cadangan secara rutin (misalnya tiap akhir hari pameran)
          adalah cara paling aman mencegah data hilang bila HP rusak atau diganti.
        </p>
      </div>
    </>
  );
}
