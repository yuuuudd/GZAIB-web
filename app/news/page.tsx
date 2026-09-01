import { ContentHubHeader } from "../../components/content-hub/ContentHubHeader";
import { NewsEditorial } from "../../components/content-hub/NewsEditorial";
import { newsItems } from "../../features/content-hub/catalog";

export default function NewsPage() {
  return (
    <main className="content-hub-shell news-page-shell">
      <ContentHubHeader active="news" />
      <NewsEditorial items={newsItems} />
    </main>
  );
}
