"use client";
import { useState } from "react";
type K = { id: string; nama: string; fields: { kunci: string; label: string; wajib: boolean }[] };
export default function FormServis({ kategori, action }: { kategori: K[]; action: (f: FormData) => void }) {
  const [kid, setKid] = useState(kategori[0]?.id ?? "");
  const k = kategori.find((x) => x.id === kid);
  return (<form action={action}>
    <select name="kategori" value={kid} onChange={(e) => setKid(e.target.value)}>{kategori.map((x) => <option key={x.id} value={x.id}>{x.nama}</option>)}</select>
    <input name="nama" placeholder="Nama pelanggan" required /><input name="telepon" placeholder="No. telepon / WA" required />
    <input name="merek" placeholder="Merek" /><input name="tipe" placeholder="Tipe / model" />
    {k?.fields.map((f) => <input key={k.id + f.kunci} name={"f_" + f.kunci} placeholder={f.label} required={f.wajib} />)}
    <textarea name="keluhan" placeholder="Keluhan" required rows={3} /><input name="estimasi" type="number" min={0} placeholder="Estimasi biaya (Rp)" />
    <button>Simpan & lanjut</button></form>);
}
