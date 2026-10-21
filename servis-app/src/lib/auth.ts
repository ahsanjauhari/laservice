import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
const key = () => new TextEncoder().encode(process.env.AUTH_SECRET!);
export type Sesi = { uid: string; tokoId: string; peran: string };
export async function buatSesi(s: Sesi) {
  const t = await new SignJWT({ ...s }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("7d").sign(key());
  (await cookies()).set("sesi", t, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 604800 });
}
export async function sesi(): Promise<Sesi | null> {
  const t = (await cookies()).get("sesi")?.value;
  if (!t) return null;
  try { return (await jwtVerify(t, key())).payload as unknown as Sesi; } catch { return null; }
}
export async function wajibSesi() { const s = await sesi(); if (!s) redirect("/login"); return s; }
