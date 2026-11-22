import { useCallback, useEffect, useState } from "react";
import { cocokPin, batasPercobaan, MAKS_PERCOBAAN_PIN } from "../lib/pin.ts";
import type { Peran } from "../lib/peran.ts";

interface Props {
  /** Peran yang dimasuki: "admin" atau "owner" (Fase 2A, BU-32). */
  peran: Extract<Peran, "admin" | "owner">;
  /** Hash PIN peran itu; null = belum diatur (aplikasi terbuka sebagai kasir). */
  pinHash: string | null;
  /**
   * Pengaturan belum selesai dimuat (F3/F4, tes klik 22 Nov 2026): selama
   * ini layar TIDAK BOLEH menyimpulkan "PIN belum diatur" (masuk gratis)
   * atau "PIN sudah diatur" (minta PIN) — keduanya pernah tampil bergantian
   * dari satu sumber yang sama (settings null = belum dimuat, bukan "tidak
   * ada PIN"). Tampilkan "Memuat…" + tombol coba lagi.
   */
  memuat?: boolean;
  onMuatUlang?: () => void;
  onMasukAdmin: () => void;
  onBatal: () => void;
  /** Membuka layar "Lupa PIN" (BU-65): reset dengan kode dari Andri. */
  onLupaPin: () => void;
}

/**
 * Layar masuk admin / owner (ROLE-BIAYA-RINGKASAN.md 1.1; Fase 2A BU-32).
 *
 * PIN admin dan PIN owner TERPISAH sejak awal. Bila PIN belum diatur, pemilik
 * peran tetap boleh masuk SEKALI untuk mengatur PIN — tanpa ini aplikasi akan
 * terkunci selamanya di mode kasir.
 */
export default function MasukAdmin({ peran, pinHash, memuat, onMuatUlang, onMasukAdmin, onBatal, onLupaPin }: Props) {
  const [pin, setPin] = useState("");
  const [galat, setGalat] = useState<string | null>(null);
  const [percobaan, setPercobaan] = useState(0);
  const [gagalPada, setGagalPada] = useState<number | null>(null);
  const [sekarang, setSekarang] = useState(() => Date.now());
  const [sibuk, setSibuk] = useState(false);

  const namaPeran = peran === "owner" ? "Owner" : "Admin";

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

  // Pengaturan belum dimuat: jangan simpulkan apa pun soal PIN (F3/F4).
  // Cabang ini sesudah semua hooks supaya jumlah hooks tetap sama.
  if (memuat) {
    return (
      <>
        <div className="content">
          <p className="soft">Memuat pengaturan…</p>
        </div>
        <div className="bottombar">
          <button type="button" className="btn btn--primary" onClick={onMuatUlang}>
            Coba lagi
          </button>
          <button type="button" className="btn btn--ghost btn--small" onClick={onBatal}>
            Tetap sebagai kasir
          </button>
        </div>
      </>
    );
  }

  if (!pinHash) {
    return (
      <>
        <div className="content">
          <div className="panel panel--ok">
            <strong>PIN {namaPeran.toLowerCase()} belum diatur.</strong>
            <p style={{ margin: "0.25rem 0 0" }}>
              Aplikasi terbuka dalam mode kasir. Buka sekali sebagai {namaPeran.toLowerCase()} untuk mengatur PIN;
              setelah itu masuk {namaPeran.toLowerCase()} akan meminta PIN.
            </p>
          </div>
        </div>
        <div className="bottombar">
          <button type="button" className="btn btn--primary" onClick={onMasukAdmin}>
            Buka sebagai {namaPeran} (atur PIN)
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
          Masuk sebagai {namaPeran}
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
            inputMode="text"
            autoComplete="off"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/[^A-Za-z0-9]/g, ""))}
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
        <button type="button" className="btn btn--ghost btn--small" onClick={onLupaPin}>
          Lupa PIN
        </button>
      </div>
    </>
  );
}
