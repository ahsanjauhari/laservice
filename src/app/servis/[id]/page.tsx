import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { servis, pelanggan, riwayatStatus, pembayaran, kategoriPerangkat, statusServisEnum } from "@/db/schema";
import { wajibSesi } from "@/lib/auth";
import { ubahStatus, setBiaya, bayar } from "@/lib/actions";
const rp = (n: number) => "Rp " + n.toLocaleString("id-ID");
export default async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const s = await wajibSesi();
  const [v] = await db.select({ sv: servis, nama: pelanggan.nama, telp: pelanggan.telepon, kat: kategoriPerangkat.nama }).from(servis)
    .innerJoin(pelanggan, eq(servis.pelangganId, pelanggan.id)).innerJoin(kategoriPerangkat, eq(servis.kategoriId, kategoriPerangkat.id))
    .where(and(eq(servis.id, id), eq(servis.tokoId, s.tokoId)));
  if (!v) notFound();
  const rw = await db.select().from(riwayatStatus).where(eq(riwayatStatus.servisId, id)).orderBy(asc(riwayatStatus.waktu));
  const by = await db.select().from(pembayaran).where(eq(pembayaran.servisId, id));
  const sv = v.sv, dibayar = by.reduce((a, b) => a + b.jumlah, 0), tagihan = Math.max(0, (sv.biayaJasa || sv.estimasiBiaya) - sv.diskon);
  return (<>
    <Link href="/servis">← Kembali</Link><h1>{sv.nomor}</h1>
    <div className="card"><b>{v.nama}</b> · {v.telp}<br />{v.kat}: {sv.merek} {sv.tipe}<br />Keluhan: {sv.keluhan}
      {Object.entries(sv.dataKhusus as Record<string, string>).map(([k, x]) => <div key={k}>{k}: {x}</div>)}</div>
    <div className="card"><h3>Status: {sv.status.replace(/_/g, " ")}</h3>
      <form action={ubahStatus.bind(null, id)}><select name="status" defaultValue={sv.status}>{statusServisEnum.enumValues.map((x) => <option key={x} value={x}>{x.replace(/_/g, " ")}</option>)}</select>
        <input name="catatan" placeholder="Catatan (tampil di riwayat)" /><input name="diagnosa" placeholder="Catatan diagnosa" defaultValue={sv.catatanDiagnosa ?? ""} /><button>Simpan status</button></form>
      {rw.map((r) => <div key={r.id}>• {r.status.replace(/_/g, " ")} — {r.waktu.toLocaleString("id-ID")} {r.catatan && `(${r.catatan})`}</div>)}</div>
    <div className="card"><h3>Biaya & Pembayaran ({sv.statusBayar.replace("_", " ")})</h3>
      <form action={setBiaya.bind(null, id)}><input name="biaya" type="number" placeholder="Biaya akhir (Rp)" defaultValue={sv.biayaJasa || ""} /><input name="diskon" type="number" placeholder="Diskon (Rp)" defaultValue={sv.diskon || ""} /><button className="sec">Simpan biaya</button></form>
      <p>Tagihan {rp(tagihan)} · Dibayar {rp(dibayar)} · Sisa {rp(Math.max(0, tagihan - dibayar))}</p>
      <form action={bayar.bind(null, id)}><input name="jumlah" type="number" placeholder="Jumlah bayar (Rp)" /><select name="metode"><option>tunai</option><option>transfer</option><option>qris</option></select><button>Catat pembayaran</button></form></div>
    <div className="card"><Link href={`/cetak/${id}`}>Cetak tanda terima</Link><br />Link cek status pelanggan: <a href={`/cek/${sv.kodeCek}`}>/cek/{sv.kodeCek}</a></div>
  </>);
}
