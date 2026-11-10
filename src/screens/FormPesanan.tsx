import { useState } from "react";
import { formatRupiah, parseRupiah } from "../lib/money.ts";
import { dalamRupiah } from "../lib/ketikUang.ts";
import { labelOngkirPilihan, type Ongkir, type OngkirMode } from "../lib/ongkir.ts";
import { periksaRencanaPO, type ItemPO, type RencanaPO } from "../lib/pesanan.ts";

interface Props {
  items: ItemPO[];
  total: number;
  bazarId: string | null;
  onSimpan: (rencana: RencanaPO) => void;
  onBatal: () => void;
  sibuk: boolean;
  pesanGalat: string | null;
}

/**
 * Form Pre-Order (bagian dari alur layar 7 → 8).
 * Data pemesan + ongkir + DP. PO TIDAK mengurangi stok.
 */
export default function FormPesanan({ items, total, bazarId, onSimpan, onBatal, sibuk, pesanGalat }: Props) {
  const [nama, setNama] = useState("");
  const [kontak, setKontak] = useState("");
  const [perkiraan, setPerkiraan] = useState("");
  const [catatan, setCatatan] = useState("");
  const [mode, setMode] = useState<OngkirMode>("ambil_sendiri");
  const [ongkirTeks, setOngkirTeks] = useState("");
  const [alamat, setAlamat] = useState("");
  const [dpTeks, setDpTeks] = useState("");
  const [jenisBayar, setJenisBayar] = useState<"tunai" | "transfer" | "qris" | null>("transfer");
  const [galat, setGalat] = useState<string | null>(null);

  const ongkirAngka = parseRupiah(ongkirTeks);
  const ongkir: Ongkir =
    mode === "belum_ditentukan"
      ? { mode, nominal: null }
      : mode === "butik"
        ? { mode, nominal: ongkirAngka.ok ? ongkirAngka.value : 0 }
        : { mode, nominal: 0 };

  const dpAngka = parseRupiah(dpTeks);

  const rencana: RencanaPO = {
    items,
    diskonTotal: 0,
    ongkir,
    namaPemesan: nama,
    kontak: kontak.trim() || null,
    perkiraanSiap: perkiraan || null,
    alamat: alamat.trim() || null,
    catatan: catatan.trim() || null,
    dibayarSekarang: dpAngka.ok ? dpAngka.value : 0,
    jenisBayar,
    bazarId,
  };

  const cek = periksaRencanaPO(rencana);
  const bisaSimpan = cek.ok && !sibuk;

  function simpan() {
    setGalat(null);
    if (!cek.ok) {
      setGalat(cek.pesan);
      return;
    }
    onSimpan(rencana);
  }

  return (
    <>
      <div className="content">
        {(galat || pesanGalat) && (
          <div className="panel panel--warn" role="alert">
            {galat ?? pesanGalat}
          </div>
        )}

        <div className="card">
          <span className="label">Barang ({items.length})</span>
          {items.map((i) => (
            <div key={i.produkId} className="ringkas soft">
              <span>
                {i.nama} · {i.kuantitas} × {formatRupiah(i.hargaSatuan)}
              </span>
              <span>{formatRupiah(i.hargaSatuan * i.kuantitas)}</span>
            </div>
          ))}
          <div className="ringkas" style={{ marginTop: "0.5rem" }}>
            <strong>Total barang</strong>
            <strong className="money">{formatRupiah(total)}</strong>
          </div>
        </div>

        <div>
          <label htmlFor="nama-pemesan">Nama pemesan</label>
          <input id="nama-pemesan" value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Contoh: Ibu Sari" />
        </div>

        <div>
          <label htmlFor="kontak">WhatsApp / telepon (opsional)</label>
          <input id="kontak" inputMode="tel" value={kontak} onChange={(e) => setKontak(e.target.value)} />
        </div>

        <div>
          <label htmlFor="perkiraan">Perkiraan siap (opsional)</label>
          <input id="perkiraan" type="date" value={perkiraan} onChange={(e) => setPerkiraan(e.target.value)} />
        </div>

        <div className="card">
          <span className="label">Pengiriman</span>
          <div className="pilihan">
            {(["ambil_sendiri", "butik", "kurir", "belum_ditentukan"] as OngkirMode[]).map((m) => (
              <button
                key={m}
                type="button"
                className="pilihan__item"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
              >
                {labelOngkirPilihan(m)}
              </button>
            ))}
          </div>

          {mode === "butik" && (
            <div style={{ marginTop: "0.5rem" }}>
              <label htmlFor="ongkir-po">Ongkir</label>
              <input
                id="ongkir-po"
                inputMode="numeric"
                placeholder="Rp 0"
                value={ongkirTeks}
                onChange={(e) => setOngkirTeks(dalamRupiah(e.target.value))}
              />
            </div>
          )}

          {(mode === "butik" || mode === "kurir") && (
            <div style={{ marginTop: "0.5rem" }}>
              <label htmlFor="alamat">Alamat tujuan</label>
              <input id="alamat" value={alamat} onChange={(e) => setAlamat(e.target.value)} />
            </div>
          )}
        </div>

        <div>
          <label htmlFor="dp">DP diterima sekarang</label>
          <input
            id="dp"
            inputMode="numeric"
            placeholder="Rp 0 (boleh kosong)"
            value={dpTeks}
            onChange={(e) => setDpTeks(dalamRupiah(e.target.value))}
          />
          <div className="pilihan" style={{ marginTop: "0.5rem" }}>
            {(["tunai", "transfer", "qris"] as const).map((m) => (
              <button
                key={m}
                type="button"
                className="pilihan__item"
                aria-pressed={jenisBayar === m}
                onClick={() => setJenisBayar(m)}
              >
                {m === "tunai" ? "Tunai" : m === "transfer" ? "Transfer" : "QRIS"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="catatan-po">Catatan (opsional)</label>
          <input id="catatan-po" value={catatan} onChange={(e) => setCatatan(e.target.value)} />
        </div>

        {cek.ok && (
          <div className="panel panel--ok" role="status">
            Total pesanan {formatRupiah(cek.total)} · sudah dibayar {formatRupiah(cek.sudahDibayar)} · sisa{" "}
            {formatRupiah(cek.sisa)}
          </div>
        )}
      </div>

      <div className="bottombar">
        <button type="button" className="btn btn--primary" onClick={simpan} disabled={!bisaSimpan}>
          {sibuk ? "Menyimpan…" : "Simpan Pesanan"}
        </button>
        <button type="button" className="btn btn--ghost btn--small" onClick={onBatal}>
          Batal
        </button>
      </div>
    </>
  );
}
