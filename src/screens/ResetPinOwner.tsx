import { useEffect, useState } from "react";
import { ambilSettings, daftarBazarAktif, type BazarRecord, type SettingsRecord } from "../db/repositori.ts";
import type { PeranResetPin } from "../sync/resetKode.ts";

/**
 * Reset PIN peran lain oleh owner (BU-65, keputusan Andri 22 Nov 2026).
 *
 * Owner yang sudah masuk bisa menghapus PIN admin, PIN kasir toko, dan PIN
 * kasir tiap bazar aktif — tanpa kode reset, tanpa internet. Penghapusan
 * ikut tersinkron ke perangkat lain lewat jalur sync PIN yang sudah ada
 * (F3) saat online, dan dicatat di log sinkron.
 *
 * PIN owner sendiri tidak ada di daftar ini: owner mengganti PIN-nya
 * sendiri lewat "Atur PIN Owner". Konfirmasi memakai panel di dalam
 * aplikasi (bukan window.confirm — C1: dialog itu ditutup diam-diam
 * oleh browser otomatis).
 */

interface BarisReset {
  peran: PeranResetPin;
  label: string;
  pinAda: boolean;
}

interface Props {
  settings: SettingsRecord | null;
  /** Menghapus PIN peran itu (di App: simpanPin null / ubahPinKasirBazar null + log). */
  onReset: (peran: PeranResetPin) => Promise<void>;
  onKembali: () => void;
}

export default function ResetPinOwner({ settings, onReset, onKembali }: Props) {
  /**
   * Status PIN dibaca SEGAR dari IndexedDB saat panel dibuka (F3(b), tes
   * klik 22 Nov 2026): prop `settings` dari App bisa basi — panel pernah
   * menampilkan "PIN Admin — Belum diatur" dengan tombol nonaktif padahal
   * login admin sedang meminta PIN, dan tidak ada baris bazar sama sekali
   * karena daftar bazar gagal dimuat diam-diam (catch → []). Sekarang:
   * gagal muat = panel galat + tombol "Coba lagi", bukan status kosong.
   */
  const [pengaturan, setPengaturan] = useState<SettingsRecord | null>(settings);
  const [bazarAktif, setBazarAktif] = useState<BazarRecord[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [galatMuat, setGalatMuat] = useState<string | null>(null);
  const [konfirmasi, setKonfirmasi] = useState<PeranResetPin | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  async function muatStatus() {
    setMemuat(true);
    setGalatMuat(null);
    try {
      const [s, d] = await Promise.all([ambilSettings(), daftarBazarAktif()]);
      setPengaturan(s);
      setBazarAktif(d);
    } catch {
      setGalatMuat("Status PIN belum bisa dimuat. Coba lagi.");
    } finally {
      setMemuat(false);
    }
  }

  useEffect(() => {
    let hidup = true;
    (async () => {
      try {
        const [s, d] = await Promise.all([ambilSettings(), daftarBazarAktif()]);
        if (!hidup) return;
        setPengaturan(s);
        setBazarAktif(d);
      } catch {
        if (hidup) setGalatMuat("Status PIN belum bisa dimuat. Coba lagi.");
      } finally {
        if (hidup) setMemuat(false);
      }
    })();
    return () => {
      hidup = false;
    };
    // Sekali saat panel dibuka: status dibaca segar, bukan dari prop basi.
  }, []);

  const baris: BarisReset[] = [
    { peran: "admin", label: "PIN Admin", pinAda: !!pengaturan?.pinHash },
    { peran: "kasir_toko", label: "PIN Kasir Toko", pinAda: !!pengaturan?.pinKasirTokoHash },
    ...bazarAktif.map((b) => ({
      peran: `bazar:${b.id}` as PeranResetPin,
      label: `PIN Kasir Bazar: ${b.nama}`,
      pinAda: !!b.pinKasirHash,
    })),
  ];

  const labelDipilih = konfirmasi ? (baris.find((b) => b.peran === konfirmasi)?.label ?? "") : "";

  async function jalankanReset(peran: PeranResetPin, label: string) {
    setGalat(null);
    setPesan(null);
    setSibuk(true);
    try {
      await onReset(peran);
      setKonfirmasi(null);
      setPesan(`${label} sudah dihapus. Pemilik peran itu harus mengatur PIN baru.`);
      // Segarkan status dari sumber yang sama (settings + bazar aktif).
      const [s, d] = await Promise.all([ambilSettings(), daftarBazarAktif().catch(() => [] as BazarRecord[])]);
      setPengaturan(s);
      setBazarAktif(d);
    } catch {
      setGalat(`${label} belum dihapus. Coba lagi.`);
    } finally {
      setSibuk(false);
    }
  }

  return (
    <>
      <div className="content">
        <p className="h2" style={{ margin: 0 }}>
          Reset PIN Peran Lain
        </p>
        <p className="soft" style={{ margin: 0 }}>
          Hapus PIN admin, kasir toko, atau kasir bazar. Peran itu lalu terbuka tanpa PIN sampai diatur lagi.
        </p>

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

        {memuat && <p className="soft">Memuat status PIN…</p>}

        {galatMuat && (
          <div className="panel panel--warn" role="alert">
            {galatMuat}
            <div style={{ marginTop: "0.5rem" }}>
              <button type="button" className="btn btn--ghost btn--small" onClick={() => void muatStatus()}>
                Coba lagi
              </button>
            </div>
          </div>
        )}

        {!memuat && !galatMuat && baris.map((b) => (
          <div key={b.peran} className="panel" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ flex: 1 }}>
              <strong>{b.label}</strong>
              <span className="soft" style={{ display: "block", fontSize: "0.9rem" }}>
                {b.pinAda ? "PIN diatur" : "Belum diatur"}
              </span>
            </span>
            <button
              type="button"
              className="btn btn--ghost btn--small"
              disabled={!b.pinAda || sibuk}
              onClick={() => {
                setGalat(null);
                setPesan(null);
                setKonfirmasi(b.peran);
              }}
            >
              Reset PIN
            </button>
          </div>
        ))}

        {konfirmasi && (
          <div className="panel panel--warn" role="alert">
            <strong>Hapus {labelDipilih}?</strong>
            <p style={{ margin: "0.25rem 0 0.5rem" }}>
              Peran itu akan terbuka tanpa PIN sampai diatur lagi. Penghapusan ikut tersinkron ke HP lain saat online.
            </p>
            <button
              type="button"
              className="btn btn--primary"
              disabled={sibuk}
              onClick={() => void jalankanReset(konfirmasi, labelDipilih)}
            >
              {sibuk ? "Menghapus…" : "Ya, Hapus PIN"}
            </button>{" "}
            <button type="button" className="btn btn--ghost btn--small" disabled={sibuk} onClick={() => setKonfirmasi(null)}>
              Batal
            </button>
          </div>
        )}
      </div>

      <div className="bottombar">
        <button type="button" className="btn btn--ghost btn--small" onClick={onKembali}>
          Kembali
        </button>
      </div>
    </>
  );
}
