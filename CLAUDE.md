# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

Specification only — no code yet. The repo holds `README.md` and four specs in `docs/` (all in Portuguese):

- [`docs/SPEC.md`](docs/SPEC.md) — the original technical specification. The PRD's `ET §n` references point to its sections.
- [`docs/PRD.md`](docs/PRD.md) — requirements (`FR-nnn`, `NFR-nnn`), open decisions (`DA-nn`, section 18), known spec inconsistencies (`IN-nn`, section 21).
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how the tool is built. Source of truth for design.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — phase checklists.

Next step is phase 1 (Editor). Check the phase 1 checklist in the roadmap before starting work, and tick items as they land.

Open decisions: flag every `DA-nn` a change touches.

Planned commands (from README, not yet real): `npm install`, `npm run dev`, `npm test`. The CLI binary is `arquitecture` (spelled that way; npm name availability still unconfirmed).

## Working rules

- Never run `git commit` or `git push`, and never create branches. The user makes all commits.
- Phase limit: work only on the current phase's roadmap checklist. In phase 1, do not implement the MCP adapter, WebSocket, file watcher, or stdio bridge.
- Language: code, identifiers, and test names in English. Code comments in Portuguese. Documentation and user-facing text in Portuguese, including the `message` and `hint` fields of errors. Error `code` values stay in English as defined (e.g. `PARENT_CYCLE`).

## What the tool is

Local editor (no hosting, no login, no LLM calls) that keeps a software-architecture model in the *target* repo's `docs/architecture.json`, renders it as a drill-down canvas, and lets coding agents edit it over MCP. Started with `npx arquitecture`.

## Architecture (planned)

TypeScript monorepo:

```
packages/
  core/    schema, validation, pure operations — no I/O, depends on nothing
  server/  local Node server: write queue, atomic writes, HTTP + WebSocket, MCP adapter, file watcher
  web/     React + React Flow canvas, ELK auto-layout, embedded Devicon SVGs
  cli/     `arquitecture` command (depends on server); `arquitecture mcp` is a stdio bridge
```

Invariants that span packages:

- **Single writer.** Only the server process writes model files. Web UI and agents send operations; the server applies them through one queue. The stdio bridge forwards to the running server, never writes itself. Concurrency is solved by the queue, not file locks.
- **Write flow:** check `expectedRevision` (mismatch → `REVISION_CONFLICT`) → apply in memory via `core` → validate the *whole* model → atomic write (temp file + rename) → `revision + 1` → notify clients. Invalid result → structured error, nothing written. Publishing `model.changed` over WebSocket is phase 2; in phase 1 the UI updates from the HTTP response of its own operation (PRD inconsistency `IN-05`).
- **`core` is pure and shared** by server and web. Keep I/O out of it.
- **Flat model.** `nodes[]` and `edges[]` are flat lists; hierarchy comes from `node.parent`. Node `id`s are server-generated, opaque, immutable. Edges may cross levels; the canvas draws them to the nearest visible ancestor.
- **Layout is separate.** Positions live in `docs/architecture.layout.json` (`{ schemaVersion: 1, positions: { <id>: { x, y } } }`), so moving a box doesn't touch the semantic model's diff. Written by the server through the same queue, atomically, but never bumps `revision`, never raises `REVISION_CONFLICT`, and no event is published (`model.changed` is for model writes only; cross-tab position sync is out of MVP scope): last write wins. Orphan `id`s are ignored on load and dropped on the next layout write. A missing or invalid layout file blocks nothing — it means "no positions". The UI saves on drop, not during drag. Nodes without position get a simple grid until ELK lands (phase 2). The layout file is read only at server startup; the file watcher tracks only the model, so an external layout edit while running goes undetected and is overwritten on the next write (last write wins). To apply a layout from outside (e.g. after `git checkout`), restart the tool. Resolved as DA-03.
- **Closed enums:** node `kind` = `external|proxy|group|service|frontend|database|cache|queue|storage`; edge `kind` = `sync|async|data`. Unknown `tech` falls back to the `kind` icon.
- **Validation** = JSON Schema (per `schemaVersion`) + integrity rules. Error codes: `SCHEMA_INVALID`, `DUPLICATE_ID`, `PARENT_NOT_FOUND`, `PARENT_CYCLE`, `EDGE_ENDPOINT_NOT_FOUND`, `EDGE_SELF_LOOP`, `EDGE_TO_ANCESTOR`, `LENS_INVALID`, `REVISION_CONFLICT`. Every error carries `code`, `message`, `path` (JSON pointer), `hint` — agents rely on these to self-correct. A malformed layout write is rejected with `SCHEMA_INVALID`, `path` pointing inside the layout file, and nothing is written.
- **External edits:** a file watcher validates outside changes to the JSON. Valid → adopt and bump revision. Invalid → keep last valid model in memory, publish `model.invalid`, refuse writes until fixed/restored.
- **Lenses** (`data`, `security`) are internal registered modules (`name`, `appliesTo`, `schema`, `View`, optional `importers`), stored under `node.lenses[name]`. Unknown lenses are preserved without validation. Not a public plugin API.
- **Stable serialization:** key order must be deterministic so Git diffs stay readable.
- Server listens on `127.0.0.1` only.

## Testing expectations (from roadmap)

`core` needs unit tests per operation and per error code, a property test (random valid operation sequences always validate), and a round-trip test (load → save → reload yields identical content).
