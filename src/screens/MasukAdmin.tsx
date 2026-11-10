import { useCallback, useEffect, useState } from "react";
import { cocokPin, batasPercobaan, MAKS_PERCOBAAN_PIN } from "../lib/pin.ts";

interface Props {
  /** Hash PIN admin; null = belum diatur (aplikasi terbuka sebagai kasir). */
  pinHash: string | null;
  onMasukAdmin: () => void;
  onBatal: () => void;
}

/**
 * Layar masuk admin (ROLE-BIAYA-RINGKASAN.md 1.1).
 *
 * Bila PIN belum diatur, admin tetap boleh masuk SEKALI untuk mengatur PIN —
 * tanpa ini aplikasi akan terkunci selamanya di mode kasir.
 */
export default function MasukAdmin({ pinHash, onMasukAdmin, onBatal }: Props) {
  const [pin, setPin] = useState("");
  const [galat, setGalat] = useState<string | null>(null);
  const [percobaan, setPercobaan] = useState(0);
  const [gagalPada, setGagalPada] = useState<number | null>(null);
  const [sekarang, setSekarang] = useState(() => Date.now());
  const [sibuk, setSibuk] = useState(false);

  // Menghitung mundur penguncian secara visual.
  useEffect(() => {
    const id = setInterval(() => setSekarang(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const kunci = batasPercobaan(percobaan, gagalPada, sekarang);

  const masuk = useCallback(async () => {
    if (kunci.terkunci) return;
    setSibuk(true);
    const cocok = await cocokPin(pin, pinHash);
    setSibuk(false);

    if (cocok) {
      setPin("");
      setPercobaan(0);
      setGagalPada(null);
      setGalat(null);
      onMasukAdmin();
      return;
    }

    const baru = percobaan + 1;
    setPercobaan(baru);
    setGagalPada(Date.now());
    setPin("");
    setGalat(
      baru >= MAKS_PERCOBAAN_PIN
        ? `PIN salah ${MAKS_PERCOBAAN_PIN} kali. Tunggu 30 detik.`
        : "PIN salah. Coba lagi.",
    );
  }, [pin, pinHash, percobaan, kunci.terkunci, onMasukAdmin]);

  if (!pinHash) {
    return (
      <>
        <div className="content">
          <div className="panel panel--ok">
            <strong>PIN admin belum diatur.</strong>
            <p style={{ margin: "0.25rem 0 0" }}>
              Aplikasi terbuka dalam mode kasir. Buka sekali sebagai admin untuk mengatur PIN;
              setelah itu masuk admin akan meminta PIN.
            </p>
          </div>
        </div>
        <div className="bottombar">
          <button type="button" className="btn btn--primary" onClick={onMasukAdmin}>
            Buka sebagai Admin (atur PIN)
          </button>
          <button type="button" className="btn btn--ghost btn--small" onClick={onBatal}>
            Tetap sebagai kasir
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="content">
        <p className="h2" style={{ margin: 0 }}>
          Masuk sebagai Admin
        </p>
        <p className="soft" style={{ margin: 0 }}>
          Masukkan PIN ({MAKS_PERCOBAAN_PIN} kali salah = tunggu 30 detik)
        </p>

        {galat && (
          <div className="panel panel--warn" role="alert">
            {galat}
            {kunci.terkunci && ` (${kunci.sisaDetik} detik lagi)`}
          </div>
        )}

        <div>
          <label htmlFor="pin">PIN</label>
          <input
            id="pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/[^\d]/g, ""))}
            onKeyDown={(e) => {
              if (e.key === "Enter") void masuk();
            }}
          />
        </div>
      </div>

      <div className="bottombar">
        <button
          type="button"
          className="btn btn--primary"
          onClick={masuk}
          disabled={sibuk || kunci.terkunci || pin.length < 4}
        >
          {sibuk ? "Memeriksa…" : "Masuk"}
        </button>
        <button type="button" className="btn btn--ghost btn--small" onClick={onBatal}>
          Tetap sebagai kasir
        </button>
      </div>
    </>
  );
}
