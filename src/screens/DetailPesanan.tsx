import { useState } from "react";
import type { PesananLengkap } from "../db/pesananOperasi.ts";
import { formatRupiah, parseRupiah } from "../lib/money.ts";
import { dalamRupiah } from "../lib/ketikUang.ts";
import { labelStatusBayar } from "../lib/keranjang.ts";
import { labelOngkirResi, type Ongkir } from "../lib/ongkir.ts";
import {
  formatCatatanPerubahanTotal,
  labelStatusPesanan,
  STATUS_PESANAN,
  transisiSah,
  type StatusPesanan,
} from "../lib/pesanan.ts";
import { formatTanggal, formatTanggalJam } from "../lib/tanggal.ts";

interface Props {
  pesanan: PesananLengkap;
  onCatatPembayaran: (nominal: number, metode: string | null) => void;
  onUbahStatus: (ke: StatusPesanan) => void;
  onIsiOngkir: (ongkir: Ongkir) => void;
  onLihatResi: () => void;
  sibuk: boolean;
}

type Lembar = "tidak-ada" | "pembayaran" | "status" | "ongkir";

/**
 * Layar 8 — Detail Pesanan & Pembayaran (docs/design/screens/08-pesanan-detail.md).
 * Status pembayaran TAMPIL TERPISAH dari status pesanan.
 */
export default function DetailPesanan({ pesanan, onCatatPembayaran, onUbahStatus, onIsiOngkir, onLihatResi, sibuk }: Props) {
  const [lembar, setLembar] = useState<Lembar>("tidak-ada");
  const [nominal, setNominal] = useState("");
  const [metode, setMetode] = useState<string | null>("tunai");
  const [ongkirTeks, setOngkirTeks] = useState("");
  const [ongkirKeKurir, setOngkirKeKurir] = useState(false);

  const t = pesanan.transaksi;
  const sudahDibayar = pesanan.pembayaran.reduce((n, p) => n + p.nominal, 0);
  const sisa = t.total - sudahDibayar;
  const dibatalkan = t.statusPesanan === "dibatalkan";
  const selesai = t.statusPesanan === "selesai";
  const ongkirBelum = t.ongkirMode === "belum_ditentukan";

  const nominalAngka = parseRupiah(nominal);
  const nominalSah = nominalAngka.ok && nominalAngka.value > 0 && nominalAngka.value <= sisa;

  const ongkirAngka = parseRupiah(ongkirTeks);
  const totalPratinjau = t.subtotalAwal - t.diskonItem - t.diskonTotal + (ongkirKeKurir ? 0 : ongkirAngka.ok ? ongkirAngka.value : 0);

  return (
    <>
      <div className="content">
        <div>
          <p className="h1" style={{ margin: 0 }}>
            {t.namaPemesan ?? "(tanpa nama)"}
          </p>
          {t.kontak && <p className="soft" style={{ margin: "0.125rem 0 0" }}>{t.kontak}</p>}
          <div className="pilihan" style={{ marginTop: "0.5rem" }}>
            <span className="chip">{labelStatusPesanan(t.statusPesanan)}</span>
            <span className="chip">{labelStatusBayar(t.statusBayar)}</span>
            {ongkirBelum && !dibatalkan && <span className="chip warn">Ongkir menyusul</span>}
          </div>
          {t.perkiraanSiap && (
            <p className="soft" style={{ margin: "0.5rem 0 0", fontSize: "0.95rem" }}>
              Perkiraan siap {formatTanggal(t.perkiraanSiap)}
            </p>
          )}
        </div>

        <div className="card">
          <span className="soft" style={{ fontWeight: 700 }}>
            PRE-ORDER · {t.nomorResi}
          </span>
          {pesanan.item.map((i) => (
            <div key={i.id} className="ringkas" style={{ marginTop: "0.25rem" }}>
              <span>
                {i.namaSnapshot} · {i.kuantitas} × {formatRupiah(i.hargaSatuan)}
              </span>
              <span className="money">{formatRupiah(i.hargaSatuan * i.kuantitas - i.diskonPerUnit * i.kuantitas)}</span>
            </div>
          ))}
          <div className="hr" style={{ height: 1, background: "var(--line)", margin: "0.5rem 0" }} />
          <div className="ringkas">
            <span>Ongkos kirim</span>
            <span className="money">
              {labelOngkirResi({ mode: t.ongkirMode, nominal: t.ongkirNominal })}
            </span>
          </div>
          {t.alamat && <p className="soft" style={{ margin: "0.25rem 0 0", fontSize: "0.95rem" }}>{t.alamat}</p>}
        </div>

        <div className={ongkirBelum ? "warnbox card" : "card"}>
          <div className="ringkas">
            <span>Total pesanan</span>
            <span className="money">{formatRupiah(t.total)}</span>
          </div>
          <div className="ringkas">
            <span>Sudah dibayar</span>
            <span className="money">{formatRupiah(sudahDibayar)}</span>
          </div>
          <div className="hr" style={{ height: 1, background: "var(--line)", margin: "0.5rem 0" }} />
          <div className="ringkas">
            <strong>SISA TAGIHAN</strong>
            <strong className="money" style={{ fontSize: "1.375rem" }}>
              {formatRupiah(sisa)}
            </strong>
          </div>
          {ongkirBelum && (
            <p className="hint" style={{ margin: "0.25rem 0 0" }}>
              Total belum termasuk ongkir.
            </p>
          )}
        </div>

        {t.riwayatTotal.length > 0 && (
          <div className="card">
            <span className="label">Riwayat total</span>
            {t.riwayatTotal.map((r, i) => (
              <p key={i} className="soft" style={{ margin: "0.125rem 0", fontSize: "0.95rem" }}>
                {formatCatatanPerubahanTotal(r)}
              </p>
            ))}
          </div>
        )}

        <div className="card">
          <span className="label">Riwayat pembayaran</span>
          {pesanan.pembayaran.length === 0 && <p className="soft" style={{ margin: 0 }}>Belum ada pembayaran.</p>}
          {[...pesanan.pembayaran]
            .sort((a, b) => b.waktu.localeCompare(a.waktu))
            .map((p) => (
              <div key={p.id} className="ringkas soft" style={{ fontSize: "0.95rem" }}>
                <span>
                  {formatTanggalJam(p.waktu)} · {p.metode ?? "—"}
                </span>
                <span>{formatRupiah(p.nominal)}</span>
              </div>
            ))}
        </div>

        {/* ------------- lembar bawah ------------- */}
        {lembar === "pembayaran" && (
          <div className="card">
            <span className="label">Catat Pembayaran</span>
            <p className="hint" style={{ marginTop: 0 }}>Sisa tagihan {formatRupiah(sisa)}</p>
            <input
              inputMode="numeric"
              placeholder="Rp 0"
              value={nominal}
              onChange={(e) => setNominal(dalamRupiah(e.target.value))}
              aria-label="Nominal pembayaran"
            />
            {nominalAngka.ok && nominalAngka.value > sisa && (
              <p className="hint" style={{ color: "var(--danger)" }} role="alert">
                Nominal melebihi sisa tagihan {formatRupiah(sisa)}.
              </p>
            )}
            <div className="pilihan" style={{ marginTop: "0.5rem" }}>
              {["tunai", "transfer", "qris"].map((m) => (
                <button
                  key={m}
                  type="button"
                  className="pilihan__item"
                  aria-pressed={metode === m}
                  onClick={() => setMetode(m)}
                >
                  {m === "tunai" ? "Tunai" : m === "transfer" ? "Transfer" : "QRIS"}
                </button>
              ))}
            </div>
            <div className="grid2" style={{ marginTop: "0.75rem" }}>
              <button type="button" className="btn btn--ghost btn--small" onClick={() => setLembar("tidak-ada")}>
                Batal
              </button>
              <button
                type="button"
                className="btn btn--primary btn--small"
                disabled={!nominalSah || sibuk}
                onClick={() => {
                  if (!nominalAngka.ok) return;
                  onCatatPembayaran(nominalAngka.value, metode);
                  setNominal("");
                  setLembar("tidak-ada");
                }}
              >
                {sibuk ? "Menyimpan…" : "Simpan"}
              </button>
            </div>
          </div>
        )}

        {lembar === "status" && (
          <div className="card">
            <span className="label">Ubah status pesanan</span>
            {STATUS_PESANAN.map((s) => {
              const boleh = transisiSah(t.statusPesanan, s);
              return (
                <button
                  key={s}
                  type="button"
                  className="btn btn--ghost btn--small"
                  style={{ width: "100%", marginBottom: "0.5rem" }}
                  disabled={!boleh || sibuk}
                  onClick={() => {
                    onUbahStatus(s);
                    setLembar("tidak-ada");
                  }}
                >
                  {labelStatusPesanan(s)}
                </button>
              );
            })}
            <button type="button" className="btn btn--ghost btn--small" style={{ width: "100%" }} onClick={() => setLembar("tidak-ada")}>
              Tutup
            </button>
          </div>
        )}

        {lembar === "ongkir" && (
          <div className="card">
            <span className="label">Isi Ongkos Kirim</span>
            <input
              inputMode="numeric"
              placeholder="Rp 25.000"
              value={ongkirTeks}
              onChange={(e) => setOngkirTeks(dalamRupiah(e.target.value))}
              aria-label="Nominal ongkir"
            />
            <div className="pilihan" style={{ marginTop: "0.5rem" }}>
              <button type="button" className="pilihan__item" aria-pressed={!ongkirKeKurir} onClick={() => setOngkirKeKurir(false)}>
                Ditagih butik
              </button>
              <button type="button" className="pilihan__item" aria-pressed={ongkirKeKurir} onClick={() => setOngkirKeKurir(true)}>
                Dibayar kurir
              </button>
            </div>
            <p className="hint" role="status">
              Total berubah dari {formatRupiah(t.total)} menjadi {formatRupiah(totalPratinjau)}
            </p>
            <div className="grid2">
              <button type="button" className="btn btn--ghost btn--small" onClick={() => setLembar("tidak-ada")}>
                Batal
              </button>
              <button
                type="button"
                className="btn btn--primary btn--small"
                disabled={sibuk || (!ongkirKeKurir && !ongkirAngka.ok)}
                onClick={() => {
                  const ongkir: Ongkir = ongkirKeKurir
                    ? { mode: "kurir", nominal: 0 }
                    : { mode: "butik", nominal: ongkirAngka.ok ? ongkirAngka.value : 0 };
                  onIsiOngkir(ongkir);
                  setLembar("tidak-ada");
                }}
              >
                Simpan
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bottombar">
        {dibatalkan || selesai ? (
          <button type="button" className="btn btn--ghost" onClick={onLihatResi}>
            Lihat Resi
          </button>
        ) : (
          <>
            <button
              type="button"
              className="btn btn--primary"
              disabled={sibuk || sisa === 0}
              onClick={() => setLembar("pembayaran")}
            >
              Catat Pembayaran
            </button>
            <div className="grid2">
              <button type="button" className="btn btn--ghost btn--small" onClick={() => setLembar("status")}>
                Ubah Status
              </button>
              {ongkirBelum ? (
                <button type="button" className="btn btn--ghost btn--small" onClick={() => setLembar("ongkir")}>
                  Isi Ongkir
                </button>
              ) : (
                <button type="button" className="btn btn--ghost btn--small" onClick={onLihatResi}>
                  Lihat Resi
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
