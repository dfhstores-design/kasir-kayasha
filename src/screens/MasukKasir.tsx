import { useEffect, useState } from "react";
import { ambilSettings, daftarBazarAktif, type BazarRecord } from "../db/repositori.ts";
import { batasPercobaan, cocokPin, MAKS_PERCOBAAN_PIN } from "../lib/pin.ts";
import type { LokasiKasir } from "../lib/peran.ts";

interface Props {
  /** Lokasi kasir yang sedang aktif di perangkat ini (bila ada). */
  lokasiAktif: LokasiKasir | null;
  onMasuk: (lokasi: LokasiKasir) => void;
  onKeluarLokasi: () => void;
  onBatal: () => void;
}

interface PilihanLokasi {
  kunci: string;
  label: string;
  pinHash: string | null;
  lokasi: LokasiKasir;
}

/**
 * Masuk sebagai kasir di satu lokasi (Fase 2A, BU-34).
 *
 * 1 lokasi = 1 kasir. Kasir memilih lokasi (Toko atau satu bazar aktif)
 * lalu memasukkan PIN lokasi itu. PIN kasir toko wajib beda dengan PIN
 * kasir tiap bazar (dicek saat PIN diatur, bukan di sini).
 *
 * Bila PIN lokasi belum diatur, kasir boleh masuk sekali tanpa PIN —
 * pola yang sama dengan bootstrap PIN admin — dan layar mengingatkan
 * supaya admin mengatur PIN lokasi itu.
 */
export default function MasukKasir({ lokasiAktif, onMasuk, onKeluarLokasi, onBatal }: Props) {
  const [pilihan, setPilihan] = useState<PilihanLokasi[] | null>(null);
  const [terpilih, setTerpilih] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [galat, setGalat] = useState<string | null>(null);
  const [percobaan, setPercobaan] = useState(0);
  const [gagalPada, setGagalPada] = useState<number | null>(null);
  const [sekarang, setSekarang] = useState(() => Date.now());
  const [sibuk, setSibuk] = useState(false);

  useEffect(() => {
    let hidup = true;
    (async () => {
      const [settings, bazarAktif] = await Promise.all([ambilSettings(), daftarBazarAktif()]);
      if (!hidup) return;
      const daftar: PilihanLokasi[] = [
        { kunci: "toko", label: "Toko (Butik)", pinHash: settings.pinKasirTokoHash ?? null, lokasi: { jenis: "toko" } },
        ...bazarAktif.map((b: BazarRecord) => ({
          kunci: `bazar:${b.id}`,
          label: `Bazar: ${b.nama}`,
          pinHash: b.pinKasirHash ?? null,
          lokasi: { jenis: "bazar", bazarId: b.id, nama: b.nama } as LokasiKasir,
        })),
      ];
      setPilihan(daftar);
    })().catch(() => {
      if (hidup) setPilihan([]);
    });
    return () => {
      hidup = false;
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setSekarang(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const kunci = batasPercobaan(percobaan, gagalPada, sekarang);
  const lokasiTerpilih = pilihan?.find((p) => p.kunci === terpilih) ?? null;

  async function masuk() {
    if (!lokasiTerpilih || kunci.terkunci) return;
    // PIN lokasi belum diatur: masuk sekali tanpa PIN (bootstrap).
    if (!lokasiTerpilih.pinHash) {
      onMasuk(lokasiTerpilih.lokasi);
      return;
    }
    setSibuk(true);
    const cocok = await cocokPin(pin, lokasiTerpilih.pinHash);
    setSibuk(false);
    if (cocok) {
      setPin("");
      setPercobaan(0);
      setGagalPada(null);
      setGalat(null);
      onMasuk(lokasiTerpilih.lokasi);
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
  }

  if (pilihan === null) {
    return (
      <div className="content">
        <p className="soft">Memuat lokasi…</p>
      </div>
    );
  }

  return (
    <>
      <div className="content">
        <p className="h2" style={{ margin: 0 }}>
          Masuk sebagai Kasir
        </p>
        <p className="soft" style={{ margin: 0 }}>
          Pilih lokasi, lalu masukkan PIN kasir lokasi itu. Satu lokasi hanya satu kasir.
        </p>

        {lokasiAktif && (
          <div className="panel panel--ok">
            Kasir sedang masuk di: <strong>{lokasiAktif.jenis === "toko" ? "Toko (Butik)" : `Bazar: ${lokasiAktif.nama}`}</strong>
            <div style={{ marginTop: "0.5rem" }}>
              <button type="button" className="btn btn--ghost btn--small" onClick={onKeluarLokasi}>
                Keluar dari lokasi
              </button>
            </div>
          </div>
        )}

        {galat && (
          <div className="panel panel--warn" role="alert">
            {galat}
            {kunci.terkunci && ` (${kunci.sisaDetik} detik lagi)`}
          </div>
        )}

        <div className="tiles" role="group" aria-label="Pilih lokasi kasir">
          {pilihan.map((p) => (
            <button
              key={p.kunci}
              type="button"
              className="tile"
              aria-pressed={terpilih === p.kunci}
              style={terpilih === p.kunci ? { borderColor: "var(--accent)", borderWidth: 2 } : undefined}
              onClick={() => {
                setTerpilih(p.kunci);
                setPin("");
                setGalat(null);
              }}
            >
              {p.label}
              <span className="tile__sub">{p.pinHash ? "PIN diatur" : "PIN belum diatur"}</span>
            </button>
          ))}
        </div>

        {pilihan.length === 0 && <p className="soft">Belum ada lokasi kasir. Minta admin membuka bazar.</p>}

        {lokasiTerpilih && lokasiTerpilih.pinHash && (
          <div>
            <label htmlFor="pin-kasir">PIN kasir {lokasiTerpilih.label}</label>
            <input
              id="pin-kasir"
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
        )}

        {lokasiTerpilih && !lokasiTerpilih.pinHash && (
          <p className="hint" style={{ margin: 0 }}>
            PIN kasir lokasi ini belum diatur — bisa masuk tanpa PIN sekali ini. Minta admin mengatur PIN-nya.
          </p>
        )}
      </div>

      <div className="bottombar">
        <button
          type="button"
          className="btn btn--primary"
          onClick={masuk}
          disabled={!lokasiTerpilih || sibuk || kunci.terkunci || (!!lokasiTerpilih?.pinHash && pin.length < 4)}
        >
          {sibuk ? "Memeriksa…" : "Masuk sebagai Kasir"}
        </button>
        <button type="button" className="btn btn--ghost btn--small" onClick={onBatal}>
          Kembali
        </button>
      </div>
    </>
  );
}
