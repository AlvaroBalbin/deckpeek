import { NextResponse, type NextRequest } from "next/server";

// No accounts: a viewer cookie is the only "identity". Your decks are the ones
// created under your browser. Only set it on owner pages, never on /v.
export function proxy(req: NextRequest) {
  const res = NextResponse.next();
  if (!req.cookies.get("dp_owner")) {
    res.cookies.set("dp_owner", crypto.randomUUID(), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return res;
}

export const config = {
  matcher: ["/", "/deck/:path*"],
};
