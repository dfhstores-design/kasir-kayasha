import { useState } from "react";
import { buatHashPin, pinBedaDariHash, validasiPinBaru } from "../lib/pin.ts";

/**
 * PIN apa yang diatur (Fase 2A, BU-32/34). PIN admin, PIN owner, dan PIN
 * kasir toko adalah tiga PIN berbeda yang tidak boleh sama.
 */
export type PeranPin = "admin" | "owner" | "kasir-toko";

const LABEL: Record<PeranPin, { nama: string; hapus: string; tersimpan: string }> = {
  admin: {
    nama: "admin",
    hapus: "Hapus PIN admin? Aplikasi akan terbuka sebagai kasir tanpa kunci.",
    tersimpan: "PIN admin tersimpan. Jangan lupa PIN-nya.",
  },
  owner: {
    nama: "owner",
    hapus: "Hapus PIN owner? Laporan owner tidak akan terkunci.",
    tersimpan: "PIN owner tersimpan. Jangan lupa PIN-nya.",
  },
  "kasir-toko": {
    nama: "kasir toko",
    hapus: "Hapus PIN kasir toko? Kasir toko bisa masuk tanpa PIN.",
    tersimpan: "PIN kasir toko tersimpan. Beri tahu kasir toko PIN barunya.",
  },
};

interface Props {
  peran: PeranPin;
  pinAda: boolean;
  /**
   * Hash PIN lain yang tidak boleh sama dengan PIN baru ini (mis. saat
   * mengatur PIN owner, isi dengan hash PIN admin). Kosong = tidak dicek.
   */
  hashLain?: Array<string | null>;
  onSimpan: (hash: string | null) => Promise<void>;
}

/**
 * Pengaturan PIN (ROLE-BIAYA-RINGKASAN.md 1.1; Fase 2A BU-32/34).
 * Hanya bisa diakses pemegang peran yang bersangkutan. PIN tidak pernah
 * ditampilkan kembali.
 */
export default function AturPin({ peran, pinAda, hashLain = [], onSimpan }: Props) {
  const [pin, setPin] = useState("");
  const [ulang, setUlang] = useState("");
  const [galat, setGalat] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  const label = LABEL[peran];

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
    // PIN admin ≠ PIN owner ≠ PIN kasir toko ≠ PIN kasir bazar (BU-32/34).
    if (!(await pinBedaDariHash(pin, hashLain))) {
      setGalat(`PIN ${label.nama} harus beda dengan PIN yang lain.`);
      return;
    }

    setSibuk(true);
    try {
      const hash = await buatHashPin(pin);
      await onSimpan(hash);
      setPin("");
      setUlang("");
      setPesan(label.tersimpan);
    } catch {
      setGalat("PIN belum tersimpan.");
    } finally {
      setSibuk(false);
    }
  }

  async function hapusPin() {
    if (!window.confirm(label.hapus)) return;
    setSibuk(true);
    try {
      await onSimpan(null);
      setPesan("PIN dihapus.");
    } finally {
      setSibuk(false);
    }
  }

  return (
    <>
      <div className="content">
        <div className="panel panel--ok">
          {pinAda
            ? `PIN ${label.nama} sudah diatur. Masukkan PIN baru untuk menggantinya.`
            : `Belum ada PIN ${label.nama}.`}
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
