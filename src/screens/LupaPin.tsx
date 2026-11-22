import { useState } from "react";

/**
 * Layar "Lupa PIN" (BU-65, keputusan Andri 22 Nov 2026).
 *
 * Pemilik peran yang lupa PIN meminta kode reset ke Andri lewat WA,
 * memasukkan kode 6 angka itu di sini, dan PIN peran itu dihapus supaya
 * bisa diatur baru. Kode berlaku 1 jam dan hanya bisa dipakai sekali.
 *
 * Jujur soal batas: reset ini BUTUH INTERNET (kode diperiksa ke server).
 * Kalau HP sedang offline, layar mengatakannya — tidak menjanjikan reset
 * offline yang tidak bisa dilakukan.
 */

export type HasilVerifikasi = { ok: true } | { ok: false; pesan: string };

interface Props {
  /** Label peran yang PIN-nya lupa, mis. "admin" / "kasir toko". */
  peranLabel: string;
  /** Memeriksa kode ke hub; di App diisi verifikasiKodeReset + hapus PIN lokal. */
  onVerifikasi: (kode: string) => Promise<HasilVerifikasi>;
  /** PIN sudah dihapus — kembali ke layar masuk untuk mengatur PIN baru. */
  onBerhasil: () => void;
  onBatal: () => void;
}

export default function LupaPin({ peranLabel, onVerifikasi, onBerhasil, onBatal }: Props) {
  const [kode, setKode] = useState("");
  const [galat, setGalat] = useState<string | null>(null);
  const [berhasil, setBerhasil] = useState(false);
  const [sibuk, setSibuk] = useState(false);

  async function periksa() {
    setGalat(null);
    if (!/^\d{6}$/.test(kode)) {
      setGalat("Kode harus 6 angka.");
      return;
    }
    setSibuk(true);
    // F1, tes klik 22 Nov 2026: tanpa try/finally, bila onVerifikasi
    // menolak (mis. respons hilang), tombol macet di "Memeriksa…"
    // selamanya tanpa pesan dan tanpa jalan coba lagi. Sekarang sibuk
    // SELALU direset dan galat selalu ditampilkan.
    try {
      const hasil = await onVerifikasi(kode);
      if (hasil.ok) setBerhasil(true);
      else setGalat(hasil.pesan);
    } catch {
      setGalat("Kode tidak bisa diperiksa. Periksa internet, lalu coba lagi.");
    } finally {
      setSibuk(false);
    }
  }

  if (berhasil) {
    return (
      <>
        <div className="content">
          <div className="panel panel--ok" role="status">
            <strong>PIN {peranLabel} sudah dihapus.</strong>
            <p style={{ margin: "0.25rem 0 0" }}>Sekarang atur PIN baru.</p>
          </div>
        </div>
        <div className="bottombar">
          <button type="button" className="btn btn--primary" onClick={onBerhasil}>
            Atur PIN Baru
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="content">
        <p className="h2" style={{ margin: 0 }}>
          Lupa PIN {peranLabel}?
        </p>
        <p className="soft" style={{ margin: 0 }}>
          Minta kode reset ke Andri lewat WA. Kode berisi 6 angka, berlaku 1 jam, dan hanya bisa dipakai sekali.
        </p>

        {galat && (
          <div className="panel panel--warn" role="alert">
            {galat}
          </div>
        )}

        <div>
          <label htmlFor="kode-reset">Kode reset dari Andri</label>
          <input
            id="kode-reset"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={kode}
            onChange={(e) => setKode(e.target.value.replace(/[^0-9]/g, ""))}
            onKeyDown={(e) => {
              if (e.key === "Enter") void periksa();
            }}
          />
        </div>

        <p className="hint" style={{ margin: 0 }}>
          Reset ini butuh internet. Kalau HP sedang offline, sambungkan internet dulu, lalu coba lagi.
        </p>
      </div>

      <div className="bottombar">
        <button
          type="button"
          className="btn btn--primary"
          onClick={periksa}
          disabled={sibuk || kode.length < 6}
        >
          {sibuk ? "Memeriksa…" : "Periksa Kode"}
        </button>
        <button type="button" className="btn btn--ghost btn--small" onClick={onBatal}>
          Kembali
        </button>
      </div>
    </>
  );
}
