# Atlas Knowledge Routing

How Atlas decides which knowledge snippets to ground each reply on.

## High level

```
user sends a message on /atlas (with assistant selected)
    └─> /api/ai/chat
          ├─ saves user message to chat_messages
          ├─ retrieveForAssistant(assistant_id, message)   ← lib/atlas/retrieval.ts
          │     1. read assistant_knowledge_access → collection_ids
          │     2. extract keywords from the user message (stopwords filtered)
          │     3. ilike OR-match knowledge_items.title + .content
          │     4. score: title hits × 3 + content hits × 1
          │     5. return top 5 hits with title, excerpt, score, source_path
          ├─ renders the hits as a trailing system-prompt block:
          │     ## Knowledge sources
          │     ### 1. <title>     _source: <relative path>_
          │     <360-char excerpt centred on the matched keyword>
          │     ...
          ├─ runChat(messages + knowledge block)
          ├─ saves assistant response with metadata.knowledge_hits = N
          ├─ inserts retrieval_references rows (message_id ↔ item_id)
          └─ response JSON includes:
                knowledge.count = N
                knowledge.sources = [{title, source_path}, ...]
```

The Atlas UI then renders a small **"Using N knowledge sources"** pill
under the assistant message. Hovering the pill shows the titles and
source paths via the native `title` attribute.

## Why keyword for v0

Vector embeddings + cosine similarity is the right long-term answer, but
needs an embedding provider + a vector column (pgvector) + an indexer
run. v0 keyword retrieval is good enough to demonstrate grounding while
the kits are small (~300 items) — and it costs zero tokens for the
embed/store side.

## Stopwords

Trimmed before scoring:

```
a, an, and, are, as, at, be, but, by, for, from, how, i, if, in, is, it,
me, my, of, on, or, so, that, the, this, to, us, was, we, what, when,
where, which, who, why, with, you, your, please, hello, hi, hey, thanks,
tell, give
```

## Scoring

For each retained keyword:

- Hit count in `title` × 3
- Hit count in `content` × 1

Sum across keywords. Items with score 0 are dropped. Top 5 returned.

## Excerpt selection

For each hit, an excerpt of up to 360 characters is built. If the
top-scoring keyword appears in the content, the excerpt is centred on
its first occurrence (80 chars of left context). Otherwise the first
360 characters are used.

## Token budget

Five hits × ~360 chars ≈ 1,800 chars of grounding text + headers ≈
~600 tokens. Comfortably fits even the smallest free models.

## Failure modes

- **No assistant selected:** retrieval is skipped. The chat works
  exactly like before the knowledge layer.
- **Assistant has no `assistant_knowledge_access` rows:** retrieval
  returns `[]`. No knowledge block in the prompt; no pill in the UI.
- **All items short or unmatched:** retrieval returns `[]` — same as
  above. The model answers from its own training.
- **Service-role unavailable:** retrieval logs an error and returns
  `[]`. The chat still works, just ungrounded.

## What's logged

- `chat_messages.metadata.knowledge_hits` — count of hits used for this
  reply.
- `retrieval_references` — one row per (assistant message, knowledge
  item) pair, with `score`, `excerpt`, and `metadata.source_path`. RLS
  on `retrieval_references` allows the thread owner and the org owner to
  read these.

## Next slices (deferred)

- **Embeddings + pgvector.** Replace the keyword score with vector
  similarity. Single column on `knowledge_items` + an embedder.
- **Citations in the assistant reply.** Render the source list inline
  under the message instead of (or in addition to) the hover-only pill.
- **Per-assistant overrides.** Currently every assistant uses the same
  retrieval limit (5) and the same scoring. Could be customised per
  assistant via `atlas_assistants.metadata.retrieval`.
