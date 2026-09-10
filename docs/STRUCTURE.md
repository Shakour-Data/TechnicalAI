# TechnicalAI Structure

This document describes the canonical folder layout of the repository.

## Top-level layout

- `src/` — Next.js/TypeScript frontend application.
- `mini-services/` — Backend and utility services.
- `prisma/` — Prisma schema and migrations.
- `db/` — Development database artifacts.
- `docs/` — API, architecture, guides, user manual, and development documentation.
- `deployment/` — Docker Compose and Kubernetes manifests.
- `scripts/` — Operational shell and Node scripts.
- `tests/` — Unit and end-to-end tests.
- `public/` — Static web assets.
- `logs/` — Runtime logs (ignored by Git).

## Service boundaries

- `mini-services/finpy-tse/` — TypeScript TSE index fetcher.
- `mini-services/finpy-tse-service/` — FastAPI/Python TSE service.
- `mini-services/ml-service/` — Python ML service.
- `mini-services/ml-trainer/` — Python model trainer.
- `mini-services/tsetmc-index-service/` — Node.js TSETMC index service.
- `mini-services/dev-keepalive/` — Development keep-alive helper.

## Generated artifacts

- `node_modules/`, `.next/`, `__pycache__/`, and `logs/` are generated or runtime directories and must not be committed.
- Lock files are retained only where a service explicitly uses them.
- Runtime screenshots and chart exports are ignored unless they are product assets under `public/`.

## Documentation

- `docs/STRUCTURE.md` — This structure map.
- `docs/MIGRATION.md` — File and path migration guide.
- `docs/architecture/` — UML, DFD, and BPMN design documents.
- `docs/guides/` — Operational and development guides.
- `docs/api/` — API contracts and reference material.
- `docs/user-manual/` — End-user documentation.
- `docs/development/` — Service-specific development notes.
