import { connection } from "next/server";
import { json } from "@/lib/http";

export async function GET() {
  await connection();
  return json({ ok: true, time: new Date().toISOString() });
}
