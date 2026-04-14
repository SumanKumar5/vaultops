import { pool } from "../db/client";
import { encrypt } from "../crypto/envelopeEncryption";
import crypto from "crypto";

function hash(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

const ORGS = [
  {
    id: "a0000000-0000-0000-0000-000000000001",
    slug: "acme-corp",
    name: "Acme Corp",
    plan: "enterprise",
  },
  {
    id: "a0000000-0000-0000-0000-000000000002",
    slug: "globex",
    name: "Globex Systems",
    plan: "pro",
  },
  {
    id: "a0000000-0000-0000-0000-000000000003",
    slug: "initech",
    name: "Initech",
    plan: "pro",
  },
  {
    id: "a0000000-0000-0000-0000-000000000004",
    slug: "umbrella",
    name: "Umbrella Inc",
    plan: "starter",
  },
  {
    id: "a0000000-0000-0000-0000-000000000005",
    slug: "cyberdyne",
    name: "Cyberdyne Systems",
    plan: "enterprise",
  },
  {
    id: "a0000000-0000-0000-0000-000000000006",
    slug: "soylent",
    name: "Soylent Corp",
    plan: "starter",
  },
  {
    id: "a0000000-0000-0000-0000-000000000007",
    slug: "veridian",
    name: "Veridian Dynamics",
    plan: "pro",
  },
  {
    id: "a0000000-0000-0000-0000-000000000008",
    slug: "momcorp",
    name: "Mom Corp",
    plan: "enterprise",
  },
  {
    id: "a0000000-0000-0000-0000-000000000009",
    slug: "planet-express",
    name: "Planet Express",
    plan: "starter",
  },
  {
    id: "a0000000-0000-0000-0000-000000000010",
    slug: "dunder-mifflin",
    name: "Dunder Mifflin",
    plan: "pro",
  },
];

const USERS = [
  {
    id: "b0000000-0000-0000-0000-000000000001",
    org_id: ORGS[0].id,
    email: "alice@acme.com",
    name: "Alice Chen",
    token: "dev-token-alice",
  },
  {
    id: "b0000000-0000-0000-0000-000000000002",
    org_id: ORGS[0].id,
    email: "bob@acme.com",
    name: "Bob Smith",
    token: "dev-token-bob",
  },
  {
    id: "b0000000-0000-0000-0000-000000000003",
    org_id: ORGS[0].id,
    email: "carol@acme.com",
    name: "Carol White",
    token: "dev-token-carol",
  },
  {
    id: "b0000000-0000-0000-0000-000000000004",
    org_id: ORGS[0].id,
    email: "dave@acme.com",
    name: "Dave Kumar",
    token: "dev-token-dave",
  },
  {
    id: "b0000000-0000-0000-0000-000000000005",
    org_id: ORGS[0].id,
    email: "eve@acme.com",
    name: "Eve Johnson",
    token: "dev-token-eve",
  },
  {
    id: "b0000000-0000-0000-0000-000000000006",
    org_id: ORGS[1].id,
    email: "frank@globex.com",
    name: "Frank Burns",
    token: "dev-token-frank",
  },
  {
    id: "b0000000-0000-0000-0000-000000000007",
    org_id: ORGS[1].id,
    email: "grace@globex.com",
    name: "Grace Lee",
    token: "dev-token-grace",
  },
  {
    id: "b0000000-0000-0000-0000-000000000008",
    org_id: ORGS[2].id,
    email: "henry@initech.com",
    name: "Henry Ford",
    token: "dev-token-henry",
  },
  {
    id: "b0000000-0000-0000-0000-000000000009",
    org_id: ORGS[3].id,
    email: "iris@umbrella.com",
    name: "Iris West",
    token: "dev-token-iris",
  },
  {
    id: "b0000000-0000-0000-0000-000000000010",
    org_id: ORGS[4].id,
    email: "jack@cyberdyne.com",
    name: "Jack Ryan",
    token: "dev-token-jack",
  },
  {
    id: "b0000000-0000-0000-0000-000000000011",
    org_id: ORGS[0].id,
    email: "kate@acme.com",
    name: "Kate Marsh",
    token: "dev-token-kate",
  },
  {
    id: "b0000000-0000-0000-0000-000000000012",
    org_id: ORGS[0].id,
    email: "liam@acme.com",
    name: "Liam Neeson",
    token: "dev-token-liam",
  },
  {
    id: "b0000000-0000-0000-0000-000000000013",
    org_id: ORGS[1].id,
    email: "mia@globex.com",
    name: "Mia Wallace",
    token: "dev-token-mia",
  },
  {
    id: "b0000000-0000-0000-0000-000000000014",
    org_id: ORGS[2].id,
    email: "ned@initech.com",
    name: "Ned Flanders",
    token: "dev-token-ned",
  },
  {
    id: "b0000000-0000-0000-0000-000000000015",
    org_id: ORGS[4].id,
    email: "olivia@cyberdyne.com",
    name: "Olivia Pope",
    token: "dev-token-olivia",
  },
];

const PROJECTS = [
  {
    id: "c0000000-0000-0000-0000-000000000001",
    org_id: ORGS[0].id,
    slug: "web-app",
    name: "Web Application",
    description: "Main customer-facing web app",
  },
  {
    id: "c0000000-0000-0000-0000-000000000002",
    org_id: ORGS[0].id,
    slug: "api-gateway",
    name: "API Gateway",
    description: "Central API gateway service",
  },
  {
    id: "c0000000-0000-0000-0000-000000000003",
    org_id: ORGS[0].id,
    slug: "data-pipeline",
    name: "Data Pipeline",
    description: "ETL and analytics pipeline",
  },
  {
    id: "c0000000-0000-0000-0000-000000000004",
    org_id: ORGS[0].id,
    slug: "auth-service",
    name: "Auth Service",
    description: "Authentication and authorisation",
  },
  {
    id: "c0000000-0000-0000-0000-000000000005",
    org_id: ORGS[1].id,
    slug: "globex-core",
    name: "Globex Core",
    description: "Core platform services",
  },
  {
    id: "c0000000-0000-0000-0000-000000000006",
    org_id: ORGS[1].id,
    slug: "globex-ml",
    name: "ML Platform",
    description: "Machine learning infrastructure",
  },
  {
    id: "c0000000-0000-0000-0000-000000000007",
    org_id: ORGS[2].id,
    slug: "initech-portal",
    name: "IT Portal",
    description: "Internal IT management portal",
  },
  {
    id: "c0000000-0000-0000-0000-000000000008",
    org_id: ORGS[3].id,
    slug: "umbrella-labs",
    name: "Research Labs",
    description: "R&D environment",
  },
  {
    id: "c0000000-0000-0000-0000-000000000009",
    org_id: ORGS[4].id,
    slug: "skynet",
    name: "Skynet",
    description: "Neural network platform",
  },
  {
    id: "c0000000-0000-0000-0000-000000000010",
    org_id: ORGS[0].id,
    slug: "payments",
    name: "Payments Service",
    description: "Payment processing",
  },
  {
    id: "c0000000-0000-0000-0000-000000000011",
    org_id: ORGS[0].id,
    slug: "notifications",
    name: "Notifications",
    description: "Email and push notifications",
  },
  {
    id: "c0000000-0000-0000-0000-000000000012",
    org_id: ORGS[0].id,
    slug: "search",
    name: "Search Service",
    description: "Full-text search infrastructure",
  },
  {
    id: "c0000000-0000-0000-0000-000000000013",
    org_id: ORGS[1].id,
    slug: "globex-billing",
    name: "Billing",
    description: "Subscription and billing",
  },
  {
    id: "c0000000-0000-0000-0000-000000000014",
    org_id: ORGS[4].id,
    slug: "t800",
    name: "T-800 Series",
    description: "Robotics control systems",
  },
  {
    id: "c0000000-0000-0000-0000-000000000015",
    org_id: ORGS[5].id,
    slug: "soylent-green",
    name: "Supply Chain",
    description: "Supply chain management",
  },
];

const SECRET_TEMPLATES = [
  {
    key: "DB_HOST",
    values: {
      development: "localhost",
      staging: "staging-db.internal",
      production: "prod-db.cluster.internal",
    },
  },
  {
    key: "DB_PASSWORD",
    values: {
      development: "dev-pass-123",
      staging: "stg-p@ssw0rd-789",
      production: "pr0d-$ecure-P@ss-2024!",
    },
  },
  {
    key: "DB_NAME",
    values: {
      development: "appdb_dev",
      staging: "appdb_staging",
      production: "appdb_prod",
    },
  },
  {
    key: "REDIS_URL",
    values: {
      development: "redis://localhost:6379",
      staging: "redis://staging-redis:6379",
      production: "redis://prod-redis-cluster:6379",
    },
  },
  {
    key: "API_KEY_STRIPE",
    values: {
      development: "sk_test_abc123dev",
      staging: "sk_test_xyz789stg",
      production: "sk_live_prod_stripe_key_9x8y7z",
    },
  },
  {
    key: "API_KEY_SENDGRID",
    values: {
      development: "SG.dev.sendgrid.key",
      staging: "SG.stg.sendgrid.key",
      production: "SG.prod.sendgrid.key.secure",
    },
  },
  {
    key: "JWT_SECRET",
    values: {
      development: "dev-jwt-not-secret",
      staging: "stg-jwt-s3cr3t-456",
      production: "prod-jwt-$up3r-s3cur3-k3y!",
    },
  },
  {
    key: "AWS_ACCESS_KEY_ID",
    values: {
      development: "AKIAIOSFODNN7DEVTEST",
      staging: "AKIAIOSFODNN7STAGING",
      production: "AKIAIOSFODNN7EXAMPLE",
    },
  },
  {
    key: "AWS_SECRET_ACCESS_KEY",
    values: {
      development: "dev/aws/secret/key/test",
      staging: "stg/aws/secret/key/test",
      production: "prod/aws/secret/access/key/secure",
    },
  },
  {
    key: "OAUTH_CLIENT_SECRET",
    values: {
      development: "oauth-dev-secret-123",
      staging: "oauth-stg-secret-456",
      production: "oauth-prod-secret-789",
    },
  },
  {
    key: "ENCRYPTION_KEY",
    values: {
      development: "dev-enc-key-32-bytes-padding!!",
      staging: "stg-enc-key-32-bytes-padding!!",
      production: "prod-enc-key-32-bytes-secure!!!",
    },
  },
  {
    key: "SENTRY_DSN",
    values: {
      development: "https://dev@sentry.io/123",
      staging: "https://stg@sentry.io/456",
      production: "https://prod@sentry.io/789",
    },
  },
  {
    key: "DATADOG_API_KEY",
    values: {
      development: "dd-dev-api-key-abc",
      staging: "dd-stg-api-key-def",
      production: "dd-prod-api-key-xyz",
    },
  },
  {
    key: "TWILIO_AUTH_TOKEN",
    values: {
      development: "twilio-dev-token-123",
      staging: "twilio-stg-token-456",
      production: "twilio-prod-token-789",
    },
  },
];

const SERVICE_ACCOUNTS = [
  {
    id: "d0000000-0000-0000-0000-000000000001",
    org_id: ORGS[0].id,
    name: "CI Pipeline (Acme)",
    token: "sa-token-acme-ci",
    is_ci_token: true,
    scoped_projects: [
      "c0000000-0000-0000-0000-000000000001",
      "c0000000-0000-0000-0000-000000000002",
    ],
  },
  {
    id: "d0000000-0000-0000-0000-000000000002",
    org_id: ORGS[0].id,
    name: "K8s Operator (Acme)",
    token: "sa-token-acme-k8s",
    is_ci_token: false,
    scoped_projects: ["c0000000-0000-0000-0000-000000000001"],
  },
  {
    id: "d0000000-0000-0000-0000-000000000003",
    org_id: ORGS[1].id,
    name: "CI Pipeline (Globex)",
    token: "sa-token-globex-ci",
    is_ci_token: true,
    scoped_projects: ["c0000000-0000-0000-0000-000000000005"],
  },
  {
    id: "d0000000-0000-0000-0000-000000000004",
    org_id: ORGS[4].id,
    name: "Deploy Bot (Cyberdyne)",
    token: "sa-token-cyberdyne-deploy",
    is_ci_token: false,
    scoped_projects: ["c0000000-0000-0000-0000-000000000009"],
  },
];

async function seedOrgs() {
  for (const org of ORGS) {
    await pool.query(
      `INSERT INTO organisations (id, slug, name, plan) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING`,
      [org.id, org.slug, org.name, org.plan],
    );
  }
  console.log(`Seeded ${ORGS.length} organisations`);
}

async function seedUsers() {
  for (const user of USERS) {
    await pool.query(
      `INSERT INTO users (id, org_id, email, name, token_hash) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
      [user.id, user.org_id, user.email, user.name, hash(user.token)],
    );
  }
  console.log(`Seeded ${USERS.length} users`);
}

async function seedProjects() {
  for (const project of PROJECTS) {
    await pool.query(
      `INSERT INTO projects (id, org_id, slug, name, description) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
      [
        project.id,
        project.org_id,
        project.slug,
        project.name,
        project.description,
      ],
    );
  }
  console.log(`Seeded ${PROJECTS.length} projects`);
}

async function seedServiceAccounts() {
  for (const sa of SERVICE_ACCOUNTS) {
    await pool.query(
      `INSERT INTO service_accounts (id, org_id, name, token_hash, is_ci_token, scoped_projects)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
      [
        sa.id,
        sa.org_id,
        sa.name,
        hash(sa.token),
        sa.is_ci_token,
        sa.scoped_projects,
      ],
    );
  }
  console.log(`Seeded ${SERVICE_ACCOUNTS.length} service accounts`);
}

async function seedSecrets() {
  const environments = ["development", "staging", "production"];
  const projectsToSeed = PROJECTS.slice(0, 8);
  let count = 0;

  for (const project of projectsToSeed) {
    const creatorId =
      USERS.find((u) => u.org_id === project.org_id)?.id ?? USERS[0].id;

    for (const template of SECRET_TEMPLATES) {
      for (const env of environments) {
        const value = (template.values as Record<string, string>)[env];
        const encrypted = await encrypt(value);

        await pool.query(
          `INSERT INTO secrets
            (project_id, environment, key_name, encrypted_value, encrypted_data_key,
             kms_key_id, version, is_current, created_by, tags)
           VALUES ($1,$2,$3,$4,$5,$6,1,TRUE,$7,$8)
           ON CONFLICT (project_id, environment, key_name, version) DO NOTHING`,
          [
            project.id,
            env,
            template.key,
            encrypted.encrypted_value,
            encrypted.encrypted_data_key,
            encrypted.kms_key_id,
            creatorId,
            JSON.stringify(["seeded"]),
          ],
        );
        count++;
      }
    }
  }
  console.log(`Seeded ${count} secrets`);
}

async function seedPolicies() {
  const adminUser = USERS[0];
  const readOnlyUser = USERS[1];
  const devUser = USERS[2];
  const acmeProjects = PROJECTS.filter((p) => p.org_id === ORGS[0].id);

  for (const project of acmeProjects) {
    await pool.query(
      `INSERT INTO secret_access_policies
        (project_id, principal_type, principal_id, environments, can_read, can_write, can_delete, can_manage_policies, granted_by)
       VALUES ($1,'user',$2,ARRAY['development','staging','production'],true,true,true,true,$3)
       ON CONFLICT DO NOTHING`,
      [project.id, adminUser.id, adminUser.id],
    );

    await pool.query(
      `INSERT INTO secret_access_policies
        (project_id, principal_type, principal_id, environments, can_read, can_write, can_delete, can_manage_policies, granted_by)
       VALUES ($1,'user',$2,ARRAY['development','staging','production'],true,false,false,false,$3)
       ON CONFLICT DO NOTHING`,
      [project.id, readOnlyUser.id, adminUser.id],
    );

    await pool.query(
      `INSERT INTO secret_access_policies
        (project_id, principal_type, principal_id, environments, can_read, can_write, can_delete, can_manage_policies, granted_by)
       VALUES ($1,'user',$2,ARRAY['development','staging'],true,true,false,false,$3)
       ON CONFLICT DO NOTHING`,
      [project.id, devUser.id, adminUser.id],
    );
  }

  const ciAccount = SERVICE_ACCOUNTS[0];
  await pool.query(
    `INSERT INTO secret_access_policies
      (project_id, principal_type, principal_id, environments, can_read, can_write, can_delete, can_manage_policies, granted_by)
     VALUES ($1,'ci_token',$2,ARRAY['development','staging','production'],true,false,false,false,$3)
     ON CONFLICT DO NOTHING`,
    [PROJECTS[0].id, ciAccount.id, adminUser.id],
  );

  console.log(`Seeded policies`);
}

async function seedAuditLog() {
  const eventTypes = [
    "SECRET_READ",
    "SECRET_WRITTEN",
    "SECRET_DELETED",
    "POLICY_CHANGED",
    "APPROVAL_REQUESTED",
    "APPROVAL_GRANTED",
  ];
  const actorIds = USERS.slice(0, 5).map((u) => u.id);
  const projectIds = PROJECTS.slice(0, 4).map((p) => p.id);
  const orgId = ORGS[0].id;

  let prevHash =
    "0000000000000000000000000000000000000000000000000000000000000000";
  let count = 0;

  for (let i = 0; i < 500; i++) {
    const eventType = eventTypes[i % eventTypes.length];
    const actorId = actorIds[i % actorIds.length];
    const projectId = projectIds[i % projectIds.length];
    const resourceId = crypto.randomUUID();
    const occurredAt = new Date(
      Date.now() - (500 - i) * 60_000 * 5,
    ).toISOString();

    const input = `${prevHash}${eventType}${resourceId}${occurredAt}${actorId}`;
    const chainHash = crypto.createHash("sha256").update(input).digest("hex");

    await pool.query(
      `INSERT INTO audit_log
        (org_id, project_id, actor_type, actor_id, event_type,
         resource_id, resource_type, metadata, occurred_at, chain_hash)
       VALUES ($1,$2,'user',$3,$4,$5,'secret',$6,$7,$8)`,
      [
        orgId,
        projectId,
        actorId,
        eventType,
        resourceId,
        JSON.stringify({ key_name: "DB_PASSWORD", environment: "production" }),
        occurredAt,
        chainHash,
      ],
    );

    prevHash = chainHash;
    count++;
  }

  console.log(`Seeded ${count} audit log entries`);
}

async function seed() {
  console.log("Starting seed...");
  await seedOrgs();
  await seedUsers();
  await seedProjects();
  await seedServiceAccounts();
  await seedSecrets();
  await seedPolicies();
  await seedAuditLog();
  console.log("Seed complete.");
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
