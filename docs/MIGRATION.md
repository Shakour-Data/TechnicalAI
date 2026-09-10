# TechnicalAI Migration Guide

## Purpose

This guide records the repository-structure changes and the safe migration path for developers.

## Completed migrations

- Root-level verification screenshots and chart images were removed from the working tree. Product images remain under `public/images/` and are referenced by the frontend.
- Runtime artifacts under `.next/`, `tool-results/`, `e2e-screenshots/`, `screenshots/`, `upload/`, `Ollama/`, `.zscripts/`, `agent-ctx/`, and `docs/dfd/` were removed from the working tree and added to `.gitignore`.
- Python bytecode caches under `mini-services/` were removed and ignored.
- Local `.env` was removed from the working tree. The committed `.env.template` is the source of truth for local configuration.
- Root-level operational scripts and deployment manifests are intended to live under `scripts/` and `deployment/` respectively.

## Developer workflow

1. Copy `.env.template` to `.env` and fill only local values.
2. Install dependencies with the package manager used by the service being developed.
3. Run frontend commands from the repository root.
4. Run each service from its own `mini-services/<service>/` directory.
5. Store runtime logs in `logs/`; do not commit them.
6. Put new documentation in the appropriate `docs/` subfolder and update this map if the layout changes.

## Broken-reference checks

Before merging a structure change, run the repository lint/typecheck commands and search for old paths in source and documentation. Update imports and asset references to the canonical locations listed in `docs/STRUCTURE.md`.

## History policy

Do not rewrite public Git history during normal development. If a large generated file was accidentally committed, create a new cleanup commit after a reviewed `git filter-repo --dry-run`; use history rewriting only on a private branch with team coordination.
