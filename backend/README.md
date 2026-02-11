# UAS Backend API

> **Status:** ⬜ Phase 5 — Not started
> **Depends on:** Phase 1 (specs for profiles and state)

## Purpose

The backend provides cloud features: authentication, profile storage, install history, and catalog metadata. It supports both a hosted service and self-hosted deployment.

## Responsibilities

- User authentication and account management
- Profile storage and retrieval (CRUD)
- Install history tracking (per-user, per-machine)
- Catalog metadata (popularity, validation status)
- API for CLI and Desktop sync operations

## Boundaries

- The backend **never** executes installation logic — that runs client-side
- The backend **never** sends executable code to clients
- All API responses are validated client-side against schemas
- HTTPS only

## Trust Model

See [/docs/security-model.md](../docs/security-model.md) for trust boundaries.

## Implementation

_Will be built when Phase 5 begins._
