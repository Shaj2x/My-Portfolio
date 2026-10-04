import { NextResponse } from "next/server";
import { dispatchNotifications } from "@/lib/notify";
import { hasBearer } from "@/lib/internal-auth";

// Backend services (Go ingestion/automation) call this right after they
// create notifications so delivery doesn't wait for the next tick.
export async function POST(request: Request) {
  if (!hasBearer(request, "INTERNAL_API_SECRET")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await dispatchNotifications());
}
