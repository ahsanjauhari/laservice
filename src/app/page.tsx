import { redirect } from "next/navigation";
import { sesi } from "@/lib/auth";
export default async function Home() { redirect((await sesi()) ? "/servis" : "/login"); }
