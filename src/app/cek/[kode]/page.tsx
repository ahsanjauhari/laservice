import { notFound } from "next/navigation";
import { asc, and, eq } from "drizzle-orm";
import { db } from "@/db";
import { servis, toko, riwayatStatus } from "@/db/schema";
export default async function Cek({ params }: { params: Promise<{ kode: string }> }) {
  const { kode } = await params;
  const [v] = await db.select({ id: servis.id, nomor: servis.nomor, status: servis.status, merek: servis.merek, tipe: servis.tipe, toko: toko.nama })
    .from(servis).innerJoin(toko, eq(servis.tokoId, toko.id)).where(eq(servis.kodeCek, kode));
  if (!v) notFound();
  const rw = await db.select().from(riwayatStatus).where(and(eq(riwayatStatus.servisId, v.id), eq(riwayatStatus.tampilPublik, true))).orderBy(asc(riwayatStatus.waktu));
  return (<><h1>{v.toko}</h1><div className="card"><b>{v.nomor}</b> · {v.merek} {v.tipe}<br />Status: <span className="badge">{v.status.replace(/_/g, " ")}</span></div>
    <div className="card"><h3>Riwayat</h3>{rw.map((r) => <div key={r.id}>• {r.status.replace(/_/g, " ")} — {r.waktu.toLocaleString("id-ID")}</div>)}</div></>);
}
