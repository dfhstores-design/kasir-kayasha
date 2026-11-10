import { useEffect, useState } from "react";
import {
  buatBazar,
  daftarBazar,
  ringkasanBazar,
  type BazarRecord,
  type RingkasanBazar,
} from "../db/repositori.ts";
import { formatRupiah } from "../lib/money.ts";
import { formatTanggal } from "../lib/tanggal.ts";

interface Props {
  onAturBarang: (b: BazarRecord) => void;
  onTutupBazar: (b: BazarRecord) => void;
  onUbah: () => void;
}

/**
 * Layar 15 — Bazar (docs/design/screens/15-bazar.md).
 * Hanya SATU bazar aktif; tombol Buka Bazar nonaktif bila sudah ada yang aktif.
 */
export default function Bazar({ onAturBarang, onTutupBazar, onUbah }: Props) {
  const [semua, setSemua] = useState<BazarRecord[] | null>(null);
  const [ringkas, setRingkas] = useState<Record<string, RingkasanBazar>>({});
  const [formBuka, setFormBuka] = useState(false);
  const [nama, setNama] = useState("");
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  const [muatUlang, setMuatUlang] = useState(0);

  useEffect(() => {
    let hidup = true;
    (async () => {
      const daftar = await daftarBazar();
      const hasil: Record<string, RingkasanBazar> = {};
      for (const b of daftar) hasil[b.id] = await ringkasanBazar(b.id);
      if (!hidup) return;
      setSemua(daftar);
      setRingkas(hasil);
    })().catch(() => {
      if (hidup) setSemua([]);
    });
    return () => {
      hidup = false;
    };
  }, [muatUlang]);

  const aktif = semua?.find((b) => b.status === "aktif") ?? null;
  const selesai = semua?.filter((b) => b.status === "selesai") ?? [];

  async function buka() {
    if (nama.trim().length < 2) {
      setGalat("Perbaiki: nama bazar minimal 2 huruf.");
      return;
    }
    setSibuk(true);
    try {
      await buatBazar(nama.trim(), null, null);
      setFormBuka(false);
      setNama("");
      setGalat(null);
      setMuatUlang((n) => n + 1);
      onUbah();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Bazar belum terbuka.");
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

        {aktif ? (
          <div className="card" style={{ borderColor: "var(--accent)", borderWidth: 2 }}>
            <span className="soft" style={{ fontWeight: 700, color: "var(--accent-ink)" }}>
              BAZAR AKTIF
            </span>
            <p className="h2" style={{ margin: "0.125rem 0" }}>
              {aktif.nama}
            </p>
            <p className="soft" style={{ margin: 0 }}>
              {ringkas[aktif.id]?.jumlahBarang ?? 0} barang · {ringkas[aktif.id]?.dibawa ?? 0} pcs dibawa
            </p>
            <p className="soft" style={{ margin: "0.25rem 0 0" }}>
              Terjual {ringkas[aktif.id]?.terjualPcs ?? 0} pcs · Sisa {ringkas[aktif.id]?.sisaPcs ?? 0} pcs
            </p>
            <div className="grid2" style={{ marginTop: "0.75rem" }}>
              <button type="button" className="btn btn--ghost btn--small" onClick={() => onAturBarang(aktif)}>
                Atur Barang
              </button>
              <button type="button" className="btn btn--ghost btn--small" onClick={() => onTutupBazar(aktif)}>
                Tutup Bazar
              </button>
            </div>
          </div>
        ) : (
          <div className="panel panel--ok">
            <strong>Belum ada bazar aktif.</strong>
            <p style={{ margin: "0.25rem 0 0" }}>Penjualan memakai stok gudang.</p>
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
          <button
            type="button"
            className="btn btn--primary"
            disabled={!!aktif}
            onClick={() => setFormBuka(true)}
          >
            + Buka Bazar
          </button>
        )}

        {aktif && <p className="hint">Tutup bazar yang sekarang dulu sebelum membuka bazar baru.</p>}

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
