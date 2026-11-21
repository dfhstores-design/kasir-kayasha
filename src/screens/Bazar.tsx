import { useEffect, useState } from "react";
import {
  ambilSettings,
  buatBazar,
  daftarBazar,
  ringkasanBazar,
  ubahPinKasirBazar,
  type BazarRecord,
  type RingkasanBazar,
  type SettingsRecord,
} from "../db/repositori.ts";
import { buatHashPin, pinBedaDariHash, validasiPinBaru } from "../lib/pin.ts";
import { formatRupiah } from "../lib/money.ts";
import { formatTanggal } from "../lib/tanggal.ts";

interface Props {
  onAturBarang: (b: BazarRecord) => void;
  onTutupBazar: (b: BazarRecord) => void;
  onUbah: () => void;
}

/**
 * Layar 15 — Bazar (docs/design/screens/15-bazar.md).
 * Bazar aktif boleh lebih dari satu (18 Nov 2026): tombol Buka Bazar selalu
 * bisa dipakai. Penjualan memakai bazar aktif yang TERAKHIR dibuka —
 * bazar itu ditandai "Bazar penjualan" di daftar bawah.
 */
export default function Bazar({ onAturBarang, onTutupBazar, onUbah }: Props) {
  const [semua, setSemua] = useState<BazarRecord[] | null>(null);
  const [ringkas, setRingkas] = useState<Record<string, RingkasanBazar>>({});
  const [formBuka, setFormBuka] = useState(false);
  const [nama, setNama] = useState("");
  /** Waktu + lokasi bazar (Fase 2C, BU-34): lib sudah mendukung, form yang belum menanyakannya. */
  const [tanggalMulai, setTanggalMulai] = useState("");
  const [tanggalSelesai, setTanggalSelesai] = useState("");
  const [lokasi, setLokasi] = useState("");
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);
  /** PIN kasir bazar baru (Fase 2A, BU-34): satu bazar satu PIN. */
  const [pinBazar, setPinBazar] = useState("");
  const [ulangPinBazar, setUlangPinBazar] = useState("");
  /** Ubah PIN kasir bazar aktif: id bazar yang form-nya terbuka. */
  const [ubahPinUntuk, setUbahPinUntuk] = useState<string | null>(null);
  const [pinBaruUbah, setPinBaruUbah] = useState("");
  const [ulangPinUbah, setUlangPinUbah] = useState("");
  const [pesanUbah, setPesanUbah] = useState<string | null>(null);
  /** Settings (untuk cek PIN bazar tidak sama dengan PIN lain). */
  const [settings, setSettings] = useState<SettingsRecord | null>(null);
  /** Notifikasi tombol placeholder Buka Toko (belum ada fungsi). */
  const [pesan, setPesan] = useState<string | null>(null);

  const [muatUlang, setMuatUlang] = useState(0);

  useEffect(() => {
    let hidup = true;
    (async () => {
      const daftar = await daftarBazar();
      const hasil: Record<string, RingkasanBazar> = {};
      for (const b of daftar) hasil[b.id] = await ringkasanBazar(b.id);
      const s = await ambilSettings().catch(() => null);
      if (!hidup) return;
      setSemua(daftar);
      setRingkas(hasil);
      setSettings(s);
    })().catch(() => {
      if (hidup) setSemua([]);
    });
    return () => {
      hidup = false;
    };
  }, [muatUlang]);

  /** PIN bazar tidak boleh sama dengan PIN admin, owner, atau kasir toko. */
  function pinLain(): Array<string | null> {
    return [settings?.pinHash ?? null, settings?.pinOwnerHash ?? null, settings?.pinKasirTokoHash ?? null];
  }

  // daftarBazar() mengurutkan dari yang terakhir dibuka, jadi aktif[0]
  // adalah bazar penjualan (sama dengan bazarAktif() di repositori).
  const aktifSemua = semua?.filter((b) => b.status === "aktif") ?? [];
  const selesai = semua?.filter((b) => b.status === "selesai") ?? [];

  async function buka() {
    if (nama.trim().length < 2) {
      setGalat("Perbaiki: nama bazar minimal 2 huruf.");
      return;
    }
    // PIN kasir bazar (Fase 2A, BU-34): wajib diisi, wajib beda dengan PIN lain.
    const v = validasiPinBaru(pinBazar);
    if (!v.ok) {
      setGalat(`PIN kasir bazar: ${v.pesan}`);
      return;
    }
    if (pinBazar !== ulangPinBazar) {
      setGalat("Kedua PIN kasir bazar tidak sama.");
      return;
    }
    if (!(await pinBedaDariHash(pinBazar, pinLain()))) {
      setGalat("PIN kasir bazar harus beda dengan PIN admin, PIN owner, dan PIN kasir toko.");
      return;
    }
    if (tanggalMulai && tanggalSelesai && tanggalSelesai < tanggalMulai) {
      setGalat("Perbaiki: tanggal selesai tidak boleh sebelum tanggal mulai.");
      return;
    }
    setSibuk(true);
    try {
      const hash = await buatHashPin(pinBazar);
      await buatBazar(nama.trim(), tanggalMulai || null, tanggalSelesai || null, {
        lokasi: lokasi.trim() || null,
        pinKasirHash: hash,
      });
      setFormBuka(false);
      setNama("");
      setTanggalMulai("");
      setTanggalSelesai("");
      setLokasi("");
      setPinBazar("");
      setUlangPinBazar("");
      setGalat(null);
      setMuatUlang((n) => n + 1);
      onUbah();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Bazar belum terbuka.");
    } finally {
      setSibuk(false);
    }
  }

  /** Mengganti PIN kasir sebuah bazar aktif (hanya admin). */
  async function simpanUbahPin(bazar: BazarRecord) {
    const v = validasiPinBaru(pinBaruUbah);
    if (!v.ok) {
      setGalat(`PIN kasir bazar: ${v.pesan}`);
      return;
    }
    if (pinBaruUbah !== ulangPinUbah) {
      setGalat("Kedua PIN kasir bazar tidak sama.");
      return;
    }
    if (!(await pinBedaDariHash(pinBaruUbah, pinLain()))) {
      setGalat("PIN kasir bazar harus beda dengan PIN admin, PIN owner, dan PIN kasir toko.");
      return;
    }
    setSibuk(true);
    try {
      await ubahPinKasirBazar(bazar.id, await buatHashPin(pinBaruUbah));
      setUbahPinUntuk(null);
      setPinBaruUbah("");
      setUlangPinUbah("");
      setGalat(null);
      setPesanUbah(`PIN kasir bazar "${bazar.nama}" sudah diganti. Beri tahu kasir bazar PIN barunya.`);
      setMuatUlang((n) => n + 1);
    } catch {
      setGalat("PIN kasir bazar belum diganti.");
    } finally {
      setSibuk(false);
    }
  }

  if (semua === null) {
    return (
      <div className="content">
        <p className="soft">Memuat bazar…</p>
      </div>
    );
  }

  return (
    <>
      <div className="content">
        {galat && (
          <div className="panel panel--warn" role="alert">
            {galat}
          </div>
        )}

        {aktifSemua.length > 0 ? (
          aktifSemua.map((b, i) => (
            <div key={b.id} className="card" style={{ borderColor: "var(--accent)", borderWidth: i === 0 ? 2 : 1 }}>
              <span className="soft" style={{ fontWeight: 700, color: "var(--accent-ink)" }}>
                {i === 0 ? "BAZAR PENJUALAN" : "BAZAR AKTIF"}
              </span>
              <p className="h2" style={{ margin: "0.125rem 0" }}>
                {b.nama}
              </p>
              {(b.lokasi || b.mulai || b.selesai) && (
                <p className="soft" style={{ margin: 0 }}>
                  {b.lokasi ? b.lokasi : ""}
                  {b.lokasi && (b.mulai || b.selesai) ? " · " : ""}
                  {b.mulai ? formatTanggal(b.mulai) : ""}
                  {b.mulai && b.selesai ? " – " : ""}
                  {b.selesai ? formatTanggal(b.selesai) : ""}
                </p>
              )}
              <p className="soft" style={{ margin: 0 }}>
                {ringkas[b.id]?.jumlahBarang ?? 0} barang · {ringkas[b.id]?.dibawa ?? 0} pcs dibawa
              </p>
              <p className="soft" style={{ margin: "0.25rem 0 0" }}>
                Terjual {ringkas[b.id]?.terjualPcs ?? 0} pcs · Sisa {ringkas[b.id]?.sisaPcs ?? 0} pcs
              </p>
              {i === 0 && aktifSemua.length > 1 && (
                <p className="soft" style={{ margin: "0.25rem 0 0" }}>
                  Penjualan memakai bazar ini (terakhir dibuka).
                </p>
              )}
              <p className="soft" style={{ margin: "0.25rem 0 0" }}>
                PIN kasir: {b.pinKasirHash ? "sudah diatur" : "belum diatur"}
              </p>
              <div className="grid2" style={{ marginTop: "0.75rem" }}>
                <button type="button" className="btn btn--ghost btn--small" onClick={() => onAturBarang(b)}>
                  Atur Barang
                </button>
                <button type="button" className="btn btn--ghost btn--small" onClick={() => onTutupBazar(b)}>
                  Tutup Bazar
                </button>
              </div>
              {ubahPinUntuk === b.id ? (
                <div style={{ marginTop: "0.75rem" }}>
                  <label htmlFor={`pin-baru-${b.id}`}>PIN kasir baru (4–6 karakter, huruf atau angka)</label>
                  <input
                    id={`pin-baru-${b.id}`}
                    type="password"
                    inputMode="text"
                    autoComplete="off"
                    maxLength={6}
                    value={pinBaruUbah}
                    onChange={(e) => setPinBaruUbah(e.target.value.replace(/[^A-Za-z0-9]/g, ""))}
                  />
                  <label htmlFor={`pin-ulang-${b.id}`}>Ulangi PIN kasir baru</label>
                  <input
                    id={`pin-ulang-${b.id}`}
                    type="password"
                    inputMode="text"
                    autoComplete="off"
                    maxLength={6}
                    value={ulangPinUbah}
                    onChange={(e) => setUlangPinUbah(e.target.value.replace(/[^A-Za-z0-9]/g, ""))}
                  />
                  <div className="grid2" style={{ marginTop: "0.5rem" }}>
                    <button type="button" className="btn btn--ghost btn--small" onClick={() => setUbahPinUntuk(null)}>
                      Batal
                    </button>
                    <button
                      type="button"
                      className="btn btn--primary btn--small"
                      onClick={() => void simpanUbahPin(b)}
                      disabled={sibuk || pinBaruUbah.length < 4}
                    >
                      Simpan PIN
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: "0.5rem" }}>
                  <button
                    type="button"
                    className="btn btn--ghost btn--small"
                    onClick={() => {
                      setUbahPinUntuk(b.id);
                      setPinBaruUbah("");
                      setUlangPinUbah("");
                      setGalat(null);
                    }}
                  >
                    Ubah PIN kasir
                  </button>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="panel panel--ok">
            <strong>Belum ada bazar aktif.</strong>
            <p style={{ margin: "0.25rem 0 0" }}>Penjualan memakai stok gudang.</p>
          </div>
        )}

        {pesanUbah && (
          <div className="panel panel--ok" role="status">
            {pesanUbah}
          </div>
        )}

        {formBuka ? (
          <div className="card">
            <label htmlFor="nama-bazar">Nama bazar</label>
            <input
              id="nama-bazar"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Contoh: Pameran Mall Kelapa Gading, 15–20 Nov"
            />
            <label htmlFor="lokasi-bazar">Lokasi (opsional)</label>
            <input
              id="lokasi-bazar"
              value={lokasi}
              onChange={(e) => setLokasi(e.target.value)}
              placeholder="Contoh: Plaza Senayan, Jakarta"
              autoComplete="off"
            />
            <div className="grid2">
              <div>
                <label htmlFor="mulai-bazar">Mulai (opsional)</label>
                <input id="mulai-bazar" type="date" value={tanggalMulai} onChange={(e) => setTanggalMulai(e.target.value)} />
              </div>
              <div>
                <label htmlFor="selesai-bazar">Selesai (opsional)</label>
                <input
                  id="selesai-bazar"
                  type="date"
                  value={tanggalSelesai}
                  onChange={(e) => setTanggalSelesai(e.target.value)}
                />
              </div>
            </div>
            <label htmlFor="pin-bazar">PIN kasir bazar (4–6 karakter, huruf atau angka)</label>
            <input
              id="pin-bazar"
              type="password"
              inputMode="text"
              autoComplete="off"
              maxLength={6}
              value={pinBazar}
              onChange={(e) => setPinBazar(e.target.value.replace(/[^A-Za-z0-9]/g, ""))}
              placeholder="PIN khusus bazar ini"
            />
            <label htmlFor="pin-bazar-ulang">Ulangi PIN kasir bazar</label>
            <input
              id="pin-bazar-ulang"
              type="password"
              inputMode="text"
              autoComplete="off"
              maxLength={6}
              value={ulangPinBazar}
              onChange={(e) => setUlangPinBazar(e.target.value.replace(/[^A-Za-z0-9]/g, ""))}
            />
            <p className="hint" style={{ margin: "0.25rem 0 0" }}>
              Satu bazar satu PIN. PIN ini harus beda dengan PIN kasir toko, PIN admin, dan PIN owner.
            </p>
            <div className="grid2" style={{ marginTop: "0.75rem" }}>
              <button type="button" className="btn btn--ghost btn--small" onClick={() => setFormBuka(false)}>
                Batal
              </button>
              <button type="button" className="btn btn--primary btn--small" onClick={buka} disabled={sibuk}>
                {sibuk ? "Menyimpan…" : "Simpan"}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid2">
            <button type="button" className="btn btn--primary" onClick={() => setFormBuka(true)}>
              + Buka Bazar
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              style={{ opacity: 0.6 }}
              onClick={() => setPesan("sedang dalam pengembangan")}
            >
              Buka Toko · Segera
            </button>
          </div>
        )}

        {pesan && (
          <div className="panel panel--ok" role="status" style={{ marginTop: "0.5rem" }}>
            {pesan}
          </div>
        )}

        {selesai.length > 0 && (
          <>
            <span className="label" style={{ marginTop: "0.5rem" }}>
              Bazar yang sudah selesai
            </span>
            {selesai.map((b) => (
              <div key={b.id} className="listrow">
                <div style={{ flex: 1 }}>
                  <strong>{b.nama}</strong>
                  <div className="soft" style={{ fontSize: "0.95rem" }}>
                    {b.ditutupPada ? `Ditutup ${formatTanggal(b.ditutupPada)} · ` : ""}
                    {b.ringkasanTerjual ?? 0} pcs terjual
                  </div>
                  <div className="soft" style={{ fontSize: "0.95rem" }}>
                    {formatRupiah(ringkas[b.id]?.uangMasuk ?? 0)} · {b.ringkasanSisa ?? 0} pcs dikembalikan
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {semua.length === 0 && !formBuka && (
          <p className="soft" style={{ margin: 0 }}>
            Belum ada bazar.
          </p>
        )}
      </div>
    </>
  );
}
