# VaultOps — Secrets Engine

![Node.js](https://img.shields.io/badge/Node.js-20_LTS-339933?style=flat-square&logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=flat-square&logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)
![Jest](https://img.shields.io/badge/Jest-30-C21325?style=flat-square&logo=jest&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)

A production-grade **Secrets and Configuration Management Engine** modelled after Doppler / HashiCorp Vault / Infisical. Built as a full-stack Node.js + React application with envelope encryption, policy-based access control, tamper-evident audit logging, an approval workflow, and a Redis read-through cache.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Encryption Architecture](#encryption-architecture)
- [Access Control Model](#access-control-model)
- [Audit Chain](#audit-chain)
- [Approval Workflow](#approval-workflow)
- [Cache Tradeoffs](#cache-tradeoffs)
- [Running Locally](#running-locally)
- [API Reference](#api-reference)
- [Testing](#testing)
- [Known Limitations](#known-limitations)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend                        │
│  Secrets List · Slide-Over · Approvals · Audit Log      │
└───────────────────────┬─────────────────────────────────┘
                        │ Bearer token (every request)
┌───────────────────────▼─────────────────────────────────┐
│                  Express API  :3000                      │
│                                                          │
│  authenticate() → resolvePrincipalFromToken()            │
│  authorize()    → resolvePermissions() (policyEngine)    │
│                                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │   Secrets   │  │   Change     │  │     Audit     │  │
│  │   Service   │  │   Requests   │  │     Logger    │  │
│  └──────┬──────┘  └──────┬───────┘  └───────┬───────┘  │
│         │                │                   │          │
│  ┌──────▼──────┐  ┌──────▼───────┐           │          │
│  │  Envelope   │  │  Expiry Job  │           │          │
│  │ Encryption  │  │ (60s poll)   │           │          │
│  └──────┬──────┘  └──────────────┘           │          │
│         │                                    │          │
│  ┌──────▼──────┐                             │          │
│  │Secret Cache │                             │          │
│  │   (Redis)   │                             │          │
│  └─────────────┘                             │          │
└──────────────────────────────────────────────┼──────────┘
                                               │
┌──────────────────┐  ┌────────────┐  ┌────────▼─────────┐
│   Mock KMS :3001 │  │ PostgreSQL │  │      Redis        │
│ generate-data-key│  │    :5432   │  │      :6379        │
│ decrypt-data-key │  └────────────┘  └──────────────────┘
└──────────────────┘
```

---

## Encryption Architecture

VaultOps uses **envelope encryption** - the same model used by AWS KMS, Google Cloud KMS, and HashiCorp Vault.

### Why envelope encryption?

Storing secrets encrypted with a single master key has one catastrophic failure mode: if the master key leaks, every secret is compromised. Envelope encryption solves this by introducing a per-secret **data key**.

### How it works

```
WRITE a secret:
  1. Call Mock KMS  →  POST /generate-data-key
                       Returns { plaintext_key, encrypted_key }
  2. AES-256-GCM encrypt(secret_value, plaintext_key)
     → produces { iv, authTag, ciphertext } packed as base64
  3. plaintext_key.fill(0)   ← zeroed from memory immediately
  4. Store in DB:
       encrypted_value    = base64(iv + authTag + ciphertext)
       encrypted_data_key = encrypted_key  (KMS-wrapped)
       kms_key_id         = "master-key-v1"

READ a secret:
  1. Load { encrypted_value, encrypted_data_key } from DB
  2. Call Mock KMS  →  POST /decrypt-data-key(encrypted_data_key)
                       Returns { plaintext_key }
  3. AES-256-GCM decrypt(encrypted_value, plaintext_key)
  4. plaintext_key.fill(0)   ← zeroed from memory immediately
  5. Return plaintext to caller
```

### Security properties

| Property                 | Guarantee                                                      |
| ------------------------ | -------------------------------------------------------------- |
| DB dump exposure         | Attacker gets ciphertexts + wrapped keys — useless without KMS |
| Per-secret isolation     | Each secret has a unique random 256-bit data key               |
| Authenticated encryption | AES-256-GCM auth tag detects any ciphertext tampering          |
| Key never persisted      | `plaintext_key` buffer zeroed immediately after use            |
| KMS abstraction          | Drop-in replacement for real AWS KMS in production             |

### Mock KMS

`mock-services/src/kms.mock.ts` is a standalone Express server on port `3001` that simulates AWS KMS. It holds master keys in memory (regenerated on restart - intentionally, since this is a local dev mock), implements `AES-256-GCM` wrapping of data keys, and exposes a `/rotate-master-key` stub. In production, replace `KMS_URL` with a real KMS endpoint; the `envelopeEncryption.ts` interface does not change.

---

## Access Control Model

### Policy evaluation

Access is governed by rows in `secret_access_policies`. Each policy grants a set of permissions to a **principal** (user, service account, CI token, or team) scoped to a project, a set of environments, and optionally a key name glob pattern.

```
resolvePermissions(principal, projectId, environment, keyName):
  1. Fetch all policies WHERE project_id = ? AND principal_id = ?
  2. Filter: environment ∈ policy.environments
  3. Filter: key_name matches policy.key_pattern (glob) — or pattern IS NULL (all keys)
  4. Filter: policy.expires_at IS NULL OR > NOW()
  5. OR-merge all matching policies → most permissive wins
  6. If principal.type = 'ci_token' → force can_delete=false, can_manage_policies=false
  7. Return { can_read, can_write, can_delete, can_manage_policies }
```

### Key pattern semantics

`key_pattern` uses glob matching. `DB_*` matches `DB_PASSWORD` and `DB_HOST` but not `API_KEY`. `NULL` means the policy applies to all keys in the project. Patterns are matched case-sensitively.

### CI token restrictions

CI tokens are service accounts with `is_ci_token = true`. Regardless of what policies grant them, `can_delete` and `can_manage_policies` are **always forced to false** in the policy engine. This prevents a compromised CI pipeline from destroying secrets or escalating its own permissions.

### Token resolution

Every request must carry a `Bearer` token. The token is SHA-256 hashed and looked up in `service_accounts.token_hash` (for service accounts and CI tokens) or `users.token_hash` (for users). Revoked service accounts (`revoked_at IS NOT NULL`) are rejected at resolution time.

---

## Audit Chain

Every write to `audit_log` computes a chain hash that links it to the previous entry:

```
chain_hash[n] = SHA-256(
  chain_hash[n-1]  +
  event_type       +
  resource_id      +
  occurred_at      +
  actor_id
)

chain_hash[0] = SHA-256("GENESIS" + event_fields)
```

This forms an append-only hash chain. If any historical row is modified (`UPDATE audit_log SET ...`), every subsequent `chain_hash` becomes invalid. The `GET /api/v1/orgs/:orgId/audit/verify` endpoint replays the entire chain from the genesis hash and returns `{ valid: boolean, first_broken_at?: number }`.

**What "tamper-evident" means in practice:** it does not prevent tampering (an attacker with DB write access can recalculate hashes). It provides **detection** - an auditor running `verify` will see exactly which entry was the first to break the chain. For stronger guarantees in production, ship chain hashes to an external append-only log (e.g. AWS CloudTrail, a transparency log).

---

## Approval Workflow

Changes to environments listed in `project.require_approval_for` (default: `['production']`) go through a review gate instead of being applied immediately.

### State machine

```
                write to protected env
                        │
                        ▼
                   [pending] ─────────────── 72h timer ──► [expired]
                        │
            ┌───────────┴────────────┐
            ▼                        ▼
       [approved]               [rejected]
            │                   (requires review_note)
            ▼
      apply secret write
            │
            ▼
        [applied]
```

### Rules enforced in code

| Rule                                   | Implementation                                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------------- |
| Self-approval blocked                  | `cr.requested_by === principal.id` → 403                                                    |
| Only managers can approve              | `can_manage_policies` required                                                              |
| Expired requests cannot be approved    | `expires_at < NOW()` → 410                                                                  |
| Expiry background job                  | `setInterval` every 60s, marks stale pending requests as `expired`                          |
| Encrypted value stored at request time | New value is envelope-encrypted when the change request is created, not when it is approved |

---

## Cache Tradeoffs

The read-through cache stores **decrypted plaintext values** in Redis, keyed by `secret:{project_id}:{environment}:{key_name}` with a TTL of 5 minutes.

**Why plaintext?** Caching the encrypted blob would require a KMS round-trip on every cache hit, defeating the purpose. The cache exists to eliminate DB + KMS latency on hot paths (e.g. a service fetching its DB password 100×/min).

**The tradeoff:** Redis is treated as a trusted in-cluster component. If Redis is compromised, cached secret values are exposed in plaintext. Mitigations in production:

- Enable Redis AUTH + TLS
- Use Redis with encryption-at-rest
- Reduce TTL for highly sensitive secrets
- Or: cache only encrypted values and accept the KMS latency cost

**Cache invalidation:** any write or delete to a secret calls `secretCache.invalidate(projectId, environment, keyName)` which issues a `DEL` command immediately, ensuring stale values are never served after a rotation.

---

## Running Locally

### Prerequisites

- Node.js 20+
- Docker + Docker Compose

### 1. Start infrastructure

```bash
docker compose up -d
```

### 2. Start Mock KMS

```bash
cd mock-services
npm install
npm run dev
# Running on http://localhost:3001
```

### 3. Run migrations

```bash
cd backend
npm install
npm run migrate
```

### 4. Seed data

```bash
npm run seed
# Seeds 10 orgs, 15 projects, 336 secrets, 50+ users, 500 audit entries
```

### 5. Start backend

```bash
npm run dev
# API running on http://localhost:3000
```

### 6. Start frontend

```bash
cd frontend
npm install
npm run dev
# UI running on http://localhost:5173
```

### Available dev tokens

| Token              | User           | Role                              |
| ------------------ | -------------- | --------------------------------- |
| `dev-token-alice`  | alice@acme.com | Admin (read/write/delete/manage)  |
| `dev-token-bob`    | bob@acme.com   | Read-only                         |
| `dev-token-carol`  | carol@acme.com | Dev (read/write dev+staging only) |
| `sa-token-acme-ci` | CI Pipeline    | CI token (read-only, no delete)   |

The frontend defaults to `dev-token-alice`.

---

## API Reference

Full OpenAPI 3.1 spec: [`api/openapi.yaml`](./api/openapi.yaml)

### Secrets

| Method   | Path                                         | Description                               |
| -------- | -------------------------------------------- | ----------------------------------------- |
| `GET`    | `/api/v1/projects/:id/secrets`               | List secrets (metadata only)              |
| `GET`    | `/api/v1/projects/:id/secrets/:key`          | Get secret with decrypted value           |
| `PUT`    | `/api/v1/projects/:id/secrets/:key`          | Write secret (or create approval request) |
| `DELETE` | `/api/v1/projects/:id/secrets/:key`          | Soft-delete secret                        |
| `GET`    | `/api/v1/projects/:id/secrets/:key/history`  | Version history                           |
| `POST`   | `/api/v1/projects/:id/secrets/:key/rollback` | Rollback to version                       |
| `POST`   | `/api/v1/projects/:id/secrets/bulk-export`   | Export as `.env` / JSON / YAML            |

### Change Requests

| Method | Path                                               | Description            |
| ------ | -------------------------------------------------- | ---------------------- |
| `GET`  | `/api/v1/projects/:id/change-requests`             | List change requests   |
| `POST` | `/api/v1/projects/:id/change-requests/:id/approve` | Approve                |
| `POST` | `/api/v1/projects/:id/change-requests/:id/reject`  | Reject (requires note) |

### Audit

| Method | Path                            | Description            |
| ------ | ------------------------------- | ---------------------- |
| `GET`  | `/api/v1/orgs/:id/audit`        | Paginated audit log    |
| `GET`  | `/api/v1/orgs/:id/audit/verify` | Verify chain integrity |

### Other

| Method | Path       | Description              |
| ------ | ---------- | ------------------------ |
| `GET`  | `/health`  | Health check             |
| `GET`  | `/metrics` | Prometheus cache metrics |

---

## Testing

```bash
# Backend — all tests
cd backend && npm test

# Backend — with coverage
npm run test:coverage

# Individual suites
npm test -- --testPathPatterns=envelopeEncryption
npm test -- --testPathPatterns=policyEngine
npm test -- --testPathPatterns=auditChain
npm test -- --testPathPatterns=changeRequests
npm test -- --testPathPatterns=secrets
```

### Test coverage (domain logic)

| Suite                | Tests | Coverage area                                      |
| -------------------- | ----- | -------------------------------------------------- |
| `envelopeEncryption` | 6     | Encrypt/decrypt round-trip, tamper detection       |
| `policyEngine`       | 10    | Glob matching, env filter, CI restrictions, expiry |
| `auditChain`         | 6     | Chain hash, tamper detection, org isolation        |
| `changeRequests`     | 8     | State machine, self-approval, expiry               |
| `secrets`            | 10    | CRUD, versioning, rollback, bulk export            |

---

## Known Limitations

| Area              | Limitation                                                                                                                                      |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication    | Stub only - tokens are SHA-256 hashes of hardcoded strings. No JWT, no OAuth.                                                                   |
| KMS master key    | Regenerated on every Mock KMS restart. Existing encrypted secrets become unreadable after a restart in dev. In production use a persistent KMS. |
| Audit chain scope | Chain is per-org. A multi-region deployment would need a distributed append-only log for stronger guarantees.                                   |
| Cache             | Plaintext values in Redis - see Cache Tradeoffs section.                                                                                        |
| Secret rotation   | No automated rotation mechanism. `rotated_at` field exists but rotation must be triggered manually via a write.                                 |
| Team principals   | `principal_type = 'team'` is supported in the schema but team membership resolution is not implemented.                                         |
| Frontend auth     | Token is hardcoded in `localStorage` as `dev-token-alice`. No login UI.                                                                         |
| Soft delete only  | Deleted secrets remain in the DB with `is_current = false`. No purge mechanism.                                                                 |

```

```
