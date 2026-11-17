/*
 * Pembungkus `vite build`.
 *
 * Di sebagian mesin (termasuk mesin pengembangan ini) esbuild gagal menghapus
 * berkas sementara di folder system temp ("Access is denied"). Skrip ini
 * mengarahkan TMP/TEMP/ESBUILD_TMPDIR ke folder di dalam proyek, lalu menjalankan
 * `vite build`, dan membersihkannya setelah selesai.
 *
 * Tidak mengubah keluaran build; hanya lokasi berkas sementara.
 *
 * Logo: sebelum build, skrip ini mendekode
 * src/assets/logo-kayesa.png.b64 menjadi public/logo-kayesa.png, supaya
 * logo ikut ter-copy ke dist/ dan bisa di-fetch seed demo. Logo disimpan
 * sebagai base64 (bukan PNG biner) karena tool GitHub Muse hanya bisa
 * push file teks UTF-8 — keputusan Andri 17 Nov 2026: logo dibundel ke
 * repo sebagai default. Bila file .b64 tidak ada, build tetap jalan
 * tanpa logo (seed tetap jalan, logo null).
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const logoB64 = join(process.cwd(), "src", "assets", "logo-kayesa.png.b64");
const logoPng = join(process.cwd(), "public", "logo-kayesa.png");
if (existsSync(logoB64)) {
  const b64 = readFileSync(logoB64, "utf8")
    .split("\n")
    .filter((baris) => !baris.startsWith("#") && baris.trim() !== "")
    .join("");
  writeFileSync(logoPng, Buffer.from(b64, "base64"));
}

const tmp = join(process.cwd(), ".tmp-esbuild");
mkdirSync(tmp, { recursive: true });

const hasil = spawnSync(process.execPath, [join("node_modules", "vite", "bin", "vite.js"), "build"], {
  stdio: "inherit",
  env: { ...process.env, TMP: tmp, TEMP: tmp, ESBUILD_TMPDIR: tmp },
});

if (existsSync(tmp)) rmSync(tmp, { recursive: true, force: true });
process.exit(hasil.status ?? 1);
