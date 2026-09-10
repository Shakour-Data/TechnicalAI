# TechnicalAI

A hybrid Next.js/TypeScript frontend with Python/Node mini-services, PostgreSQL/Prisma persistence, and Docker/Kubernetes deployment support.

## Quick start

1. Copy `.env.template` to `.env` and configure local values.
2. Install dependencies for the frontend and the service you are developing.
3. Run the frontend from the repository root.
4. Run services from their directories under `mini-services/`.
5. See `docs/STRUCTURE.md` for the folder map and `docs/MIGRATION.md` for migration notes.

## Documentation

- [Structure map](docs/STRUCTURE.md)
- [Migration guide](docs/MIGRATION.md)
- [Architecture](docs/architecture/)
- [Development guides](docs/guides/)
- [API reference](docs/api/)
- [User manual](docs/user-manual/)

## Maintenance

Generated directories and runtime artifacts are ignored by Git. Keep lock files only where the corresponding service explicitly uses them.
