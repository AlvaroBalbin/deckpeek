import { getDeck, getLinkBySlug } from "@/lib/db";
import Viewer from "./Viewer";

export const dynamic = "force-dynamic";

export default async function ViewerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const link = await getLinkBySlug(slug);
  const deck = link ? await getDeck(link.deck_id) : null;

  if (!link || !deck) {
    return (
      <div className="msg tall">
        <div className="card msg-card">
          <div className="msg-icon">&#128269;</div>
          <div className="msg-title">This link doesn&apos;t exist.</div>
          <p className="hint" style={{ marginTop: 6 }}>
            The deck may have been removed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Viewer slug={slug} deckId={deck.id} title={deck.title} numPages={deck.num_pages} />
  );
}
