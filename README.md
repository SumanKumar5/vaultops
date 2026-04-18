<div align="center">

# VaultOps - Secrets Engine

A production-grade **Secrets and Configuration Management Engine** modelled after Doppler, HashiCorp Vault, and Infisical. Built from scratch as a Node.js/TypeScript API service with a React dashboard.

VaultOps centralises application secrets (API keys, database passwords, certificates), manages per-environment configuration, controls access via role-based policies, and audits all access to sensitive values with a tamper-evident chain.

![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?style=flat-square&logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express-5.x-000000?style=flat-square&logo=express&logoColor=white)
![React](https://img.shields.io/badge/React-18.x-61DAFB?style=flat-square&logo=react&logoColor=black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=flat-square&logo=redis&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.x-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Jest](https://img.shields.io/badge/Jest-30.x-C21325?style=flat-square&logo=jest&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-4.x-6E9F18?style=flat-square&logo=vitest&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)
![License](https://img.shields.io/badge/License-ISC-blue?style=flat-square)

---

</div>

## Features

- **Envelope Encryption** :- AES-256-GCM per-secret data keys, never stored in plaintext, master key managed by a mock KMS service
- **Full Versioning** :- every write creates a new immutable version; rollback to any prior version non-destructively
- **Policy-Based Access Control** :- per-project, per-environment, per-key-pattern policies with OR-merge semantics
- **Approval Workflow** :- production secret changes require peer review; self-approval blocked; 72-hour expiry
- **Tamper-Evident Audit Log** :- SHA-256 chain hashing across every audit event; verify endpoint detects any tampering
- **Read-Through Redis Cache** :- 5-minute TTL, instant invalidation on write, Prometheus metrics endpoint
- **Modern React Dashboard** :- secret reveal UX, version diff view, change request management, audit log with integrity check

---

## Running Locally

### Prerequisites

| Tool           | Version |
| -------------- | ------- |
| Node.js        | 20+     |
| Docker         | 20+     |
| Docker Compose | v2+     |

### 1. Clone and configure

```bash
git clone https://github.com/SumanKumar5/vaultops.git
cd vaultops
cp .env.example .env
```

### 2. Start infrastructure

```bash
docker compose up -d
```

Starts PostgreSQL 15 on port `5432` and Redis 7 on port `6379`.

### 3. Start the mock KMS

```bash
cd mock-services
npm install
npm run dev
```

Runs on port `3001`. Keep this terminal open.

### 4. Run migrations and seed

```bash
cd backend
npm install
npm run migrate
npm run seed
```

Seed populates: 10 organisations · 50 users · 32 projects · 4 service accounts · 336 secrets · 500 audit entries.

### 5. Start the backend API

```bash
cd backend
npm run dev
```

API available at `http://localhost:3000`.

### 6. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Dashboard available at `http://localhost:5173`.

### Test tokens

| Token               | User         | Role                                |
| ------------------- | ------------ | ----------------------------------- |
| `dev-token-alice`   | Alice Chen   | Admin - full access all projects    |
| `dev-token-bob`     | Bob Smith    | Read-only                           |
| `dev-token-carol`   | Carol White  | Dev/staging write                   |
| `sa-token-acme-ci`  | CI Pipeline  | CI token - read-only, no delete     |
| `sa-token-acme-k8s` | K8s Operator | Service account - scoped to web-app |

---

## Architecture

### Encryption Architecture

VaultOps uses **envelope encryption** for all secret values - the same model used by AWS KMS, GCP Cloud KMS, and HashiCorp Vault.

#### Why envelope encryption?

Encrypting every secret with a single shared master key creates two critical problems:

1. **Blast radius** - a leaked master key decrypts every secret in the system simultaneously.
2. **Rotation cost** - rotating the master key requires re-encrypting every stored secret.

Envelope encryption solves both: each secret gets its own unique **data key**. The master key only encrypts data keys, never secret values directly. Rotating the master key requires re-encrypting only the small data keys, not the potentially millions of secret values.

#### Encrypt flow

```
plaintext secret value
        │
        ▼
POST /generate-data-key  →  Mock KMS
        │  returns { plaintext_key, encrypted_key, kms_key_id }
        ▼
AES-256-GCM encrypt(plaintext, plaintext_key, random_iv)
        │
        ├── plaintext_key.fill(0)  ← zeroed from memory immediately
        │
        ▼
Store in DB:
  encrypted_value    = base64(iv + authTag + ciphertext)
  encrypted_data_key = base64(KMS-encrypted data key)
  kms_key_id         = "master-key-v1"
```

#### Decrypt flow

```
Load { encrypted_value, encrypted_data_key, kms_key_id } from DB
        │
        ▼
POST /decrypt-data-key  →  Mock KMS
        │  returns { plaintext_key }
        ▼
AES-256-GCM decrypt(encrypted_value, plaintext_key)
        │
        ├── plaintext_key.fill(0)  ← zeroed from memory immediately
        │
        ▼
return plaintext string
```

A database dump exposes only ciphertext and KMS-encrypted data keys - **useless without the KMS master key**.

#### What the mock KMS simulates

`mock-services/src/kms.mock.ts` is a standalone Express server implementing the AWS KMS API surface:

| Endpoint                  | Description                                                                        |
| ------------------------- | ---------------------------------------------------------------------------------- |
| `POST /generate-data-key` | Generates a random 256-bit data key, encrypts it with the master key, returns both |
| `POST /decrypt-data-key`  | Decrypts an encrypted data key using the master key                                |
| `POST /rotate-master-key` | Stub for master key rotation - generates a new key version                         |
| `GET /health`             | Returns active key ID                                                              |

Master keys are derived deterministically from fixed seeds (`SHA-256("vaultops-master-key-v1-fixed-seed")`), ensuring secrets remain decryptable across service restarts. In production, this is replaced by AWS KMS, GCP Cloud KMS, or HashiCorp Vault.

---

### Access Control Model

VaultOps replaces the legacy admin boolean with a **policy-based access control** model.

#### Policy evaluation logic

Every API request runs through `policyEngine.resolvePermissions()`:

```
1. Fetch all policies WHERE project_id = ? AND principal_id = ? AND principal_type = ?
2. Filter by: environment ∈ policy.environments
3. Filter by: key_name matches policy.key_pattern (glob) — or pattern IS NULL (all keys)
4. Filter by: policy.expires_at IS NULL OR expires_at > NOW()
5. OR-merge all matching policies → most permissive wins
6. If principal.type = 'ci_token' → force can_delete=false, can_manage_policies=false
7. If principal.scoped_projects is non-empty → reject if projectId not in scoped_projects
```

#### key_pattern semantics

`key_pattern` uses glob matching. `NULL` means all keys are matched.

| Pattern       | Matches                             | Does not match          |
| ------------- | ----------------------------------- | ----------------------- |
| `DB_*`        | `DB_PASSWORD`, `DB_HOST`, `DB_NAME` | `API_KEY`, `JWT_SECRET` |
| `*_KEY`       | `API_KEY`, `JWT_KEY`, `ENC_KEY`     | `DB_PASSWORD`           |
| `AWS_*_KEY_*` | `AWS_ACCESS_KEY_ID`                 | `DB_PASSWORD`           |
| `NULL`        | everything                          | —                       |

#### CI token restrictions

CI tokens are service accounts with `is_ci_token = true`. Regardless of what policies grant them, two permissions are **always force-set to false** in code:

- `can_delete` - CI jobs must never be able to destroy secrets
- `can_manage_policies` - CI jobs must never be able to elevate their own access

#### Principal types

| Type              | Validated by                                                                                       |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| `user`            | SHA-256 of Bearer token → `users.token_hash`                                                       |
| `service_account` | SHA-256 of Bearer token → `service_accounts.token_hash`, checks `revoked_at` and `scoped_projects` |
| `ci_token`        | Same as service_account, plus hardcoded permission restrictions                                    |

---

### Audit Chain

Every write to `audit_log` computes a deterministic chain hash linking it to all previous entries:

```
chain_hash(n) = SHA-256(
  chain_hash(n-1) +
  event_type      +
  resource_id     +
  occurred_at     +
  actor_id
)
```

The first record uses a known **genesis hash** of 64 zeroes:

```
0000000000000000000000000000000000000000000000000000000000000000
```

#### What "tamper-evident" means in practice

If an attacker with database write access modifies a past audit entry (to hide a `SECRET_READ` or `POLICY_CHANGED` event), the stored `chain_hash` of that row will no longer match what the verifier independently computes. Because every subsequent hash depends on all prior hashes, **the tamper cascades forward** — every entry after the modified one also fails verification.

The `GET /api/v1/orgs/:orgId/audit/verify` endpoint:

1. Walks every audit entry in insertion order from genesis
2. Independently recomputes each `chain_hash`
3. Compares it against the stored value
4. Returns `{ valid: false, first_broken_at: <row_id> }` at the first mismatch

#### Limitation

This is tamper-**evident**, not tamper-**proof**. An attacker with full DB access could recompute all subsequent hashes after modifying an entry. True tamper-proofing requires periodically publishing chain hash checkpoints to an immutable external store (a write-once S3 bucket with Object Lock, a public blockchain, or a notary service).

---

### Approval Workflow

Production secret changes go through a peer review flow before taking effect.

#### State machine

```
                  PUT /secrets/:key (production env)
                            │
                            ▼
                      ┌─────────┐
                      │ pending │ ──── expires_at < NOW() ──► expired
                      └────┬────┘           (background job, every 60s)
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
        ┌──────────┐              ┌──────────┐
        │ approved │              │ rejected │
        └────┬─────┘              └──────────┘
             │  (secret write executes)
             ▼
        ┌─────────┐
        │ applied │
        └─────────┘
```

#### Rules enforced in code

| Rule                                          | Implementation                                                         |
| --------------------------------------------- | ---------------------------------------------------------------------- |
| Requester ≠ approver                          | `cr.requested_by !== principal.id` checked in `approveChangeRequest`   |
| Only `can_manage_policies` can approve/reject | `authorize("can_manage_policies")` middleware on approve/reject routes |
| Encrypted value stored before approval        | New encrypted value stored in `changes` JSONB at request creation time |
| Expiry                                        | `expires_at = NOW() + INTERVAL '72 hours'` set at creation             |

#### Expiry job design

`changeRequests.jobs.ts` runs a `setInterval` every 60 seconds:

```ts
UPDATE change_requests
SET status = 'expired'
WHERE status = 'pending' AND expires_at < NOW()
```

This is a single atomic SQL statement - safe for single-instance deployments. For multi-instance deployments, a distributed lock (Redis `SET NX EX`) or a dedicated job queue (BullMQ) would prevent duplicate processing.

---

### Cache Tradeoffs

The Redis cache stores **decrypted plaintext** secret values.

#### Why plaintext caching was chosen

The purpose of the cache is to eliminate PostgreSQL and KMS round-trips on every secret read. If the cached value were the encrypted ciphertext, every cache hit would still require a KMS call to decrypt — eliminating the performance benefit entirely.

#### The tradeoff

Caching plaintext means Redis becomes a sensitive component in the security model. Mitigations for production:

| Risk                             | Mitigation                                                        |
| -------------------------------- | ----------------------------------------------------------------- |
| Redis compromise exposes secrets | Redis AUTH, TLS (`rediss://`), private subnet, no public exposure |
| Long exposure window             | Short TTL (5 minutes) limits the window                           |
| Stale data after write           | Immediate `DEL` on every write, delete, and rollback              |

#### The alternative

Cache only the `encrypted_data_key` alongside the ciphertext (still encrypted), and maintain a short-lived in-process key cache (e.g. a `Map` with a 30-second TTL). This keeps plaintext out of Redis entirely but:

- Adds in-process memory pressure
- Re-introduces KMS load on every in-process cache miss
- Requires careful key eviction to avoid memory leaks

The assignment explicitly accepts plaintext caching for a trusted in-cluster Redis instance, which matches how most production secrets managers (including Doppler's SDK) work in practice.

---

## API Reference

| Method   | Endpoint                                           | Description                     |
| -------- | -------------------------------------------------- | ------------------------------- |
| `GET`    | `/api/v1/projects/:id/secrets`                     | List secrets (no values)        |
| `GET`    | `/api/v1/projects/:id/secrets/:key`                | Get secret with decrypted value |
| `PUT`    | `/api/v1/projects/:id/secrets/:key`                | Write or create change request  |
| `DELETE` | `/api/v1/projects/:id/secrets/:key`                | Soft-delete secret              |
| `GET`    | `/api/v1/projects/:id/secrets/:key/history`        | Version history                 |
| `POST`   | `/api/v1/projects/:id/secrets/:key/rollback`       | Rollback to version             |
| `POST`   | `/api/v1/projects/:id/secrets/bulk-export`         | Export as .env / JSON / YAML    |
| `GET`    | `/api/v1/projects/:id/change-requests`             | List change requests            |
| `POST`   | `/api/v1/projects/:id/change-requests/:id/approve` | Approve change request          |
| `POST`   | `/api/v1/projects/:id/change-requests/:id/reject`  | Reject change request           |
| `GET`    | `/api/v1/orgs/:id/audit`                           | Paginated audit log             |
| `GET`    | `/api/v1/orgs/:id/audit/verify`                    | Verify chain integrity          |
| `GET`    | `/metrics`                                         | Prometheus cache metrics        |
| `GET`    | `/health`                                          | Health check                    |

Full OpenAPI 3.1 spec: [`api/openapi.yaml`](./api/openapi.yaml)

---

## Testing

```bash
# Backend - Jest + Supertest
cd backend
npm test                  # run all tests
npm run test:coverage     # with coverage report

# Frontend - Vitest + React Testing Library
cd frontend
npm test
```

| Suite                        | Tests  | Coverage                                                                |
| ---------------------------- | ------ | ----------------------------------------------------------------------- |
| `envelopeEncryption.test.ts` | 6      | Encrypt/decrypt round-trip, tamper detection, edge cases                |
| `policyEngine.test.ts`       | 12     | Glob matching, env filter, CI restrictions, scoped projects, revoked SA |
| `auditChain.test.ts`         | 6      | Chain correctness, tamper detection, multi-org isolation                |
| `utils.test.ts`              | 14     | cn, timeAgo, isExpired, isExpiringSoon                                  |
| `Badge.test.tsx`             | 6      | Variant classes, className merge                                        |
| `Button.test.tsx`            | 8      | Click, disabled, loading state, variants                                |
| `SecretsList.test.tsx`       | 4      | Render, count, empty state, selection                                   |
| **Total**                    | **56** |                                                                         |

---

## Known Limitations

| Area                        | Limitation                                                                                                                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Authentication**          | Bearer tokens are looked up directly in the DB. No JWT signing, no OAuth, no session expiry. The frontend uses a hardcoded `dev-token-alice`.                                                           |
| **Mock KMS**                | Master keys use deterministic seeds. Not safe for production — use AWS KMS, GCP Cloud KMS, or HashiCorp Vault Transit.                                                                                  |
| **Expiry job**              | `setInterval` in a single process. Not safe for multi-instance deployments without a distributed lock.                                                                                                  |
| **Secret rotation**         | `rotated_at` column exists but no automated rotation scheduler is implemented.                                                                                                                          |
| **Frontend project list**   | Projects are a static array in `SecretsPage.tsx`. A production implementation would fetch from a `/api/v1/orgs/:id/projects` endpoint.                                                                  |
| **Audit chain concurrency** | Chain hashes are computed with a sequential DB read before each write. Concurrent writes to the same org could cause race conditions. Production would use a serialisable transaction or a DB sequence. |
| **No HTTPS**                | Dev setup runs on plain HTTP. Production requires TLS termination at the load balancer or reverse proxy.                                                                                                |
| **No rate limiting**        | No per-token or per-IP rate limiting on the API.                                                                                                                                                        |
| **Frontend tests**          | Component tests cover UI primitives and the secrets list. Integration tests for the slide-over, change request flow, and audit log are not yet written.                                                 |

---

## Project Structure

```
vaultops/
├── docker-compose.yml
├── .env.example
├── api/
│   └── openapi.yaml
├── mock-services/
│   └── src/kms.mock.ts
├── backend/
│   └── src/
│       ├── config/env.ts
│       ├── db/
│       │   ├── migrations/
│       │   ├── migrate.ts
│       │   └── seed.ts
│       ├── crypto/
│       │   └── envelopeEncryption.ts
│       ├── domain/
│       │   ├── authz/
│       │   ├── secrets/
│       │   ├── changeRequests/
│       │   └── audit/
│       ├── services/
│       │   ├── secretCache.ts
│       │   └── metrics.ts
│       └── __tests__/
└── frontend/
    └── src/
        ├── api/
        ├── components/
        ├── components/ui/
        ├── pages/
        ├── lib/utils.ts
        └── test/
```

---
