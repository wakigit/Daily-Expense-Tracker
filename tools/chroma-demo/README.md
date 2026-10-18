# Local ChromaDB semantic search (prototype)

A small, self-contained experiment that indexes TallyAI's invented sample
transactions in a local [ChromaDB](https://www.trychroma.com/) vector database
and searches them by meaning rather than by exact text.

It is separate from the app on purpose. Nothing here is imported by `src/`,
`api/` or `backend/src/`, and running it cannot change how the deployed app
behaves. The only thing it reads from the app is the sample-data generator.

## Why

The app's Ask feature is deliberately exact. A question becomes a structured
query (period, category, description substring, amount condition) and the
answer is calculated locally in integer cents, so every figure is checkable.
That design is the point, but it means a question only matches what it literally
asks for: a description filter for "supper" finds rows containing "supper" and
nothing else.

Semantic search complements that. "late night supper" finds `Supper prata`,
"getting to school" finds `Grab to campus`, and "printing and school supplies"
finds `Printing credit` and `Notebook and pens`, none of which share the query's
words. The two approaches answer different questions: structured queries tell
you how much, a vector search helps you find the rows in the first place.

I built this to understand what a vector database actually does before deciding
whether it belongs in the app.

## Run it

Requires Node (for the export) and a Python 3.12, 3.13 or 3.14 interpreter whose
`venv` and `pip` work. See the note at the bottom about this machine.

```sh
node tools/chroma-demo/export-sample.mjs                       # write sample-transactions.json
python3 -m venv tools/chroma-demo/.venv                        # create the venv
tools/chroma-demo/.venv/bin/pip install -r tools/chroma-demo/requirements.txt
tools/chroma-demo/.venv/bin/python tools/chroma-demo/build_index.py
tools/chroma-demo/.venv/bin/python tools/chroma-demo/search.py
```

The first index build downloads the embedding model once (about 79 MB) into
Chroma's own cache under `~/.cache/chroma`.

`search.py` with no argument runs the six demo queries and rewrites
[RESULTS.md](RESULTS.md). Pass a query to search for one thing instead:

```sh
tools/chroma-demo/.venv/bin/python tools/chroma-demo/search.py "cheap noodles"
```

## What is in here

| File | What it does |
|---|---|
| `export-sample.mjs` | Imports `buildSample` from `src/lib/sampleData.js` and writes `sample-transactions.json` |
| `build_index.py` | Embeds one sentence per transaction into a persistent Chroma collection, upserting by id |
| `search.py` | Runs the demo queries (or one of your own) and writes `RESULTS.md` |
| `requirements.txt` | The chromadb version actually installed and run |
| `sample-transactions.json` | The exported invented data, committed so the export is reviewable |
| `RESULTS.md` | Real output from a real run, with the date |
| `.venv/`, `.chroma/` | Git-ignored. Rebuildable from the two commands above |

Embeddings come from Chroma's default embedding function, `all-MiniLM-L6-v2`
running locally under onnxruntime. There is no OpenAI call here, no API key and
no paid request, which is deliberate: this tool should cost nothing to run and
should work with no network after the model is cached.

## Honest limitations

- **This is a local prototype, not a feature.** It is not wired into the
  deployed web app, and the app does not query it.
- **It is not the app's storage.** Real entries live in each user's browser
  `localStorage` and are never read, copied or uploaded by this tool. Chroma
  here holds only the invented demo rows from `src/lib/sampleData.js`. No real
  transaction, bank statement, card or account is involved.
- **Semantic matches are loose.** A nearest-neighbour search always returns the
  top five rows, so it returns five even when nothing is a good match, and the
  distances are similarity scores rather than a judgement that a row answers the
  question. In [RESULTS.md](RESULTS.md) "coffee and breakfast" ranks `Bubble tea`
  above `Toast Box`, which is not the order a person would pick.
- **It would not replace the structured queries.** If this ever reached the app
  it would find candidate rows, and the existing integer-cent engine would still
  compute every figure. I am not going to let an embedding model near the
  arithmetic.
- **Shipping it would need a different design.** The browser has no local
  ChromaDB, so this would mean either a hosted vector service (and sending
  spending data off the device, which the app currently never does) or an
  in-browser embedding model. Both are real decisions, not configuration, and
  neither is made yet.

## Note on Python on this Mac

The Homebrew `python@3.13` install here is broken: its `pyexpat` module links a
libexpat symbol the system library does not export, which makes
`platform.mac_ver()` return empty and `python3.13 -m venv` fail during
`ensurepip`. The venv in this directory was therefore built with the python.org
framework build of 3.14.7, which works. `brew reinstall python@3.13` would
probably fix the Homebrew one, but I have not run it.
