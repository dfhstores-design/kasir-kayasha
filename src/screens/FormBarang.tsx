import { useEffect, useMemo, useRef, useState } from "react";
import { MAKS_FOTO, daftarFoto, hapusFoto, tambahFoto, type FotoRecord, type ProdukRecord } from "../db/repositori.ts";
import { formatRupiah, parseRupiah } from "../lib/money.ts";
import { dalamRupiah } from "../lib/ketikUang.ts";
import { kompresFoto, KompresiError, periksaBerkasFoto } from "../lib/kompresiFoto.ts";
import { PROGRES_AWAL, progresGagal, progresSelesai, progresUntuk, type ProgresFoto } from "../lib/progresFoto.ts";
import { IndikatorProgresFoto, IndikatorUnggah } from "../components/IndikatorProgres.tsx";
import { progresUnggahAwal } from "../lib/progresFoto.ts";

type GalatKolom = "nama" | "harga" | "stok" | null;

interface Props {
  produk: ProdukRecord | null;
  onSimpan: (nilai: { nama: string; hargaJual: number; stokGudang: number; kode: string; catatan: string }) => Promise<void>;
  onArsip?: () => void;
  onBatal: () => void;
}

/**
 * Layar 10 — Form Barang (docs/design/screens/10-form-barang.md).
 * Kolom wajib: nama, harga, stok gudang. Foto maksimal 3, dikompres di perangkat
 * dengan indikator progres wajib.
 */
export default function FormBarang({ produk, onSimpan, onArsip, onBatal }: Props) {
  const [nama, setNama] = useState(produk?.nama ?? "");
  const [harga, setHarga] = useState(produk ? formatRupiah(produk.hargaJual) : "");
  const [stok, setStok] = useState(produk ? String(produk.stokGudang) : "");
  const [kode, setKode] = useState(produk?.kode ?? "");
  const [catatan, setCatatan] = useState(produk?.catatan ?? "");
  const [galat, setGalat] = useState<GalatKolom>(null);
  const [pesanGalat, setPesanGalat] = useState<string | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);

  const [foto, setFoto] = useState<FotoRecord[]>([]);
  const [progres, setProgres] = useState<ProgresFoto>(PROGRES_AWAL);
  const [pesanFoto, setPesanFoto] = useState<string | null>(null);
  const inputKamera = useRef<HTMLInputElement>(null);
  const inputGaleri = useRef<HTMLInputElement>(null);

  // Muat foto yang sudah ada (mode ubah).
  useEffect(() => {
    if (!produk) return;
    let hidup = true;
    daftarFoto(produk.id).then((f) => {
      if (hidup) setFoto(f);
    });
    return () => {
      hidup = false;
    };
  }, [produk]);

  // URL pratinjau DITURUNKAN dari `foto` (bukan disimpan di state) agar tidak
  // memicu render berantai. Dilepas saat daftar foto berubah atau komponen dilepas.
  const urlFoto = useMemo(() => {
    const urls: Record<string, string> = {};
    for (const f of foto) urls[f.id] = URL.createObjectURL(f.blob);
    return urls;
  }, [foto]);

  useEffect(() => {
    const snapshot = urlFoto;
    return () => {
      Object.values(snapshot).forEach((u) => URL.revokeObjectURL(u));
    };
  }, [urlFoto]);

  async function prosesFoto(berkas: File) {
    setPesanFoto(null);

    if (!produk) {
      setPesanFoto("Simpan nama, harga, dan stok dulu, lalu tambahkan foto.");
      return;
    }
    if (foto.length >= MAKS_FOTO) {
      setPesanFoto("Maksimal 3 foto.");
      return;
    }

    // Periksa berkas SEBELUM decode: foto kamera bisa >80 MB dan membuat tab crash.
    const cekBerkas = periksaBerkasFoto({ size: berkas.size, type: berkas.type });
    if (!cekBerkas.ok) {
      // Cukup satu tempat menampilkan pesan: panel progres (mode gagal).
      setProgres(progresGagal(cekBerkas.pesan));
      setPesanFoto(null);
      if (inputKamera.current) inputKamera.current.value = "";
      if (inputGaleri.current) inputGaleri.current.value = "";
      return;
    }

    if (cekBerkas.besar) {
      setPesanFoto("Foto besar — sedang dikecilkan. Mohon tunggu sebentar.");
    }

    const selesai: Parameters<typeof progresUntuk>[0] = [];
    const langkah = async (tahap: NonNullable<(typeof selesai)[number]>) => {
      selesai.push(tahap);
      setProgres(progresUntuk(selesai));
      // beri kesempatan pelukis layar memperbarui progres
      await new Promise((r) => setTimeout(r, 0));
    };

    try {
      await langkah("baca");
      await langkah("kecilkan");
      setProgres(progresUntuk(["baca", "kecilkan"]));
      const hasil = await kompresFoto(berkas);

      selesai.push("kompres");
      setProgres(progresUntuk(selesai));
      await new Promise((r) => setTimeout(r, 0));

      const simpan = await tambahFoto(produk.id, hasil.blob, hasil.tipe);
      if (!simpan.ok) {
        setProgres(progresGagal("Maksimal 3 foto."));
        setPesanFoto("Maksimal 3 foto.");
        return;
      }

      setProgres(progresUntuk([...selesai, "simpan"]));
      setFoto((f) => [...f, simpan.foto]);
      setProgres(progresSelesai());
      setPesanFoto(null);

      if (hasil.masihTerlaluBesar) {
        setPesanFoto("Foto tersimpan, tetapi ukurannya masih besar.");
      }
    } catch (e) {
      const pesan =
        e instanceof KompresiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Foto gagal diproses.";
      // Pesan galat hanya di panel progres, tidak diulang di hint.
      setProgres(progresGagal(pesan));
      setPesanFoto(null);
    } finally {
      if (inputKamera.current) inputKamera.current.value = "";
      if (inputGaleri.current) inputGaleri.current.value = "";
    }
  }

  async function buangFoto(f: FotoRecord) {
    if (!window.confirm("Hapus foto ini?")) return;
    await hapusFoto(f.id);
    setFoto((daftar) => daftar.filter((x) => x.id !== f.id));
  }

  async function simpan() {
    setGalat(null);
    setPesanGalat(null);

    if (nama.trim().length < 2) {
      setGalat("nama");
      setPesanGalat("Perbaiki: nama barang minimal 2 huruf.");
      return;
    }
    const hargaHasil = parseRupiah(harga);
    if (!hargaHasil.ok || hargaHasil.value < 1) {
      setGalat("harga");
      setPesanGalat("Perbaiki: harga jual harus angka lebih dari 0.");
      return;
    }
    const stokAngka = Number(stok.trim());
    if (!Number.isInteger(stokAngka) || stokAngka < 0) {
      setGalat("stok");
      setPesanGalat("Perbaiki: stok gudang harus angka 0 atau lebih.");
      return;
    }

    setMenyimpan(true);
    try {
      await onSimpan({
        nama: nama.trim(),
        hargaJual: hargaHasil.value,
        stokGudang: stokAngka,
        kode: kode.trim(),
        catatan: catatan.trim(),
      });
    } catch (e) {
      setPesanGalat(e instanceof Error ? e.message : "Barang belum tersimpan.");
    } finally {
      setMenyimpan(false);
    }
  }

  const bisaTambahFoto = foto.length < MAKS_FOTO;

  return (
    <>
      <div className="content">
        {pesanGalat && (
          <div className="panel panel--warn" role="alert">
            {pesanGalat}
          </div>
        )}

        <div>
          <label htmlFor="nama">Nama barang</label>
          <input
            id="nama"
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            placeholder="Contoh: Blus Linen Lengan Panjang"
            aria-invalid={galat === "nama"}
          />
        </div>

        <div>
          <label htmlFor="harga">Harga jual</label>
          <input
            id="harga"
            inputMode="numeric"
            value={harga}
            onChange={(e) => setHarga(dalamRupiah(e.target.value))}
            placeholder="Rp 180.000"
            aria-invalid={galat === "harga"}
          />
        </div>

        <div>
          <label htmlFor="stok">Stok gudang</label>
          <input
            id="stok"
            inputMode="numeric"
            value={stok}
            onChange={(e) => setStok(e.target.value.replace(/[^\d]/g, ""))}
            aria-invalid={galat === "stok"}
          />
          <p className="hint">Barang yang ada di toko. Yang dibawa ke bazar diatur di menu Bazar.</p>
        </div>

        <div>
          <span className="label">Foto ({foto.length} dari {MAKS_FOTO})</span>

          <div className="grid-foto">
            {foto.map((f) => (
              <div key={f.id} className="slot-foto slot-foto--isi">
                <img src={urlFoto[f.id] ?? ""} alt="Foto barang" />
                <button
                  type="button"
                  className="slot-foto__hapus"
                  onClick={() => buangFoto(f)}
                  aria-label="Hapus foto"
                >
                  ✕
                </button>
              </div>
            ))}
            {bisaTambahFoto &&
              Array.from({ length: MAKS_FOTO - foto.length }).map((_, i) => (
                <div key={`kosong-${i}`} className="slot-foto" aria-hidden="true">
                  +
                </div>
              ))}
          </div>

          {bisaTambahFoto && (
            <>
              {!produk && (
                <p className="hint" style={{ marginTop: "0.5rem" }}>
                  Simpan barang dulu, lalu tambahkan foto.
                </p>
              )}
              {produk && (
                <div className="grid2" style={{ marginTop: "0.5rem" }}>
                  <button type="button" className="btn btn--ghost btn--small" onClick={() => inputKamera.current?.click()}>
                    Ambil Foto
                  </button>
                  <button type="button" className="btn btn--ghost btn--small" onClick={() => inputGaleri.current?.click()}>
                    Pilih Galeri
                  </button>
                </div>
              )}
            </>
          )}

          {!bisaTambahFoto && <p className="hint">Maksimal 3 foto.</p>}

          <input
            ref={inputKamera}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) prosesFoto(f);
            }}
          />
          <input
            ref={inputGaleri}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) prosesFoto(f);
            }}
          />

          <IndikatorProgresFoto progres={progres} />
          <IndikatorUnggah progres={progresUnggahAwal()} />

          {pesanFoto && (
            <p className="soft" style={{ margin: "0.25rem 0 0" }} role="status">
              {pesanFoto}
            </p>
          )}
        </div>

        <details>
          <summary style={{ minHeight: "3rem", display: "flex", alignItems: "center", fontWeight: 700 }}>
            Isian tidak wajib (kode, catatan)
          </summary>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.5rem" }}>
            <div>
              <label htmlFor="kode">Kode barang</label>
              <input id="kode" value={kode} onChange={(e) => setKode(e.target.value)} placeholder="Contoh: BL-01" />
            </div>
            <div>
              <label htmlFor="catatan">Catatan</label>
              <input
                id="catatan"
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                placeholder="Contoh: Bahan linen, warna krem"
              />
            </div>
          </div>
        </details>

        {produk && onArsip && (
          <button type="button" className="btn btn--ghost btn--small" onClick={onArsip}>
            Arsipkan barang
          </button>
        )}
      </div>

      <div className="bottombar">
        <button type="button" className="btn btn--primary" onClick={simpan} disabled={menyimpan}>
          {menyimpan ? "Menyimpan…" : "Simpan Barang"}
        </button>
        <button type="button" className="btn btn--ghost btn--small" onClick={onBatal}>
          Batal
        </button>
      </div>
    </>
  );
}
