// /bounty has been repositioned to /bards — same submission flow, reframed
// from "bounty paid in $COMMON" to "tribute, exposure-based." The redirect
// keeps existing inbound links and shared social posts working.
//
// Internal API names (/api/bounty-submit, /api/bounty-vote, /api/bounty-upload)
// are unchanged and still consumed by the new page; only the user-facing
// route moved.

import { redirect } from "next/navigation";

export const metadata = { robots: "noindex" };

export default function BountyRedirect() {
  redirect("/bards");
}
