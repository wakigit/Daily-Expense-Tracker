"""Build a local ChromaDB index over the app's invented sample transactions.

Run the exporter first so sample-transactions.json exists:

    node tools/chroma-demo/export-sample.mjs
    tools/chroma-demo/.venv/bin/python tools/chroma-demo/build_index.py

Everything here is local. The embedding function is Chroma's default
(ONNXMiniLM_L6_V2, the all-MiniLM-L6-v2 sentence-transformer running under
onnxruntime on this machine), so there is no API key, no OpenAI call and no
paid request. The model file downloads once into Chroma's own cache.

This indexes demonstration data only. Real entries live in each user's browser
localStorage and are never read, copied or sent anywhere by this tool.
"""

from __future__ import annotations

import datetime as dt
import json
import pathlib
import sys

import chromadb
from chromadb.utils import embedding_functions

HERE = pathlib.Path(__file__).resolve().parent
DATA = HERE / "sample-transactions.json"
CHROMA_PATH = HERE / ".chroma"
COLLECTION = "transactions"


def sentence(txn: dict) -> str:
    """One natural sentence per transaction, which is what gets embedded.

    Reads like something a person would say, because that is what the queries
    look like: "S$6.00 Nasi lemak, Food, Saturday 18 Oct 2026".
    """
    date = dt.date.fromisoformat(txn["date"])
    amount = f"S${txn['amountCents'] / 100:.2f}"
    when = date.strftime("%A %-d %b %Y")
    parts = [amount, txn["description"]]
    if txn.get("merchant"):
        parts.append(f"at {txn['merchant']}")
    tail = f"{txn['categoryLabel']}, {when}"
    body = " ".join(parts)
    line = f"{body}, {tail}"
    if txn.get("notes"):
        line = f"{line}. Note: {txn['notes']}"
    return line


def main() -> int:
    if not DATA.exists():
        print(
            f"Missing {DATA.name}. Run: node tools/chroma-demo/export-sample.mjs",
            file=sys.stderr,
        )
        return 1

    payload = json.loads(DATA.read_text())
    transactions = payload["transactions"]

    client = chromadb.PersistentClient(path=str(CHROMA_PATH))
    # Named explicitly rather than relying on the implicit default, so it is
    # obvious from the code which model produces the vectors.
    embedder = embedding_functions.DefaultEmbeddingFunction()
    collection = client.get_or_create_collection(
        name=COLLECTION,
        embedding_function=embedder,
    )

    ids, documents, metadatas = [], [], []
    for txn in transactions:
        date = dt.date.fromisoformat(txn["date"])
        ids.append(txn["id"])
        documents.append(sentence(txn))
        metadatas.append(
            {
                "category": txn["category"],
                "categoryLabel": txn["categoryLabel"],
                "month": txn["date"][:7],
                "date": txn["date"],
                "weekday": date.strftime("%A"),
                "amountCents": txn["amountCents"],
                "description": txn["description"],
            }
        )

    # Upsert by id, so re-running after a fresh export updates rather than
    # duplicating. The sample ids are stable for a given date.
    collection.upsert(ids=ids, documents=documents, metadatas=metadatas)

    print(f"Embedding function: {embedder.__class__.__name__} (all-MiniLM-L6-v2, local)")
    print(f"Indexed {len(ids)} transactions into collection '{COLLECTION}'")
    print(f"Collection now holds {collection.count()} documents at {CHROMA_PATH}")
    print("\nExample documents:")
    for doc in documents[:3]:
        print(f"  {doc}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
