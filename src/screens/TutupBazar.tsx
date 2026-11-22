import { useEffect, useState } from "react";
import {
  daftarBiaya,
  daftarProduk,
  daftarTransaksi,
  itemBazar,
  ringkasanBazar,
  tutupBazar,
  type BazarRecord,
  type RingkasanBazar,
} from "../db/repositori.ts";
import { hitungSaldoBazar } from "../lib/stok.ts";
import { hitungUlangSisa, pesanSelisih } from "../lib/bazar.ts";
import { formatRupiah } from "../lib/money.ts";
import { formatTanggal } from "../lib/tanggal.ts";
import type { TransaksiRecord, UUID } from "../db/schema.ts";

interface Props {
  bazar: BazarRecord;
  onSelesai: () => void;
}

interface BarisSisa {
  produkId: UUID;
  nama: string;
  /** Sisa menurut catatan sistem. */
  sisa: number;
  /** Angka FISIK yang diketik admin (bawaan = sisa tercatat). */
  teks: string;
}

/**
 * Layar 17 — Tutup Bazar (docs/design/screens/17-tutup-bazar.md).
 *
 * Hitung ulang fisik (ROLE-BIAYA-RINGKASAN.md bagian 4):
 *   selisih = fisik − tercatat
 * Yang dikembalikan ke gudang = angka FISIK. Selisih ditampilkan, tidak disembunyikan.
 */
export default function TutupBazar({ bazar, onSelesai }: Props) {
  const [ringkas, setRingkas] = useState<RingkasanBazar | null>(null);
  const [baris, setBaris] = useState<BarisSisa[] | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);
  /** Total biaya bazar yang sudah tercatat (BU-34: admin memastikan biaya tercatat). */
  const [totalBiaya, setTotalBiaya] = useState<number | null>(null);
  /**
   * Pesanan jahit bazar ini yang belum selesai/lunas (BU-34: dikonfirmasi
   * ulang saat tutup). Hanya pesanan dengan bazarId bazar ini (C7) yang
   * masih terbuka: sudah lunas DAN sudah selesai tidak perlu dikonfirmasi
   * lagi. Pesanan lama tanpa bazarId dianggap pesanan butik — tidak muncul
   * di tutup bazar mana pun.
   */
  const [pesananBelum, setPesananBelum] = useState<TransaksiRecord[] | null>(null);
  const [pesananDikonfirmasi, setPesananDikonfirmasi] = useState(false);
  /** Konfirmasi dua langkah di dalam aplikasi (C1) — lihat `tutup()`. */
  const [mintaKonfirmasi, setMintaKonfirmasi] = useState(false);

  useEffect(() => {
    (async () => {
      const [r, items, produk, biaya, semuaTrx] = await Promise.all([
        ringkasanBazar(bazar.id),
        itemBazar(bazar.id),
        daftarProduk(true),
        daftarBiaya(bazar.id),
        daftarTransaksi(),
      ]);
      setRingkas(r);
      setBaris(
        items
          .map((i) => {
            const p = produk.find((x) => x.id === i.produkId);
            const sisa = hitungSaldoBazar(i);
            return { produkId: i.produkId, nama: p?.nama ?? "Barang", sisa, teks: String(sisa) };
          })
          .filter((b) => b.sisa > 0),
      );
      setTotalBiaya(biaya.reduce((n, b) => n + b.nominal, 0));
      setPesananBelum(
        semuaTrx.filter(
          (t) =>
            t.jenisDokumen === "jasa" &&
            t.dibatalkanPada === null &&
            // Hanya pesanan bazar ini (C7) yang MASIH terbuka: belum selesai
            // DAN belum lunas. Logika lama memakai ATAU, sehingga pesanan
            // yang sudah lunas tapi belum selesai ikut muncul.
            t.bazarId === bazar.id &&
            t.statusPesanan !== "selesai" &&
            t.statusBayar !== "lunas",
        ),
      );
    })().catch(() => setBaris([]));
  }, [bazar.id]);

  const rekap = hitungUlangSisa(
    (baris ?? []).map((b) => ({
      produkId: b.produkId,
      nama: b.nama,
      tercatat: b.sisa,
      fisik: Number(b.teks) || 0,
    })),
  );
  const adaBeda = rekap.ok && rekap.adaSelisih;

  async function tutup() {
    if (!rekap.ok) {
      setGalat(rekap.pesan);
      return;
    }
    // Pesanan yang belum selesai/lunas wajib dikonfirmasi dulu (BU-34).
    if ((pesananBelum?.length ?? 0) > 0 && !pesananDikonfirmasi) {
      setGalat("Konfirmasi dulu pesanan yang belum selesai di bawah ini sebelum menutup bazar.");
      return;
    }
    // Konfirmasi dua langkah di dalam aplikasi (C1, tes klik 22 Nov 2026):
    // `window.confirm` diabaikan diam-diam oleh browser otomatis (dialog
    // ditutup otomatis → confirm mengembalikan false), sehingga tombol
    // "Tutup Bazar" tampak tidak berfungsi. Klik pertama hanya menampilkan
    // panel konfirmasi di bawah; klik kedua yang benar-benar menutup.
    if (!mintaKonfirmasi) {
      setGalat(null);
      setMintaKonfirmasi(true);
      return;
    }
    setMintaKonfirmasi(false);
    setGalat(null);
    setSibuk(true);
    // Yang dikembalikan = angka FISIK.
    const peta = new Map<UUID, number>();
    for (const b of rekap.baris) peta.set(b.produkId, b.dikembalikan);

    try {
      const h = await tutupBazar(bazar.id, peta);
      if (!h.ok) {
        setGalat(h.pesan);
        return;
      }
      onSelesai();
    } catch {
      // Kegagalan sebelumnya diam-diam (tidak ada catch) — sekarang tampil.
      setGalat("Gagal menutup bazar — coba lagi.");
    } finally {
      setSibuk(false);
    }
  }

  if (ringkas === null || baris === null) {
    return (
      <div className="content">
        <p className="soft">Menghitung sisa…</p>
      </div>
    );
  }

  return (
    <>
      <div className="content">
        <div>
          <p className="h2" style={{ margin: 0 }}>
            {bazar.nama}
          </p>
        </div>

        {galat && (
          <div className="panel panel--warn" role="alert">
            {galat}
          </div>
        )}

        <div className="card">
          <div className="ringkas">
            <span>Terjual</span>
            <span className="money">{ringkas.terjualPcs} pcs</span>
          </div>
          <div className="ringkas">
            <span>Dibawa</span>
            <span className="money">{ringkas.dibawa} pcs</span>
          </div>
          <div className="ringkas">
            <span>Uang masuk</span>
            <span className="money">{formatRupiah(ringkas.uangMasuk)}</span>
          </div>
          {/* Rekonsiliasi per metode (Fase 2C, BU-34): angka dari baris pembayaran. */}
          <div className="ringkas soft">
            <span>Tunai</span>
            <span>{formatRupiah(ringkas.tunai)}</span>
          </div>
          <div className="ringkas soft">
            <span>Transfer</span>
            <span>{formatRupiah(ringkas.transfer)}</span>
          </div>
          <div className="ringkas soft">
            <span>QRIS</span>
            <span>{formatRupiah(ringkas.qris)}</span>
          </div>
          {/* (b): pengembalian dipisah — DP pesanan jahit vs penjualan batal. */}
          {ringkas.pengembalianDp > 0 && (
            <div className="ringkas soft">
              <span>Pengembalian DP (pesanan jahit)</span>
              <span>− {formatRupiah(ringkas.pengembalianDp)}</span>
            </div>
          )}
          {ringkas.pengembalianBatal > 0 && (
            <div className="ringkas soft">
              <span>Pengembalian penjualan batal</span>
              <span>− {formatRupiah(ringkas.pengembalianBatal)}</span>
            </div>
          )}
          <div className="ringkas">
            <span>Biaya tercatat</span>
            <span className="money">{totalBiaya === null ? "…" : `− ${formatRupiah(totalBiaya)}`}</span>
          </div>
          <div className="hr" style={{ height: 1, background: "var(--line)", margin: "0.5rem 0" }} />
          <div className="ringkas">
            <strong>Sisa</strong>
            <strong className="money">{ringkas.sisaPcs} pcs</strong>
          </div>
        </div>

        {totalBiaya === 0 && (
          <div className="panel panel--warn" role="alert">
            <strong>Belum ada biaya bazar yang tercatat.</strong>
            <p style={{ margin: "0.25rem 0 0" }}>
              Pastikan semua pengeluaran bazar sudah dicatat di layar Biaya Bazar sebelum menutup.
            </p>
          </div>
        )}

        {/*
          F10 (tes klik 22 Nov 2026): bagian ini SELALU tampil. Dulu hanya
          muncul bila ada pesanan terbuka — bila daftarnya kosong (mis.
          pesanan dicatat sebagai pesanan butik karena kasir masuk sebagai
          kasir toko, atau lokasi kasir hilang sesudah reload), admin
          melihat layar tanpa daftar sama sekali dan menyangka fiturnya
          hilang. Sekarang bagian kosong pun menampilkan penjelasan
          aturannya, supaya jelas kenapa daftarnya kosong.
        */}
        <span className="label">Pesanan yang belum selesai / belum lunas — konfirmasi ulang</span>
        {(pesananBelum?.length ?? 0) > 0 ? (
          <>
            {(pesananBelum ?? []).map((t) => (
              <div key={t.id} className="listrow">
                <div style={{ flex: 1 }}>
                  <strong>{t.namaPemesan ?? "—"}</strong>
                  <div className="soft" style={{ fontSize: "0.95rem" }}>
                    {t.nomorResi} · {formatTanggal(t.waktu)} ·{" "}
                    {t.statusBayar === "lunas" ? "Lunas" : t.statusBayar === "dp" ? "Baru DP" : "Belum dibayar"}
                  </div>
                </div>
                <strong className="money">{formatRupiah(t.total)}</strong>
              </div>
            ))}
            <label style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
              <input
                type="checkbox"
                checked={pesananDikonfirmasi}
                onChange={(e) => setPesananDikonfirmasi(e.target.checked)}
                style={{ width: "1.5rem", height: "1.5rem", flexShrink: 0 }}
              />
              <span>Pesanan di atas sudah dikonfirmasi (akan dikirim / diambil di butik).</span>
            </label>
          </>
        ) : (
          <div className="panel panel--ok">
            <strong>Tidak ada pesanan terbuka dari bazar ini.</strong>
            <p style={{ margin: "0.25rem 0 0" }}>
              Hanya pesanan yang dicatat kasir bazar ini yang muncul di sini. Pesanan butik tidak
              termasuk.
            </p>
          </div>
        )}

        {baris.length > 0 ? (
          <>
            <span className="label">Hitung ulang barang, lalu simpan ke gudang</span>
            {baris.map((b) => {
              const hitung = rekap.ok ? rekap.baris.find((x) => x.produkId === b.produkId) : undefined;
              const selisih = hitung?.selisih ?? 0;
              return (
                <div key={b.produkId} className="card">
                  <strong>{b.nama}</strong>
                  <div className="soft" style={{ fontSize: "0.95rem" }}>
                    Tercatat di bazar: {b.sisa}
                  </div>
                  <div className="grid2" style={{ marginTop: "0.5rem", alignItems: "center" }}>
                    <label htmlFor={`fisik-${b.produkId}`} style={{ margin: 0 }}>
                      Hitungan fisik
                    </label>
                    <input
                      id={`fisik-${b.produkId}`}
                      inputMode="numeric"
                      value={b.teks}
                      aria-invalid={selisih !== 0}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^\d]/g, "");
                        setBaris((list) => (list ?? []).map((x) => (x.produkId === b.produkId ? { ...x, teks: v } : x)));
                      }}
                    />
                  </div>
                  {selisih !== 0 && (
                    <p className="hint" style={{ color: "var(--warn-ink)" }} role="status">
                      Selisih {selisih > 0 ? `+${selisih} (lebih)` : `${selisih} (kurang)`} · kembalikan{" "}
                      {hitung?.dikembalikan ?? 0} pcs
                    </p>
                  )}
                </div>
              );
            })}
            {adaBeda && rekap.ok && (
              <div className="panel panel--warn" role="alert">
                {pesanSelisih(rekap.baris)}
              </div>
            )}
            <div className="hint">
              Yang dikembalikan ke gudang adalah angka <strong>fisik</strong>. Selisih dicatat untuk
              ditinjau admin. Catatan balik ini yang tersimpan (sisa kembali ke gudang) — dokumen
              transfer lengkap adalah Tahap 3.
            </div>
          </>
        ) : (
          <div className="panel panel--ok">Tidak ada sisa barang.</div>
        )}

        {mintaKonfirmasi && (
          <div className="panel panel--warn" role="alert">
            <strong>Tutup bazar ini?</strong>
            {adaBeda && (
              <p style={{ margin: "0.25rem 0 0" }}>
                Ada selisih hitung — yang dikembalikan ke gudang adalah angka fisik.
              </p>
            )}
            {totalBiaya === 0 && (
              <p style={{ margin: "0.25rem 0 0" }}>Belum ada biaya bazar yang tercatat.</p>
            )}
            <p style={{ margin: "0.25rem 0 0" }}>Setelah ditutup tidak bisa dibuka lagi.</p>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
              <button type="button" className="btn btn--primary" onClick={tutup} disabled={sibuk}>
                {sibuk ? "Menutup…" : "Ya, Tutup Bazar"}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setMintaKonfirmasi(false)}
                disabled={sibuk}
              >
                Batal
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bottombar">
        <button type="button" className="btn btn--primary" onClick={tutup} disabled={sibuk}>
          {sibuk ? "Menutup…" : "Tutup Bazar"}
        </button>
      </div>
    </>
  );
}
