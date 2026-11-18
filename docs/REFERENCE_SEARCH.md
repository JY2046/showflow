# Reference search behavior — November 18, 2026

The current free provider is a live public CSV catalog. It contains company names, material titles, years, financing rounds and source links, but no industry descriptions or full presentation text. The app must not infer FDE/agent/foreign-trade relevance from a generic AI label.

- All meaningful query terms must match actual catalog fields for a current result. The hit field is displayed. English matches use word boundaries, so AI does not match Airtable.
- Partial matches list missing terms and are collapsed separately. They are not described as equivalent-company recommendations.
- No current, partial or historical item is selected for AI automatically. Prior links, saved state, IDs and personal notes are preserved when fresh metadata arrives.
- Old search receipts without explicit batches migrate to History. New empty searches keep zero current results, even when the library is full.
- External PDF/PPT searches preserve the complete user query and open a fixed public search engine in a new page. Only the query is transmitted. Results are saved manually; this handoff is not represented as automatic web discovery.
- The user currently has no search-service account and chose to improve the existing free search. No paid provider or unverified scraped-search feed is enabled.

Acceptance examples: `Front` returns a company hit; `Front 2016` also checks year; `Front 外贸` is partial only; `FDE企业服务，AI agent构建，出海外贸` returns zero when unsupported. The last example must not automatically return Replit or Deepgram.
