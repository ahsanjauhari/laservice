import { db } from "@/db";
import { kategoriPerangkat, fieldKategori, tokoKategori } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
const DEF: Record<string, { nama: string; f: [string, string][] }> = {
  hp: { nama: "HP", f: [["imei", "IMEI"], ["kunci", "Kunci layar / pola"], ["kelengkapan", "Kelengkapan (charger, SIM, memori)"]] },
  laptop: { nama: "Laptop", f: [["spek", "Spesifikasi"], ["password", "Password"], ["kelengkapan", "Kelengkapan (adaptor, tas)"], ["baterai", "Kondisi baterai"]] },
  pc: { nama: "PC", f: [["komponen", "Komponen utama (CPU/RAM/VGA/PSU)"], ["kelengkapan", "Kelengkapan"]] },
  elektronik: { nama: "Elektronik", f: [["jenis", "Jenis (TV, kulkas, dll.)"], ["serial", "Nomor seri"], ["kelengkapan", "Kelengkapan"]] },
};
export async function pastikanKategori(tokoId: string) {
  for (const [kode, d] of Object.entries(DEF)) {
    let [k] = await db.select().from(kategoriPerangkat).where(and(isNull(kategoriPerangkat.tokoId), eq(kategoriPerangkat.kode, kode)));
    if (!k) {
      [k] = await db.insert(kategoriPerangkat).values({ kode, nama: d.nama }).returning();
      await db.insert(fieldKategori).values(d.f.map(([kunci, label], i) => ({ kategoriId: k.id, kunci, label, urutan: i, sensitif: kunci === "password" || kunci === "kunci" })));
    }
    await db.insert(tokoKategori).values({ tokoId, kategoriId: k.id }).onConflictDoNothing();
  }
}
export async function daftarKategori(tokoId: string) {
  const ks = await db.select({ id: kategoriPerangkat.id, nama: kategoriPerangkat.nama }).from(tokoKategori)
    .innerJoin(kategoriPerangkat, eq(tokoKategori.kategoriId, kategoriPerangkat.id)).where(and(eq(tokoKategori.tokoId, tokoId), eq(tokoKategori.aktif, true)));
  const out = [];
  for (const k of ks) {
    const fields = await db.select({ kunci: fieldKategori.kunci, label: fieldKategori.label, wajib: fieldKategori.wajib }).from(fieldKategori).where(eq(fieldKategori.kategoriId, k.id)).orderBy(fieldKategori.urutan);
    out.push({ ...k, fields });
  }
  return out;
}
