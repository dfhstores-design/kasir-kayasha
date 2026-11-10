interface Props {
  namaButik: string;
  jumlahRekening: number;
  adaLogo: boolean;
  onBuka: (bagian: "profil" | "rekening" | "logo") => void;
  onContohResi: () => void;
  onPin: () => void;
}

/**
 * Menu Pengaturan (docs/design/screens/11-pengaturan.md).
 * Daftar pilihan besar — bukan tab kecil.
 */
export default function MenuPengaturan({ namaButik, jumlahRekening, adaLogo, onBuka, onContohResi, onPin }: Props) {
  const item = (judul: string, keterangan: string, aksi: () => void) => (
    <button
      type="button"
      className="navitem"
      style={{ width: "100%", font: "inherit", cursor: "pointer", textAlign: "left" }}
      onClick={aksi}
    >
      <span>
        <strong>{judul}</strong>
        <span className="soft" style={{ display: "block", fontSize: "0.9rem", fontWeight: 400 }}>
          {keterangan}
        </span>
      </span>
      <span aria-hidden="true">›</span>
    </button>
  );

  return (
    <div className="content">
      {item("Nama & kontak butik", namaButik.trim() || "Belum diisi", () => onBuka("profil"))}
      {item("Logo resi", adaLogo ? "Sudah ada" : "Belum ada", () => onBuka("logo"))}
      {item(
        "Rekening tujuan",
        jumlahRekening > 0 ? `${jumlahRekening} rekening` : "Belum ada",
        () => onBuka("rekening"),
      )}
      {item("Lihat contoh resi", "Pratinjau dengan data saat ini", onContohResi)}
      {item("PIN Admin", "Kunci menu admin", onPin)}
      <div className="panel panel--ok">Printer thermal: sedang disiapkan. Saat ini resi berupa PDF.</div>
    </div>
  );
}
