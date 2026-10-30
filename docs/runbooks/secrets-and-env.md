# Secrets and environment

> Use this runbook to find where a secret or environment variable lives, how it reaches a running service, and how to rotate it.

## When to use this

- A deploy fails because a variable is missing or has the wrong value.
- You need to rotate a credential.
- You need to know which store owns a given name before you change it.
- You need to add a new variable without leaking it into a repo.

## Preconditions

- Access to the `leadminer.io` repository settings: **Settings > Secrets and variables > Actions**.
- For Supabase Vault: `SUPABASE_SUDO_PWD_QA` / `SUPABASE_SUDO_PWD_PROD` and `DO_TOKEN`.
- For Redis: `REDIS_PASSWORD` and access to the prod host.

## Secret classes and where they live

There are five storage classes. A name belongs to exactly one class.

| Class                    | Location                                                                     | Reaches the runtime through                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| GitHub Actions secrets   | `leadminer.io` repo settings, Secrets                                        | `env:` blocks on workflow steps, then `envs:` on `appleboy/ssh-action`, then `envsubst` into the server `.env` |
| GitHub Actions variables | `leadminer.io` repo settings, Variables                                      | Same path as secrets, for non-sensitive values                                                                 |
| Server-rendered `.env`   | Template `leadminer.io/.env`, rendered on the droplet into `$APP_REPO/.env`  | `envsubst < $CONF_REPO/.env > $APP_REPO/.env`                                                                  |
| Supabase Vault           | `vault.secrets` on the self-hosted Supabase database                         | `psql` `vault.create_secret` in the vault workflow                                                             |
| Redis password           | GitHub Actions secret `REDIS_PASSWORD`, then the Redis container environment | `redis/docker-compose.yml` on the prod host                                                                    |

### GitHub Actions secrets and variables

Secrets and variables are referenced in the deploy workflows as `${{ secrets.NAME }}` and `${{ vars.NAME }}`. The application deploy workflows map them into the SSH step's `envs:` list, which is the only path that passes them to the server.

Evidence anchors:

- `leadminer.io@256a710:.github/workflows/qa-backend-build-deploy-prodhost.yml:53-109` — the QA backend `env:` and `envs:` blocks.
- `leadminer.io@256a710:.github/workflows/deploy-prod-prodhost.yml:87-142` — the prod `env:` and `envs:` blocks.

Names follow two conventions:

- Environment-specific values carry a `_QA` or `_PROD` suffix, e.g. `SUPABASE_SERVICE_ROLE_KEY_QA`, `SUPABASE_DB_URL_PROD`, `LEADMINER_API_HOST_QA`.
- Shared values have no suffix, e.g. `LEADMINER_API_HASH_SECRET`, `REDIS_HOST`, `REDIS_PASSWORD`, `DO_TOKEN`, `GIT_PAT`, `DEPLOY_PAT`.

The `envs:` list is an explicit allowlist. A secret added to the `env:` block but omitted from `envs:` will not reach the SSH session.

### Server-rendered `.env`

The ops repo contains one envsubst template, `leadminer.io/.env`. It contains no literal credential values; every sensitive field is an interpolation such as `${LEADMINER_API_HASH_SECRET}`. [verified leadminer.io@256a710:.env:1-180]

The deploy workflow exports the secrets and variables as shell variables, then runs:

```bash
envsubst < $CONF_REPO/.env > $APP_REPO/.env
```

[verified leadminer.io@256a710:.github/workflows/qa-backend-build-deploy-prodhost.yml:195] [verified leadminer.io@256a710:.github/workflows/deploy-prod-prodhost.yml:237]

The rendered `.env` is written into the app checkout on the droplet (`/home/leadminer/leadminer_prod/.env` or `/home/leadminer/leadminer_qa/.env`). It is not committed. Editing the template without updating the workflow exports produces an empty substitution.

The template covers the application's runtime configuration, including:

- API: `LEADMINER_API_PORT`, `LEADMINER_API_HASH_SECRET`, `LEADMINER_API_HOST`, `FRONTEND_HOST`.
- Fetching: `EMAIL_FETCHING_SERVICE_API_TOKEN`, `EMAIL_FETCHING_SERVICE_URL`, `EMAIL_FETCHING_SERVICE_PORT`.
- Credits and Stripe: `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET`.
- Supabase: `SUPABASE_SECRET_PROJECT_TOKEN`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PG_CONNECTION_STRING`.
- SaaS Supabase: `SAAS_SUPABASE_PROJECT_URL`, `SAAS_SUPABASE_SECRET_PROJECT_TOKEN`, `SAAS_SUPABASE_ANON_KEY`, `SAAS_PG_CONNECTION_STRING`.
- Redis: `REDIS_USERNAME`, `REDIS_PASSWORD`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_DB`, Redis stream names.
- Sentry: `SENTRY_DSN_BACKEND`, `SENTRY_DSN_FRONTEND`, `SENTRY_ENVIRONMENT_*`.
- PostHog: `POSTHOG_API_KEY`, `POSTHOG_INSTANCE_ADDRESS`, `POSTHOG_STATIC_ASSETS_PROXY`, `POSTHOG_INGEST_INSTANCE`, `POSTHOG_PROXY_ADDRESS`.
- OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_SECRET`, `AZURE_CLIENT_ID`, `AZURE_SECRET`.
- Enrichment: `THEDIG_URL`, `THEDIG_API_KEY`, `ENRICH_LAYER_URL`, `ENRICH_LAYER_API_KEY`.
- Signature extraction: `SIGNATURE_OPENROUTER_API_KEY`.
- Reacher: `REACHER_HOST`, `REACHER_HEADER_SECRET`.

[verified leadminer.io@256a710:.env:1-180]

### Supabase Vault

The vault store is the `vault.secrets` table on the self-hosted Supabase database. The QA vault workflow deletes and recreates the `service_role_key` secret with `vault.create_secret`. [verified leadminer.io@256a710:.github/workflows/deploy-vault-secrets-qa.yml:106-120]

The workflow temporarily opens the `supabase-firewall` to the runner IP, runs the `psql` block, and closes the firewall in an `always()` step. [verified leadminer.io@256a710:.github/workflows/deploy-vault-secrets-qa.yml:94-122]

The secret _name_ is `service_role_key`. The value is supplied by `SUPABASE_SERVICE_ROLE_KEY_QA` / `SUPABASE_SERVICE_ROLE_KEY_PROD` at run time.

### Redis

The shared Redis instance runs on the prod host on the external network `leadminer-net`. Its only secret is `REDIS_PASSWORD`; non-sensitive settings live in the committed `redis/.env`. [verified leadminer.io@256a710:.github/workflows/deploy-redis-prodhost.yml:1-20]

The deploy workflow passes `REDIS_PASSWORD` into the SSH session, exports it, brings up the Redis compose stack and verifies with `redis-cli -a "$REDIS_PASSWORD" --no-auth-warning ping`. [verified leadminer.io@256a710:.github/workflows/deploy-redis-prodhost.yml:38-48]

Both application stacks reach Redis by hostname `redis` on the shared network and use separate logical databases through `REDIS_DB_PROD` / `REDIS_DB_QA`. [verified leadminer.io@256a710:docs/INTERNAL-CONNECTIVITY.md:44-47]

## Procedure: rotate a secret

### Rotate a GitHub Actions secret

1. Open `leadminer.io` -> **Settings > Secrets and variables > Actions**. [verified leadminer.io@256a710:docs/DEPLOY.md:91-96]
2. Update the secret value. [verified leadminer.io@256a710:docs/DEPLOY.md:91-96]
3. Redeploy the service that consumes it. The next workflow run maps the new value into `env:` and `envs:`, and `envsubst` rewrites the server `.env`. [verified leadminer.io@256a710:.github/workflows/deploy-prod-prodhost.yml:237]

### Rotate a server-rendered value

1. Decide whether the value is a secret or a non-sensitive variable. [verified leadminer.io@256a710:docs/DEPLOY.md:106-116]
2. If it is sensitive, add or update the GitHub Actions secret. If it is not, update the variable. [verified leadminer.io@256a710:docs/DEPLOY.md:106-116]
3. Add the name to the relevant workflow `env:` block and `envs:` list if it is not already present. [verified leadminer.io@256a710:.github/workflows/deploy-prod-prodhost.yml:87-142]
4. Add the interpolation to the `.env` template if it is not already present. [verified leadminer.io@256a710:.env:1-180]
5. Redeploy so `envsubst` re-renders the server `.env`. [verified leadminer.io@256a710:.github/workflows/deploy-prod-prodhost.yml:237]

### Rotate the Supabase Vault `service_role_key`

1. Update `SUPABASE_SERVICE_ROLE_KEY_QA` / `SUPABASE_SERVICE_ROLE_KEY_PROD` in GitHub. [verified leadminer.io@256a710:.github/workflows/deploy-vault-secrets-qa.yml:53-54]
2. Run `deploy-vault-secrets-qa.yml` or `deploy-vault-secrets-prod.yml`. [verified leadminer.io@256a710:.github/workflows/deploy-vault-secrets-qa.yml:1-7]
3. The workflow deletes the existing `service_role_key` row and recreates it with the new value. [verified leadminer.io@256a710:.github/workflows/deploy-vault-secrets-qa.yml:106-120]

### Rotate the Redis password

1. Update `REDIS_PASSWORD` in GitHub. [verified leadminer.io@256a710:.github/workflows/deploy-redis-prodhost.yml:18]
2. Run `deploy-redis-prodhost.yml`. The workflow brings the Redis container up with the new password and verifies it. [verified leadminer.io@256a710:.github/workflows/deploy-redis-prodhost.yml:38-48]
3. Redeploy the application stacks so their `.env` picks up the new password. [verified leadminer.io@256a710:.github/workflows/deploy-prod-prodhost.yml:237]

## Verification

- After a secret change, check the workflow log for the `envsubst` step and confirm the rendered `.env` on the server has the new value length and format (never print the value). [verified leadminer.io@256a710:.github/workflows/qa-backend-build-deploy-prodhost.yml:195]
- After a Vault change, query `vault.decrypted_secrets` for the `service_role_key` name. [verified supabase-selfhost-ops@56638b9:AGENTS.md:333]
- After a Redis change, the workflow's `redis-cli ... ping` must return `PONG`. [verified leadminer.io@256a710:.github/workflows/deploy-redis-prodhost.yml:48]

## Rollback

Secrets do not have a built-in version history. To roll back a secret, restore the previous value in GitHub and redeploy. For the Vault secret, rerun the vault workflow with the previous value. For Redis, restore the previous `REDIS_PASSWORD` and redeploy both the Redis stack and the application stacks.

## Troubleshooting

| Symptom                                  | Cause                                                                                 | Action                                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| A value is empty in the rendered `.env`  | The name is missing from the workflow `env:` block, the `envs:` list, or the template | Add the name to all three and redeploy                                                      |
| The app starts with an old value         | The deploy did not re-render `.env`                                                   | Run the deploy workflow again                                                               |
| The edge function cannot read a variable | Edge-function variables are injected by the functions workflows, not the app deploy   | Add the variable to `deploy-supabase-functions-qa.yml` / `-prod.yml` and redeploy functions |
| Redis auth fails after a password change | The application stack still has the old `.env`                                        | Redeploy the application stacks                                                             |
| A secret is visible in a compose file    | Never commit a rendered `.env` or a compose file with literal secrets                 | Move the value to GitHub and interpolate it                                                 |

## Related docs

- [./deploy.md](./deploy.md)
- [./supabase-operations.md](./supabase-operations.md)
- [./incident-response.md](./incident-response.md)
