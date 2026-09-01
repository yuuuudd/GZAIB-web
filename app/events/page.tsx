import { ContentHubHeader } from "../../components/content-hub/ContentHubHeader";
import { EventDirectory } from "../../components/content-hub/EventDirectory";
import { eventItems } from "../../features/content-hub/catalog";

export default function EventsPage() {
  return (
    <main className="content-hub-shell events-page-shell">
      <ContentHubHeader active="events" />
      <EventDirectory items={eventItems} />
    </main>
  );
}
