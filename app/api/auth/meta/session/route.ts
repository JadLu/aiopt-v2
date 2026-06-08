import { NextResponse } from "next/server";
import { cookies } from "next/headers";

interface MetaSession {
  token: string;
  expires: string;
  accounts: { id: string; name: string }[];
}

// Consume the short-lived Meta OAuth session cookie written by the callback
// route. Called once by the advertising page after ?connected=true redirect.
export async function GET() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("meta_session")?.value;
  cookieStore.delete("meta_session");

  if (!raw) return NextResponse.json(null);

  try {
    const data = JSON.parse(
      Buffer.from(raw, "base64").toString("utf-8")
    ) as MetaSession;
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(null);
  }
}
