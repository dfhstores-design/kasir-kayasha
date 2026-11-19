import { useMemo, useState } from "react";
import { formatRupiah, parseRupiah } from "../lib/money.ts";
import { dalamRupiah } from "../lib/ketikUang.ts";
import {
  bacaBiayaLainTersimpan,
  periksaRencanaJahitan,
  type BiayaLainInput,
  type RencanaJahitan,
} from "../lib/jahitan.ts";
import { bacaModeInput, KUNCI_MODE_INPUT, type ModeInput } from "../lib/modeInput.ts";

interface Props {
  sibuk: boolean;
  pesanGalat: string | null;
  onSimpan: (rencana: RencanaJahitan) => void;
  onBatal: () => void;
}

type Langkah = 1 | 2 | 3 | 4;

type BiayaLainTerenun = BiayaLainInput & { tersimpan: boolean };

/**
 * Input pesanan jahit (BU-22): dua mode yang bisa diganti-ganti, isian dipakai
 * bersama — teks besar dan tombol besar agar Tante (>62 th) cukup melihat
 * & mengetuk.
 *
 * Mode wizard (BU-22.A): langkah berurutan, satu pertanyaan per layar.
 *   1. nama pemesan + kontak
 *   2. item jahitan (BU-55: bisa banyak — nama + harga + jumlah) + ukuran + perkiraan selesai
 *   3. biaya lain (BU-15; nama yang pernah dipakai ditawarkan kembali)
 *   4. ringkas & simpan
 * Mode satu layar: keempat bagian di atas tampil sekaligus di satu layar
 * yang bisa digulir, dengan satu tombol Simpan Pesanan.
 * Bawaan sejak 19 Nov 2026: satu layar (keputusan Tante, "Menggunakan
 * 1 layar"); wizard tetap bisa dipilih lewat tombol ganti mode atau
 * param URL ?mode=wizard.
 */

interface ItemTerenun {
  nama: string;
  hargaTeks: string;
  kuantitas: number;
}
export default function WizardPesananJahit({ sibuk, pesanGalat, onSimpan, onBatal }: Props) {
  const [langkah, setLangkah] = useState<Langkah>(1);
  const [galat, setGalat] = useState<string | null>(null);

  // Mode input (BU-22): wizard atau satu layar. Mode awal dari param URL
  // (?mode=wizard / ?mode=satu-layar, untuk link pembanding), lalu pilihan
  // terakhir yang tersimpan, bawaan wizard. Ganti mode tidak menghapus
  // isian — semua state form dipakai bersama kedua mode.
  const [mode, setMode] = useState<ModeInput>(() => {
    let tersimpan: string | null = null;
    try {
      tersimpan = localStorage.getItem(KUNCI_MODE_INPUT);
    } catch {
      // localStorage tidak tersedia: pakai bawaan.
    }
    return bacaModeInput(window.location.search, tersimpan);
  });

  function gantiMode(m: ModeInput) {
    setMode(m);
    try {
      localStorage.setItem(KUNCI_MODE_INPUT, m);
    } catch {
      // localStorage tidak tersedia: mode tetap jalan untuk sesi ini.
    }
  }

  /** Bagian yang tampil: satu langkah di mode wizard, semuanya di mode satu layar. */
  function tampil(n: Langkah): boolean {
    return mode === "satu-layar" || langkah === n;
  }

  const [nama, setNama] = useState("");
  const [kontak, setKontak] = useState("");
  const [items, setItems] = useState<ItemTerenun[]>([{ nama: "", hargaTeks: "", kuantitas: 1 }]);
  const [ukuran, setUkuran] = useState("");
  const [perkiraan, setPerkiraan] = useState("");
  const [catatan, setCatatan] = useState("");
  const [biayaLain, setBiayaLain] = useState<BiayaLainTerenun[]>([]);

  const itemsAngka = items.map((i) => {
    const p = parseRupiah(i.hargaTeks);
    return { nama: i.nama.trim(), harga: p.ok ? p.value : 0, kuantitas: i.kuantitas };
  });
  const itemsValid = itemsAngka.filter((i) => i.nama.length >= 2 && i.harga > 0);
  const subtotalItems = itemsValid.reduce((n, i) => n + i.harga * (i.kuantitas >= 1 ? i.kuantitas : 1), 0);

  const tersimpan = useMemo(() => bacaBiayaLainTersimpan(), []);

  const rencana: RencanaJahitan = {
    namaPemesan: nama.trim(),
    kontak: kontak.trim() || null,
    items: itemsValid.map((i) => ({ nama: i.nama, harga: i.harga, kuantitas: i.kuantitas >= 1 ? i.kuantitas : 1 })),
    ukuran: ukuran.trim() || null,
    perkiraanSelesai: perkiraan || null,
    catatan: catatan.trim() || null,
    biayaLain: biayaLain
      .filter((b) => b.nama.trim().length > 0)
      .map((b) => ({ nama: b.nama.trim(), nominal: b.nominal })),
  };

  const totalBiayaLain = biayaLain.reduce((n, b) => n + (b.nama.trim() ? b.nominal : 0), 0);
  const totalKeseluruhan = subtotalItems + totalBiayaLain;

  function ubahItem(index: number, patch: Partial<ItemTerenun>) {
    setItems((d) => d.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function hapusItem(index: number) {
    setItems((d) => (d.length > 1 ? d.filter((_, i) => i !== index) : d));
  }

  function lanjut() {
    setGalat(null);
    if (langkah === 1 && nama.trim().length < 2) {
      setGalat("Isi nama pemesan dulu, Tante.");
      return;
    }
    if (langkah === 2 && itemsValid.length < 1) {
      setGalat("Isi minimal satu item: nama + harga.");
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
      <div
        className="content"
        style={mode === "satu-layar" ? { display: "flex", flexDirection: "column", gap: "1.5rem" } : undefined}
      >
        {/* Mode input + tombol ganti mode (BU-22) */}
        <div className="status" role="status">
          <span className="dot" aria-hidden="true" />
          <span>{mode === "wizard" ? `Langkah ${langkah} dari 4` : "Satu layar — semua isian"}</span>
          <button
            type="button"
            className="btn btn--ghost btn--small"
            style={{ marginLeft: "auto" }}
            onClick={() => gantiMode(mode === "wizard" ? "satu-layar" : "wizard")}
          >
            {mode === "wizard" ? "Ubah ke 1 layar" : "Ubah ke langkah"}
          </button>
        </div>

        {(galat || pesanGalat) && (
          <div className="panel panel--warn" role="alert">
            {galat ?? pesanGalat}
          </div>
        )}

        {tampil(1) && (
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

        {tampil(2) && (
          <div>
            <p className="h1">Jahit apa?</p>
            <p className="soft">Satu pesanan boleh berisi banyak item — tulis nama & harga tiap item.</p>

            {items.map((it, i) => {
              const p = parseRupiah(it.hargaTeks);
              return (
                <div key={i} className="card" style={{ marginTop: "0.75rem" }}>
                  <div>
                    <label htmlFor={`jht-item-${i}`}>Nama item {items.length > 1 ? i + 1 : ""}</label>
                    <input
                      id={`jht-item-${i}`}
                      value={it.nama}
                      onChange={(e) => ubahItem(i, { nama: e.target.value })}
                      placeholder="Contoh: Gaun pesta"
                      autoComplete="off"
                    />
                  </div>
                  <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
                    <div style={{ flex: 2 }}>
                      <label htmlFor={`jht-harga-${i}`}>Harga</label>
                      <input
                        id={`jht-harga-${i}`}
                        inputMode="numeric"
                        placeholder="Rp 0"
                        value={it.hargaTeks}
                        onChange={(e) => ubahItem(i, { hargaTeks: dalamRupiah(e.target.value) })}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label htmlFor={`jht-jumlah-${i}`}>Jumlah</label>
                      <input
                        id={`jht-jumlah-${i}`}
                        inputMode="numeric"
                        value={it.kuantitas}
                        onChange={(e) => {
                          const n = parseInt(e.target.value.replace(/[^0-9]/g, ""), 10);
                          ubahItem(i, { kuantitas: Number.isFinite(n) && n >= 1 ? n : 1 });
                        }}
                      />
                    </div>
                    {items.length > 1 && (
                      <button
                        type="button"
                        className="btn btn--ghost btn--small"
                        style={{ minHeight: "3rem", padding: "0 0.75rem" }}
                        onClick={() => hapusItem(i)}
                        aria-label="Hapus item ini"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  {p.ok && p.value > 0 && (
                    <p className="hint" role="status">
                      {formatRupiah(p.value)}
                      {it.kuantitas > 1 ? ` × ${it.kuantitas} = ${formatRupiah(p.value * it.kuantitas)}` : ""}
                    </p>
                  )}
                </div>
              );
            })}

            <button
              type="button"
              className="btn btn--ghost btn--small"
              style={{ width: "100%", marginTop: "0.75rem" }}
              onClick={() => setItems((d) => [...d, { nama: "", hargaTeks: "", kuantitas: 1 }])}
            >
              + Tambah item
            </button>

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

        {tampil(3) && (
          <div>
            <p className="h1">Ada biaya lain?</p>
            <p className="soft">Biaya lain boleh ditambah. Subtotal item: {formatRupiah(subtotalItems)}.</p>

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

        {tampil(4) && (
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
                <span className="soft">Item</span>
                <span>
                  {itemsValid.length} item — {formatRupiah(subtotalItems)}
                </span>
              </div>
              {itemsValid.map((it, i) => (
                <div className="ringkas" key={i} style={{ marginTop: "0.25rem" }}>
                  <span className="soft">
                    {it.nama}
                    {it.kuantitas > 1 ? ` ×${it.kuantitas}` : ""}
                  </span>
                  <span>{formatRupiah(it.harga * it.kuantitas)}</span>
                </div>
              ))}
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
        {mode === "satu-layar" ? (
          <button type="button" className="btn btn--primary" onClick={simpan} disabled={sibuk}>
            {sibuk ? "Menyimpan…" : "Simpan Pesanan"}
          </button>
        ) : langkah < 4 ? (
          <button type="button" className="btn btn--primary" onClick={lanjut}>
            Lanjut
          </button>
        ) : (
          <button type="button" className="btn btn--primary" onClick={simpan} disabled={sibuk}>
            {sibuk ? "Menyimpan…" : "Simpan Pesanan"}
          </button>
        )}

        <div className="grid2">
          {mode === "satu-layar" ? (
            <button type="button" className="btn btn--ghost btn--small" onClick={onBatal}>
              Batal
            </button>
          ) : langkah > 1 ? (
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