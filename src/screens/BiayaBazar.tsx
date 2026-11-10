import { useState } from "react";
import { KATEGORI_BIAYA, type BazarRecord, type BiayaBazarRecord, type KategoriBiaya } from "../db/schema.ts";
import { formatRupiah, parseRupiah } from "../lib/money.ts";
import { dalamRupiah } from "../lib/ketikUang.ts";
import { formatTanggal } from "../lib/tanggal.ts";
import { hitungRingkasanKeuangan, labelKategori } from "../lib/bazar.ts";
import { tambahBiaya, hapusBiaya } from "../db/repositori.ts";
import type { Peran } from "../lib/peran.ts";

interface Props {
  bazar: BazarRecord;
  biaya: BiayaBazarRecord[];
  peran: Peran;
  onUbah: () => void;
}

const hariIni = () => new Date().toISOString().slice(0, 10);

/**
 * Biaya bazar (ROLE-BIAYA-RINGKASAN.md bagian 3).
 * Hanya admin yang boleh mencatat/menghapus. Kasir melihat panel penjelasan.
 */
export default function BiayaBazar({ bazar, biaya, peran, onUbah }: Props) {
  const [formBuka, setFormBuka] = useState(false);
  const [kategori, setKategori] = useState<KategoriBiaya>("sewa_booth");
  const [judul, setJudul] = useState("");
  const [nominal, setNominal] = useState("");
  const [tanggal, setTanggal] = useState(hariIni());
  const [catatan, setCatatan] = useState("");
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  if (peran !== "admin") {
    return (
      <div className="content">
        <div className="panel panel--warn">
          Fitur ini untuk admin. Ketuk &quot;Masuk sebagai Admin&quot; di beranda.
        </div>
      </div>
    );
  }

  const ringkas = hitungRingkasanKeuangan([], biaya.map((b) => ({ kategori: b.kategori, judul: b.judul, nominal: b.nominal, tanggal: b.tanggal })));

  async function simpan() {
    setGalat(null);
    const n = parseRupiah(nominal);
    if (!n.ok || n.value <= 0) {
      setGalat("Nominal harus lebih dari 0.");
      return;
    }
    setSibuk(true);
    const h = await tambahBiaya(bazar.id, {
      kategori,
      judul: judul.trim(),
      nominal: n.value,
      tanggal,
      catatan: catatan.trim() || null,
    });
    setSibuk(false);
    if (!h.ok) {
      setGalat(h.pesan);
      return;
    }
    setJudul("");
    setNominal("");
    setCatatan("");
    setFormBuka(false);
    onUbah();
  }

  async function hapus(b: BiayaBazarRecord) {
    if (!window.confirm(`Hapus biaya "${b.judul}" ${formatRupiah(b.nominal)}?`)) return;
    await hapusBiaya(b.id);
    onUbah();
  }

  return (
    <>
      <div className="content">
        <p className="soft" style={{ margin: 0 }}>
          {bazar.nama}
        </p>

        {galat && (
          <div className="panel panel--warn" role="alert">
            {galat}
          </div>
        )}

        <div className="card">
          <div className="ringkas">
            <span>Total biaya</span>
            <span className="money">{formatRupiah(ringkas.totalBiaya)}</span>
          </div>
          {ringkas.biayaPerKategori.map((r) => (
            <div key={r.kategori} className="ringkas soft">
              <span>{labelKategori(r.kategori)}</span>
              <span>{formatRupiah(r.total)}</span>
            </div>
          ))}
        </div>

        {biaya.length === 0 && <p className="soft">Belum ada biaya dicatat.</p>}

        {biaya.map((b) => (
          <div key={b.id} className="card">
            <div className="ringkas">
              <strong>{b.judul}</strong>
              <span className="money">{formatRupiah(b.nominal)}</span>
            </div>
            <div className="soft" style={{ fontSize: "0.95rem" }}>
              {labelKategori(b.kategori)} · {formatTanggal(b.tanggal)}
            </div>
            {b.catatan && (
              <div className="soft" style={{ fontSize: "0.95rem" }}>
                {b.catatan}
              </div>
            )}
            <button
              type="button"
              className="btn btn--ghost btn--small"
              style={{ marginTop: "0.5rem" }}
              onClick={() => hapus(b)}
            >
              Hapus
            </button>
          </div>
        ))}

        {formBuka && (
          <div className="card">
            <span className="label">Kategori</span>
            <div className="pilihan">
              {KATEGORI_BIAYA.map((k) => (
                <button
                  key={k}
                  type="button"
                  className="pilihan__item"
                  aria-pressed={kategori === k}
                  onClick={() => setKategori(k)}
                >
                  {labelKategori(k)}
                </button>
              ))}
            </div>

            <div style={{ marginTop: "0.75rem" }}>
              <label htmlFor="judul-biaya">Judul</label>
              <input
                id="judul-biaya"
                value={judul}
                onChange={(e) => setJudul(e.target.value)}
                placeholder="Contoh: Sewa booth Blok C"
              />
            </div>

            <div style={{ marginTop: "0.75rem" }}>
              <label htmlFor="nominal-biaya">Nominal</label>
              <input
                id="nominal-biaya"
                inputMode="numeric"
                value={nominal}
                onChange={(e) => setNominal(dalamRupiah(e.target.value))}
                placeholder="Rp 2.500.000"
              />
            </div>

            <div style={{ marginTop: "0.75rem" }}>
              <label htmlFor="tanggal-biaya">Tanggal</label>
              <input
                id="tanggal-biaya"
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
              />
            </div>

            <div style={{ marginTop: "0.75rem" }}>
              <label htmlFor="catatan-biaya">Catatan (opsional)</label>
              <input id="catatan-biaya" value={catatan} onChange={(e) => setCatatan(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      <div className="bottombar">
        {formBuka ? (
          <div className="grid2">
            <button type="button" className="btn btn--ghost btn--small" onClick={() => setFormBuka(false)}>
              Batal
            </button>
            <button type="button" className="btn btn--primary btn--small" onClick={simpan} disabled={sibuk}>
              {sibuk ? "Menyimpan…" : "Simpan"}
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn--primary" onClick={() => setFormBuka(true)}>
            + Tambah Biaya
          </button>
        )}
      </div>
    </>
  );
}
