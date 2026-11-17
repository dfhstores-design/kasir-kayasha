import { useMemo, useState } from "react";
import { formatRupiah, parseRupiah } from "../lib/money.ts";
import { dalamRupiah } from "../lib/ketikUang.ts";
import {
  bacaBiayaLainTersimpan,
  periksaRencanaJahitan,
  type BiayaLainInput,
  type RencanaJahitan,
} from "../lib/jahitan.ts";

interface Props {
  sibuk: boolean;
  pesanGalat: string | null;
  onSimpan: (rencana: RencanaJahitan) => void;
  onBatal: () => void;
}

type Langkah = 1 | 2 | 3 | 4;

type BiayaLainTerenun = BiayaLainInput & { tersimpan: boolean };

/**
 * Wizard input pesanan jahit (BU-22.A): langkah berurutan, satu pertanyaan per layar,
 * teks besar dan tombol besar agar Tante (>62 th) cukup melihat & mengetuk.
 *
 * Langkah:
 *   1. nama pemesan + kontak
 *   2. model/jenis + ukuran + perkiraan selesai
 *   3. biaya jasa + biaya lain (BU-15; nama yang pernah dipakai ditawarkan kembali)
 *   4. ringkas & simpan
 */
export default function WizardPesananJahit({ sibuk, pesanGalat, onSimpan, onBatal }: Props) {
  const [langkah, setLangkah] = useState<Langkah>(1);
  const [galat, setGalat] = useState<string | null>(null);

  const [nama, setNama] = useState("");
  const [kontak, setKontak] = useState("");
  const [model, setModel] = useState("");
  const [ukuran, setUkuran] = useState("");
  const [perkiraan, setPerkiraan] = useState("");
  const [biayaJasaTeks, setBiayaJasaTeks] = useState("");
  const [catatan, setCatatan] = useState("");
  const [biayaLain, setBiayaLain] = useState<BiayaLainTerenun[]>([]);

  const biayaJasaAngka = parseRupiah(biayaJasaTeks);

  const tersimpan = useMemo(() => bacaBiayaLainTersimpan(), []);

  const rencana: RencanaJahitan = {
    namaPemesan: nama.trim(),
    kontak: kontak.trim() || null,
    model: model.trim(),
    ukuran: ukuran.trim() || null,
    perkiraanSelesai: perkiraan || null,
    catatan: catatan.trim() || null,
    biayaJasa: biayaJasaAngka.ok ? biayaJasaAngka.value : 0,
    biayaLain: biayaLain
      .filter((b) => b.nama.trim().length > 0)
      .map((b) => ({ nama: b.nama.trim(), nominal: b.nominal })),
  };

  const totalBiayaLain = biayaLain.reduce((n, b) => n + (b.nama.trim() ? b.nominal : 0), 0);
  const totalKeseluruhan = (biayaJasaAngka.ok ? biayaJasaAngka.value : 0) + totalBiayaLain;

  function lanjut() {
    setGalat(null);
    if (langkah === 1 && nama.trim().length < 2) {
      setGalat("Isi nama pemesan dulu, Tante.");
      return;
    }
    if (langkah === 2 && model.trim().length < 2) {
      setGalat("Isi model atau jenis jahitan.");
      return;
    }
    if (langkah === 3 && (!biayaJasaAngka.ok || biayaJasaAngka.value <= 0)) {
      setGalat("Isi biaya jasa (angka lebih dari 0).");
      return;
    }
    setLangkah((l) => (l + 1) as Langkah);
  }

  function mundur() {
    setGalat(null);
    setLangkah((l) => Math.max(1, l - 1) as Langkah);
  }

  function pilihBiayaTersimpan(nama: string) {
    setBiayaLain((d) => {
      if (d.some((b) => b.nama === nama)) return d;
      return [...d, { nama, nominal: 0, tersimpan: true }];
    });
  }

  function ubahBiayaLain(index: number, patch: Partial<BiayaLainTerenun>) {
    setBiayaLain((d) => d.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  }

  function hapusBiayaLain(index: number) {
    setBiayaLain((d) => d.filter((_, i) => i !== index));
  }

  function simpan() {
    setGalat(null);
    const cek = periksaRencanaJahitan(rencana);
    if (!cek.ok) {
      setGalat(cek.pesan);
      return;
    }
    onSimpan(rencana);
  }

  return (
    <>
      <div className="content">
        {/* Langkah berapa dari 4 */}
        <div className="status" role="status">
          <span className="dot" aria-hidden="true" />
          <span>Langkah {langkah} dari 4</span>
        </div>

        {(galat || pesanGalat) && (
          <div className="panel panel--warn" role="alert">
            {galat ?? pesanGalat}
          </div>
        )}

        {langkah === 1 && (
          <div>
            <p className="h1">Siapa yang memesan?</p>
            <p className="soft">Tulis nama dan nomor WhatsApp pelanggan (boleh kosong).</p>
            <div style={{ marginTop: "0.75rem" }}>
              <label htmlFor="jht-nama">Nama pemesan</label>
              <input
                id="jht-nama"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="Contoh: Ibu Sari"
                autoComplete="off"
              />
            </div>
            <div style={{ marginTop: "0.75rem" }}>
              <label htmlFor="jht-kontak">WhatsApp / telepon (opsional)</label>
              <input
                id="jht-kontak"
                inputMode="tel"
                value={kontak}
                onChange={(e) => setKontak(e.target.value)}
                placeholder="Contoh: 0812 0000 0000"
                autoComplete="off"
              />
            </div>
          </div>
        )}

        {langkah === 2 && (
          <div>
            <p className="h1">Jahit apa?</p>
            <p className="soft">Model atau jenis, ukuran, dan perkiraan selesai.</p>
            <div style={{ marginTop: "0.75rem" }}>
              <label htmlFor="jht-model">Model / jenis</label>
              <input
                id="jht-model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Contoh: Gaun pesta"
                autoComplete="off"
              />
            </div>
            <div style={{ marginTop: "0.75rem" }}>
              <label htmlFor="jht-ukuran">Ukuran (opsional)</label>
              <input
                id="jht-ukuran"
                value={ukuran}
                onChange={(e) => setUkuran(e.target.value)}
                placeholder="Contoh: M"
                autoComplete="off"
              />
            </div>
            <div style={{ marginTop: "0.75rem" }}>
              <label htmlFor="jht-perkiraan">Perkiraan selesai (opsional)</label>
              <input
                id="jht-perkiraan"
                type="date"
                value={perkiraan}
                onChange={(e) => setPerkiraan(e.target.value)}
              />
            </div>
          </div>
        )}

        {langkah === 3 && (
          <div>
            <p className="h1">Berapa biayanya?</p>
            <p className="soft">Biaya jasa wajib. Biaya lain boleh ditambah.</p>
            <div style={{ marginTop: "0.75rem" }}>
              <label htmlFor="jht-jasa">Biaya jasa</label>
              <input
                id="jht-jasa"
                inputMode="numeric"
                placeholder="Rp 0"
                value={biayaJasaTeks}
                onChange={(e) => setBiayaJasaTeks(dalamRupiah(e.target.value))}
              />
              {biayaJasaAngka.ok && (
                <p className="hint" role="status">
                  {formatRupiah(biayaJasaAngka.value)}
                </p>
              )}
            </div>

            <div className="card" style={{ marginTop: "0.75rem" }}>
              <span className="label" style={{ display: "block", marginBottom: "0.5rem" }}>
                Biaya lain (opsional)
              </span>

              {tersimpan.length > 0 && (
                <div className="pilihan" style={{ marginBottom: "0.5rem" }}>
                  {tersimpan.map((b) => (
                    <button
                      key={b.nama}
                      type="button"
                      className="pilihan__item"
                      onClick={() => pilihBiayaTersimpan(b.nama)}
                    >
                      + {b.nama}
                    </button>
                  ))}
                </div>
              )}

              {biayaLain.map((b, i) => (
                <div key={i} className="ringkas" style={{ marginBottom: "0.5rem", alignItems: "center" }}>
                  <input
                    aria-label="Nama biaya lain"
                    placeholder="Nama biaya"
                    value={b.nama}
                    onChange={(e) => ubahBiayaLain(i, { nama: e.target.value })}
                    style={{ flex: 1 }}
                  />
                  <input
                    aria-label="Nominal biaya lain"
                    inputMode="numeric"
                    placeholder="Rp 0"
                    value={b.nominal === 0 ? "" : b.nominal.toLocaleString("id-ID")}
                    onChange={(e) => {
                      const p = parseRupiah(e.target.value);
                      ubahBiayaLain(i, { nominal: p.ok ? p.value : 0 });
                    }}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn btn--ghost btn--small"
                    style={{ minHeight: "3rem", padding: "0 0.75rem" }}
                    onClick={() => hapusBiayaLain(i)}
                    aria-label="Hapus biaya ini"
                  >
                    ✕
                  </button>
                </div>
              ))}

              <button
                type="button"
                className="btn btn--ghost btn--small"
                style={{ width: "100%" }}
                onClick={() => setBiayaLain((d) => [...d, { nama: "", nominal: 0, tersimpan: false }])}
              >
                + Tambah biaya lain
              </button>
            </div>
          </div>
        )}

        {langkah === 4 && (
          <div>
            <p className="h1">Periksa lagi</p>
            <p className="soft">Yang akan disimpan:</p>
            <div className="card">
              <div className="ringkas">
                <span className="soft">Pemesan</span>
                <strong>{nama}</strong>
              </div>
              {kontak && (
                <div className="ringkas" style={{ marginTop: "0.25rem" }}>
                  <span className="soft">Kontak</span>
                  <span>{kontak}</span>
                </div>
              )}
              <div className="ringkas" style={{ marginTop: "0.25rem" }}>
                <span className="soft">Model</span>
                <span>{model}</span>
              </div>
              {ukuran && (
                <div className="ringkas" style={{ marginTop: "0.25rem" }}>
                  <span className="soft">Ukuran</span>
                  <span>{ukuran}</span>
                </div>
              )}
              {perkiraan && (
                <div className="ringkas" style={{ marginTop: "0.25rem" }}>
                  <span className="soft">Perkiraan selesai</span>
                  <span>{perkiraan}</span>
                </div>
              )}
              <div className="hr" style={{ height: 1, background: "var(--line)", margin: "0.5rem 0" }} />
              <div className="ringkas">
                <span className="soft">Biaya jasa</span>
                <span>{formatRupiah(biayaJasaAngka.ok ? biayaJasaAngka.value : 0)}</span>
              </div>
              {biayaLain.filter((b) => b.nama.trim()).map((b, i) => (
                <div className="ringkas" key={i} style={{ marginTop: "0.25rem" }}>
                  <span className="soft">{b.nama}</span>
                  <span>{formatRupiah(b.nominal)}</span>
                </div>
              ))}
              <div className="hr" style={{ height: 1, background: "var(--line)", margin: "0.5rem 0" }} />
              <div className="ringkas">
                <strong>TOTAL</strong>
                <strong className="money" style={{ fontSize: "1.375rem" }}>
                  {formatRupiah(totalKeseluruhan)}
                </strong>
              </div>
            </div>

            <div style={{ marginTop: "0.75rem" }}>
              <label htmlFor="jht-catatan">Catatan (opsional)</label>
              <input
                id="jht-catatan"
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>
        )}
      </div>

      <div className="bottombar">
        {langkah < 4 ? (
          <button type="button" className="btn btn--primary" onClick={lanjut}>
            Lanjut
          </button>
        ) : (
          <button type="button" className="btn btn--primary" onClick={simpan} disabled={sibuk}>
            {sibuk ? "Menyimpan…" : "Simpan Pesanan"}
          </button>
        )}

        <div className="grid2">
          {langkah > 1 ? (
            <button type="button" className="btn btn--ghost btn--small" onClick={mundur}>
              Kembali
            </button>
          ) : (
            <button type="button" className="btn btn--ghost btn--small" onClick={onBatal}>
              Batal
            </button>
          )}
        </div>
      </div>
    </>
  );
}