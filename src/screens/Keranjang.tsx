import { useMemo, useState } from "react";
import { formatRupiah, parseRupiah } from "../lib/money.ts";
import { dalamRupiah } from "../lib/ketikUang.ts";
import { buatOngkir, labelOngkirPilihan, type OngkirMode } from "../lib/ongkir.ts";
import { hitungKeranjang, hitungPembayaran, type StatusBayar } from "../lib/keranjang.ts";
import { formatRupiahResi } from "../lib/money.ts";
import { JENIS_BAYAR, labelJenisBayar, type JenisBayar } from "../lib/penjualan.ts";
import type { UUID } from "../db/schema.ts";
import type { IsiKeranjang } from "../lib/isiKeranjang.ts";


export interface NilaiKeranjang {
  isi: IsiKeranjang[];
  diskonTotal: number;
  jenisBayar: JenisBayar | null;
  statusBayar: StatusBayar;
  dibayarSekarang: number;
  ongkirMode: OngkirMode;
  ongkirNominal: number | null;
}

interface Props {
  keranjang: IsiKeranjang[];
  nilai: Omit<NilaiKeranjang, "isi">;
  onUbah: (nilai: Partial<Omit<NilaiKeranjang, "isi">>) => void;
  onUbahJumlah: (produkId: UUID, kuantitas: number) => void;
  onHapus: (produkId: UUID) => void;
  onUbahDiskon: (produkId: UUID, diskonPerUnit: number) => void;
  onSimpan: () => void;
  sedangMenyimpan: boolean;
}

/**
 * Layar 4 — Keranjang (docs/design/screens/04-keranjang.md).
 *
 * Catatan Phase 3: parkir transaksi belum ada di UI (Phase 3B). Struktur data
 * (parked_carts) dan repository-nya sudah siap.
 */
export default function Keranjang({
  keranjang,
  nilai,
  onUbah,
  onUbahJumlah,
  onHapus,
  onUbahDiskon,
  onSimpan,
  sedangMenyimpan,
}: Props) {
  // Nilai teks diturunkan dari state (bukan sinkron lewat efek) agar tidak ada
  // render berantai. `null` berarti "belum diketik" → tampilkan nilai dari state.
  const [diskonTotalKetik, setDiskonTotalKetik] = useState<string | null>(null);
  const [dibayarKetik, setDibayarKetik] = useState<string | null>(null);

  const diskonTotalTeks =
    diskonTotalKetik ?? (nilai.diskonTotal ? dalamRupiah(String(nilai.diskonTotal)) : "");
  const dibayarTeks =
    nilai.statusBayar === "dp" ? (dibayarKetik ?? "") : "";

  const ongkir = useMemo(
    () => buatOngkir(nilai.ongkirMode, nilai.ongkirNominal),
    [nilai.ongkirMode, nilai.ongkirNominal],
  );
  const ongkirSah = useMemo(
    () => (ongkir.ok ? ongkir.value : { mode: "ambil_sendiri" as const, nominal: 0 }),
    [ongkir],
  );

  const hitung = useMemo(
    () =>
      hitungKeranjang(
        keranjang.map((k) => ({
          nama: k.nama,
          hargaSatuan: k.hargaSatuan,
          kuantitas: k.kuantitas,
          diskonPerUnit: k.diskonPerUnit,
        })),
        nilai.diskonTotal,
        ongkirSah,
      ),
    [keranjang, nilai.diskonTotal, ongkirSah],
  );

  const ringkas = hitung.ok ? hitung.ringkasan : null;
  const total = ringkas?.total ?? 0;

  const bayar = useMemo(() => {
    const daftar =
      nilai.statusBayar === "lunas" ? [total] : nilai.statusBayar === "belum_dibayar" ? [] : [nilai.dibayarSekarang];
    return hitungPembayaran(total, daftar);
  }, [nilai.statusBayar, nilai.dibayarSekarang, total]);

  if (keranjang.length === 0) {
    return (
      <div className="content">
        <div className="panel panel--ok">
          <strong>Keranjang belum ada barang.</strong>
          <p style={{ margin: "0.25rem 0 0" }}>Pilih barang lewat tombol Jual Barang di beranda.</p>
        </div>
      </div>
    );
  }

  const galatDiskon =
    !hitung.ok && hitung.error.kode === "diskon_melebihi_harga"
      ? `Maksimal ${formatRupiah(keranjang[hitung.error.index]?.hargaSatuan ?? 0)}`
      : !hitung.ok && hitung.error.kode === "diskon_total_melebihi_subtotal"
        ? `Maksimal ${formatRupiah(ringkas?.subtotalSetelahDiskonItem ?? 0)}`
        : null;

  const dibayarValid =
    nilai.statusBayar === "lunas" ||
    nilai.statusBayar === "belum_dibayar" ||
    (nilai.dibayarSekarang > 0 && nilai.dibayarSekarang < total);

  const bisaSimpan = hitung.ok && dibayarValid && !sedangMenyimpan;

  return (
    <>
      <div className="content">
        {keranjang.map((k) => {
          const subtotalBaris = k.hargaSatuan * k.kuantitas;
          const diskonBaris = k.diskonPerUnit * k.kuantitas;
          return (
            <div key={k.produkId} className="baris-keranjang">
              <div className="ringkas">
                <strong>{k.nama}</strong>
                <span className="money">{formatRupiah(subtotalBaris)}</span>
              </div>
              <div className="soft">
                {k.kuantitas} × {formatRupiah(k.hargaSatuan)}
              </div>

              <div className="stepper" style={{ marginTop: "0.5rem" }}>
                <button
                  type="button"
                  className="stepper__tombol"
                  aria-label={`Kurangi ${k.nama}`}
                  onClick={() => onUbahJumlah(k.produkId, k.kuantitas - 1)}
                >
                  −
                </button>
                <span className="stepper__nilai">{k.kuantitas}</span>
                <button
                  type="button"
                  className="stepper__tombol"
                  aria-label={`Tambah ${k.nama}`}
                  disabled={k.kuantitas >= k.stokTersedia}
                  onClick={() => onUbahJumlah(k.produkId, k.kuantitas + 1)}
                >
                  +
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--small"
                  style={{ marginLeft: "auto" }}
                  onClick={() => {
                    if (window.confirm(`Hapus ${k.nama} dari keranjang?`)) onHapus(k.produkId);
                  }}
                >
                  Hapus
                </button>
              </div>

              <div style={{ marginTop: "0.625rem" }}>
                <label htmlFor={`diskon-${k.produkId}`}>Diskon per buah</label>
                <input
                  id={`diskon-${k.produkId}`}
                  inputMode="numeric"
                  placeholder="Rp 0"
                  value={k.diskonPerUnit ? dalamRupiah(String(k.diskonPerUnit)) : ""}
                  onChange={(e) => {
                    const h = parseRupiah(e.target.value);
                    onUbahDiskon(k.produkId, h.ok ? h.value : 0);
                  }}
                />
                {diskonBaris > 0 && (
                  <p className="hint">− {formatRupiah(diskonBaris)}</p>
                )}
                {galatDiskon && k.diskonPerUnit > k.hargaSatuan && (
                  <p className="hint" style={{ color: "var(--danger)" }} role="alert">
                    {galatDiskon}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        <div className="card">
          <div className="ringkas">
            <span>Subtotal</span>
            <span className="money">{formatRupiah(ringkas?.subtotalAwal ?? 0)}</span>
          </div>
          <div className="ringkas">
            <span>Diskon barang</span>
            <span className="money">− {formatRupiah(ringkas?.diskonItem ?? 0)}</span>
          </div>
          <div className="hr" style={{ height: 1, background: "var(--line)", margin: "0.5rem 0" }} />
          <div className="ringkas">
            <span>Setelah diskon</span>
            <span className="money">{formatRupiah(ringkas?.subtotalSetelahDiskonItem ?? 0)}</span>
          </div>
          <div style={{ marginTop: "0.75rem" }}>
            <label htmlFor="diskon-total">Diskon total</label>
            <input
              id="diskon-total"
              inputMode="numeric"
              placeholder="Rp 0"
              value={diskonTotalTeks}
              onChange={(e) => {
                const teks = dalamRupiah(e.target.value);
                setDiskonTotalKetik(teks);
                const h = parseRupiah(teks);
                onUbah({ diskonTotal: h.ok ? h.value : 0 });
              }}
            />
            {galatDiskon && hitung.ok === false && hitung.error.kode === "diskon_total_melebihi_subtotal" && (
              <p className="hint" style={{ color: "var(--danger)" }} role="alert">
                {galatDiskon}
              </p>
            )}
          </div>
        </div>

        <div className="card">
          <span className="label">Jenis transaksi</span>
          <div className="pilihan">
            {JENIS_BAYAR.map((j) => (
              <button
                key={j}
                type="button"
                className="pilihan__item"
                aria-pressed={nilai.jenisBayar === j}
                onClick={() => onUbah({ jenisBayar: j })}
              >
                {labelJenisBayar(j)}
              </button>
            ))}
          </div>

          <span className="label" style={{ marginTop: "0.75rem" }}>
            Ongkos kirim
          </span>
          <div className="pilihan">
            {(["ambil_sendiri", "butik", "kurir", "belum_ditentukan"] as OngkirMode[]).map((m) => (
              <button
                key={m}
                type="button"
                className="pilihan__item"
                aria-pressed={nilai.ongkirMode === m}
                onClick={() =>
                  onUbah({
                    ongkirMode: m,
                    ongkirNominal: m === "butik" ? (nilai.ongkirNominal ?? 0) : m === "belum_ditentukan" ? null : 0,
                  })
                }
              >
                {labelOngkirPilihan(m)}
              </button>
            ))}
          </div>
          {nilai.ongkirMode === "butik" && (
            <div style={{ marginTop: "0.5rem" }}>
              <label htmlFor="ongkir">Ongkir</label>
              <input
                id="ongkir"
                inputMode="numeric"
                placeholder="Rp 0"
                value={nilai.ongkirNominal ? dalamRupiah(String(nilai.ongkirNominal)) : ""}
                onChange={(e) => {
                  const h = parseRupiah(e.target.value);
                  onUbah({ ongkirNominal: h.ok ? h.value : 0 });
                }}
              />
            </div>
          )}

          <span className="label" style={{ marginTop: "0.75rem" }}>
            Status bayar
          </span>
          <div className="pilihan">
            {(["lunas", "dp", "belum_dibayar"] as StatusBayar[]).map((s) => (
              <button
                key={s}
                type="button"
                className="pilihan__item"
                aria-pressed={nilai.statusBayar === s}
                onClick={() => onUbah({ statusBayar: s })}
              >
                {s === "lunas" ? "Lunas" : s === "dp" ? "DP" : "Belum dibayar"}
              </button>
            ))}
          </div>

          {nilai.statusBayar === "dp" && (
            <div style={{ marginTop: "0.5rem" }}>
              <label htmlFor="dibayar">Dibayar sekarang</label>
              <input
                id="dibayar"
                inputMode="numeric"
                placeholder="Rp 0"
                value={dibayarTeks}
                onChange={(e) => {
                  const teks = dalamRupiah(e.target.value);
                  setDibayarKetik(teks);
                  const h = parseRupiah(teks);
                  onUbah({ dibayarSekarang: h.ok ? h.value : 0 });
                }}
              />
              {nilai.dibayarSekarang >= total && total > 0 && (
                <p className="hint" style={{ color: "var(--danger)" }} role="alert">
                  DP harus kurang dari total {formatRupiah(total)}.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bottombar">
        <div className="ringkas">
          <span className="h2">TOTAL</span>
          <span className="total" style={{ fontSize: "1.75rem" }}>
            {formatRupiah(total)}
          </span>
        </div>
        {ringkas?.totalBelumTermasukOngkir && (
          <p className="hint" style={{ margin: 0 }}>
            Total belum termasuk ongkir.
          </p>
        )}
        {bayar.ok && bayar.ringkasan.status !== "lunas" && (
          <p className="hint" style={{ margin: 0 }}>
            Sisa tagihan {formatRupiahResi(bayar.ringkasan.sisa)}
          </p>
        )}
        <button type="button" className="btn btn--primary" onClick={onSimpan} disabled={!bisaSimpan}>
          {sedangMenyimpan ? "Menyimpan…" : "Simpan Transaksi"}
        </button>
      </div>
    </>
  );
}


