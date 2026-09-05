import { ContentHubHeader } from "../../components/content-hub/ContentHubHeader";
import { EventDirectory } from "../../components/content-hub/EventDirectory";
import { eventItems } from "../../features/content-hub/catalog";
import { headers } from "next/headers";
import { accountSignInPath } from "../../features/identity/account-paths";
import { resolveRequestUserId } from "../../features/identity/request-user";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  let userId: string | null = null;
  try { userId = await resolveRequestUserId(new Request("https://site.local/events", { headers: await headers() })); } catch { /* Public browsing remains available. */ }
  return <main className="content-hub-shell"><ContentHubHeader active="events" /><EventDirectory items={eventItems} signedIn={Boolean(userId)} loginHref={accountSignInPath("/events/submit")} /></main>;
}
