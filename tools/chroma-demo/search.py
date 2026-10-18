"""Semantic search over the locally indexed sample transactions.

    tools/chroma-demo/.venv/bin/python tools/chroma-demo/search.py
    tools/chroma-demo/.venv/bin/python tools/chroma-demo/search.py "your query"

With no argument it runs the demo queries and rewrites RESULTS.md. With a
query argument it prints that one search and leaves RESULTS.md alone.

Distances are cosine distances from Chroma's default local embedding model:
lower is a closer match. They are similarity scores, not a judgement that a
row actually belongs to the query.
"""

from __future__ import annotations

import datetime as dt
import pathlib
import sys

import chromadb
from chromadb.utils import embedding_functions

HERE = pathlib.Path(__file__).resolve().parent
CHROMA_PATH = HERE / ".chroma"
COLLECTION = "transactions"
RESULTS = HERE / "RESULTS.md"
TOP_K = 5

DEMO_QUERIES = [
    "late night supper",
    "getting to school",
    "coffee and breakfast",
    "printing and school supplies",
    "entertainment and going out",
]

FILTERED_QUERY = ("something to eat", {"month": "2026-10"})


def open_collection():
    client = chromadb.PersistentClient(path=str(CHROMA_PATH))
    return client.get_collection(
        name=COLLECTION,
        embedding_function=embedding_functions.DefaultEmbeddingFunction(),
    )


def run(collection, query: str, where: dict | None = None):
    kwargs = {"query_texts": [query], "n_results": TOP_K}
    if where:
        kwargs["where"] = where
    res = collection.query(**kwargs)
    rows = []
    for distance, meta in zip(res["distances"][0], res["metadatas"][0]):
        rows.append(
            {
                "distance": distance,
                "description": meta["description"],
                "category": meta["categoryLabel"],
                "date": meta["date"],
                "amount": f"S${meta['amountCents'] / 100:.2f}",
            }
        )
    return rows


def table(rows) -> list[str]:
    out = [
        "| # | distance | description | category | date | amount |",
        "|---|---|---|---|---|---|",
    ]
    for i, r in enumerate(rows, 1):
        out.append(
            f"| {i} | {r['distance']:.4f} | {r['description']} | "
            f"{r['category']} | {r['date']} | {r['amount']} |"
        )
    return out


def plain(query: str, rows, where: dict | None = None) -> None:
    label = f'"{query}"' + (f"  where={where}" if where else "")
    print(f"\n{label}")
    for i, r in enumerate(rows, 1):
        print(
            f"  {i}. {r['distance']:.4f}  {r['description']:<22} "
            f"{r['category']:<18} {r['date']}  {r['amount']}"
        )


def main(argv: list[str]) -> int:
    if not CHROMA_PATH.exists():
        print(
            "No index found. Run build_index.py first.",
            file=sys.stderr,
        )
        return 1

    collection = open_collection()

    # Ad-hoc single query: print it and stop.
    if len(argv) > 1:
        query = " ".join(argv[1:])
        plain(query, run(collection, query))
        return 0

    lines = [
        "# ChromaDB semantic search results",
        "",
        f"Run on {dt.date.today().isoformat()} against "
        f"{collection.count()} invented sample transactions "
        "(`tools/chroma-demo/sample-transactions.json`).",
        "",
        "Embedding model: Chroma's default `DefaultEmbeddingFunction`, which is "
        "`all-MiniLM-L6-v2` running locally under onnxruntime. No API key and no "
        "paid call is involved.",
        "",
        "Distance is cosine distance: lower is a closer match. A low distance "
        "means the sentence embeddings are near each other, not that the row is "
        "necessarily a correct answer to the question.",
        "",
    ]

    for query in DEMO_QUERIES:
        rows = run(collection, query)
        plain(query, rows)
        lines += [f'## "{query}"', "", *table(rows), ""]

    query, where = FILTERED_QUERY
    rows = run(collection, query, where)
    plain(query, rows, where)
    lines += [
        f'## "{query}" filtered to `where={{"month": "2026-10"}}`',
        "",
        "The metadata filter is exact, so only October 2026 rows are eligible; "
        "the ranking within them is still semantic.",
        "",
        *table(rows),
        "",
    ]

    RESULTS.write_text("\n".join(lines))
    print(f"\nWrote {RESULTS}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
