import { useState } from "react";
import { buatHashPin, validasiPinBaru } from "../lib/pin.ts";

interface Props {
  pinAda: boolean;
  onSimpan: (hash: string | null) => Promise<void>;
}

/**
 * Pengaturan PIN admin (ROLE-BIAYA-RINGKASAN.md 1.1).
 * Hanya bisa diakses admin. PIN tidak pernah ditampilkan kembali.
 */
export default function AturPin({ pinAda, onSimpan }: Props) {
  const [pin, setPin] = useState("");
  const [ulang, setUlang] = useState("");
  const [galat, setGalat] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  async function simpan() {
    setGalat(null);
    setPesan(null);

    const v = validasiPinBaru(pin);
    if (!v.ok) {
      setGalat(v.pesan);
      return;
    }
    if (pin !== ulang) {
      setGalat("Kedua PIN tidak sama.");
      return;
    }

    setSibuk(true);
    try {
      const hash = await buatHashPin(pin);
      await onSimpan(hash);
      setPin("");
      setUlang("");
      setPesan("PIN admin tersimpan. Jangan lupa PIN-nya.");
    } catch {
      setGalat("PIN belum tersimpan.");
    } finally {
      setSibuk(false);
    }
  }

  async function hapusPin() {
    if (!window.confirm("Hapus PIN admin? Aplikasi akan terbuka sebagai kasir tanpa kunci.")) return;
    setSibuk(true);
    try {
      await onSimpan(null);
      setPesan("PIN dihapus. Aplikasi terbuka sebagai kasir.");
    } finally {
      setSibuk(false);
    }
  }

  return (
    <>
      <div className="content">
        <div className="panel panel--ok">
          {pinAda
            ? "PIN admin sudah diatur. Masukkan PIN baru untuk menggantinya."
            : "Belum ada PIN admin. Aplikasi terbuka dalam mode kasir."}
        </div>

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

        <div>
          <label htmlFor="pin-baru">PIN baru (4–6 angka)</label>
          <input
            id="pin-baru"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/[^\d]/g, ""))}
          />
        </div>

        <div>
          <label htmlFor="pin-ulang">Ulangi PIN</label>
          <input
            id="pin-ulang"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={ulang}
            onChange={(e) => setUlang(e.target.value.replace(/[^\d]/g, ""))}
          />
        </div>

        <p className="hint">
          PIN hanya tersimpan di HP ini sebagai kode acak. PIN tidak mengunci data secara
          terenkripsi — siapa pun yang menguasai HP tetap bisa membuka data.
        </p>

        {pinAda && (
          <button type="button" className="btn btn--ghost btn--small" onClick={hapusPin} disabled={sibuk}>
            Hapus PIN
          </button>
        )}
      </div>

      <div className="bottombar">
        <button
          type="button"
          className="btn btn--primary"
          onClick={simpan}
          disabled={sibuk || pin.length < 4}
        >
          {sibuk ? "Menyimpan…" : "Simpan PIN"}
        </button>
      </div>
    </>
  );
}
