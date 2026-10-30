# Rollback

> Use this runbook when a deployment, migration or configuration change has broken an environment and you need to return to a previous known-good state.

## Verification status

This runbook is verified against `leadminer@469c7f8b`, `leadminer.io@256a710` and `supabase-selfhost-ops@56638b9`. The app-stack procedures (sections 1-2) are verified from the deploy workflows. The database procedure (section 3) is verified from the ops backup documentation, but its backup schedule is unverified. The edge-function layer (section 4) has no rollback mechanism. The frontend layer (section 5) is verifiable only by rebuilding.

## What "rollback" means, by layer

| Layer                      | Reversible?     | Mechanism                                                                  | Confidence |
| -------------------------- | --------------- | -------------------------------------------------------------------------- | ---------- |
| Leadminer app stack (QA)   | Yes             | `git revert` on `leadminer/main`, then let QA redeploy                     | High       |
| Leadminer app stack (prod) | Yes             | `git revert` on `leadminer/main`, then dispatch `deploy-prod-prodhost.yml` | High       |
| Database                   | Partial         | Restore a logical `s3-backup.sh` dump. PITR is not enabled here.           | Medium     |
| Supabase edge functions    | No              | No versioning and no delete on deploy. Fix forward.                        | Low        |
| Frontend image             | Yes, by rebuild | Rebuild the image from the revert commit; the tag is mutable.              | Medium     |

## Rollback triggers

Use this runbook when any of the following is true:

- A prod deploy completes but the application returns 5xx errors or fails post-deploy E2E (`test-leadminer-post-deploy.yml`).
- A migration applied to prod is confirmed to be incorrect and cannot be corrected by a forward migration within the outage window.
- A QA deploy breaks a shared dependency (the shared Redis or TheDig) in a way that also affects prod.
- A deployment introduces a security regression confirmed by an operator.

Do **not** use this runbook for a transient provider outage (Supabase Cloud, Docker Hub, GitHub) that resolves without a code change.

## 1. Leadminer app stack (QA)

1. Identify the commit that introduced the regression on `leadminer/main`. [verified leadminer@469c7f8b:.github/workflows/qa-trigger-backend-build.yml:5-10]
2. Run `git revert <commit>` and push the revert to `leadminer/main`. [verified leadminer@469c7f8b:.github/workflows/qa-trigger-backend-build.yml:5-10]
3. The push dispatches `trigger-qa-backend-build` (or `trigger-qa-frontend-build`) to `leadminer.io`. [verified leadminer@469c7f8b:.github/workflows/qa-trigger-backend-build.yml:23-29]
4. `qa-backend-build-deploy-prodhost.yml` checks out the app repo, runs `docker compose down`, `git restore docker-compose.yml`, `git fetch` and `git reset --hard origin/main`. [verified leadminer.io@256a710:.github/workflows/qa-backend-build-deploy-prodhost.yml:126-132]
5. The same job re-runs `leadminer-integration.sh` on the server before rebuilding backend services. [verified leadminer.io@256a710:.github/workflows/qa-backend-build-deploy-prodhost.yml:198-203]
6. The job renders the QA compose file and starts the stack: `envsubst < $CONF_REPO/docker-compose.qa.yml > $APP_REPO/docker-compose.yml` then `docker compose --env-file .env up -d`. [verified leadminer.io@256a710:.github/workflows/qa-backend-build-deploy-prodhost.yml:196-203]

Expected result: the QA containers restart on the reverted commit. The `docker-compose.yml` in `/home/leadminer/leadminer_qa` is generated from `leadminer.io/docker-compose.qa.yml` and restored by `git restore` before the reset, so any hand-edit to it is discarded. [verified leadminer.io@256a710:.github/workflows/qa-backend-build-deploy-prodhost.yml:126-132]

## 2. Leadminer app stack (prod)

1. Identify the commit that introduced the regression on `leadminer/main`. [verified leadminer@469c7f8b:.github/workflows/prod-trigger.yml:13-25]
2. Run `git revert <commit>` on `leadminer/main`. [unverified — confirm the target branch protection allows a revert commit without a release]
3. Either publish a new release (which dispatches `trigger-prod`) or run `deploy-prod-prodhost.yml` manually with `workflow_dispatch`. [verified leadminer@469c7f8b:.github/workflows/prod-trigger.yml:5-6] [verified leadminer.io@256a710:.github/workflows/deploy-prod-prodhost.yml:3-5]
4. Approve the `Deploy to Prod` issue. [verified leadminer.io@256a710:.github/workflows/deploy-prod-prodhost.yml:10-16]
5. The deploy job checks out the app repo, runs `docker compose down`, `git restore docker-compose.yml`, `git fetch` and `git reset --hard origin/main`. [verified leadminer.io@256a710:.github/workflows/deploy-prod-prodhost.yml:161-167]
6. The job renders the prod compose file: `envsubst < $CONF_REPO/docker-compose.yml > $REPO/docker-compose.yml`. [verified leadminer.io@256a710:.github/workflows/deploy-prod-prodhost.yml:237-238]
7. The job builds and starts the stack: `docker compose --env-file .env up -d --build --force-recreate`. [verified leadminer.io@256a710:.github/workflows/deploy-prod-prodhost.yml:244-249]

Expected result: the prod containers restart on the reverted commit. The frontend is pulled from `ankabootorg/leadminer-frontend:latest`, which still carries the new build until the image is rebuilt from the revert (see section 5). [verified leadminer.io@256a710:.github/workflows/deploy-prod-prodhost.yml:79]

## 3. Database

The database layer is partial. The only documented restore path is the logical dump produced by `data-backup/s3-backup.sh`; PITR through `supabase-selfhost-ops/restore.yml` is not installed by the Leadminer stack workflow. [verified supabase-selfhost-ops@56638b9:env/supabase.yml:262] [verified leadminer.io@256a710:.github/workflows/deploy-supabase-stack-qa.yml:225-233]

The dump has two hard caveats:

- It is **data-only**. If the schema is not already present, restore the matching schema dump first. [verified leadminer.io@256a710:data-backup/README.md:100-102]
- The documented backup command _intends_ to exclude the sharded `messages_0..2` and `pointsofcontact_0..2` tables, so a restore would omit them. However, see `## Do not do`: the `-x` flag does not reach the dump command in the current script, so those tables may be present in the dump. [verified leadminer.io@256a710:data-backup/README.md:64-74] [verified leadminer.io@256a710:data-backup/s3-backup.sh:58] [verified leadminer.io@256a710:data-backup/s3-backup.sh:85-96]

Procedure:

1. Locate the dump pair in the S3 bucket (the file names carry a timestamp, e.g. `2026-07-10_02-00-01-data-dump.sql.gz`). [unverified — confirm before first use: the bucket name and credentials are not defined in the repo]
2. Decompress the data dump: `gzip -d <timestamp>-data-dump.sql.gz`. [verified leadminer.io@256a710:data-backup/README.md:93]
3. Copy the dump into the database container: `docker cp <timestamp>-data-dump.sql supabase-db-prod:/tmp/dump.sql`. [verified leadminer.io@256a710:data-backup/README.md:95]
4. Restore the data: `docker exec -i supabase-db-prod psql -U postgres -d postgres -f /tmp/dump.sql`. [verified leadminer.io@256a710:data-backup/README.md:97]
5. Re-sync every auto-increment sequence. This step is **mandatory**, not advisory. [verified leadminer.io@256a710:data-backup/README.md:106-122] For example:
   ```sql
   SELECT setval(
       pg_get_serial_sequence('auth.refresh_tokens', 'id'),
       COALESCE(MAX(id), 0) + 1,
       false
   ) FROM auth.refresh_tokens;
   ```
   [verified leadminer.io@256a710:data-backup/README.md:106-122]
6. Verify login and a representative write. A stale sequence produces intermittent `duplicate key value violates unique constraint` errors. [verified leadminer.io@256a710:data-backup/README.md:108-110]

The `supabase-db-prod` container name follows the Supabase stack's `deploy_env` suffix convention (`supabase-db-<env>`). [verified supabase-selfhost-ops@56638b9:AGENTS.md:88]

## 4. Supabase edge functions

**No rollback mechanism exists.**

The edge-function deploy copies the current function tree into the runtime volume with `cp -r "$leadminer_folder_path"/supabase/functions/* "$FUNCTIONS_PATH"`. It has no version history, no previous-artifact store and no delete: the previous function code is overwritten in place. [verified leadminer.io@256a710:.github/workflows/deploy-supabase-functions-prod.yml:57-60] [verified leadminer.io@256a710:.github/workflows/deploy-supabase-functions-qa.yml:64-67]

The only safe action after a bad function deploy is to fix forward: correct the function in `leadminer` (or `leadminer-commercial` for the excluded paths), sync it to `leadminer.io`, and redeploy the functions. See [./supabase-operations.md](./supabase-operations.md#procedure-how-to-actually-retire-an-edge-function) for the retirement procedure.

Do not attempt to restore a previous function from the running container; the files are not versioned and there is no snapshot.

## 5. Frontend image

The frontend uses a mutable `:latest` tag per environment (`ankabootorg/leadminer-frontend:latest` for prod, `ankabootorg/leadminer-frontend-qa:latest` for QA). There is no immutable tag and no image digest in the deploy path. [verified leadminer.io@256a710:docker-compose.yml:48] [verified leadminer.io@256a710:docker-compose.qa.yml:48]

To restore a previous frontend:

1. Revert the offending commit on `leadminer/main`. [verified leadminer@469c7f8b:.github/workflows/qa-trigger-frontend-build.yml:5-9]
2. Let QA rebuild the QA tag automatically, or dispatch `deploy-prod-prodhost.yml` for prod. [verified leadminer.io@256a710:.github/workflows/deploy-prod-prodhost.yml:51-79]
3. The build pushes the same mutable tag. The previous image is replaced, not kept. [verified leadminer.io@256a710:docker-compose.yml:48]

There is no way to roll the frontend back without a rebuild.

## Do not do

- Never hand-edit the droplet's generated `docker-compose.yml`. The deploy workflow runs `git restore docker-compose.yml` and then overwrites it with `envsubst`; hand-edits are discarded on the next deploy. [verified leadminer.io@256a710:.github/workflows/qa-backend-build-deploy-prodhost.yml:128]
- Never delete rows from `supabase_migrations.schema_migrations` outside the guarded pattern in `supabase-migrations-prod.yml:96-99`. Both deletes are conditioned (`name LIKE '%placeholder%'` and a `NOT EXISTS` table check) so they cannot fire twice. [verified leadminer.io@256a710:.github/workflows/supabase-migrations-prod.yml:96-99]
- Never run `supabase db push` without `--include-all` against prod. Out-of-order migrations are expected. [verified leadminer.io@256a710:.github/workflows/supabase-migrations-prod.yml:106-108]
- Never restore a dump without re-syncing sequences. [verified leadminer.io@256a710:data-backup/README.md:112-122]
- Never assume the `-x` table exclusions in the backup example actually apply: the script parses `-x` into `exclude_tables` but the dump command reads `EXCLUDE_TABLES` from the environment. [verified leadminer.io@256a710:data-backup/s3-backup.sh:58] [verified leadminer.io@256a710:data-backup/s3-backup.sh:85-96]

## Known gaps / confirm before first use

- Is the S3 backup cron actually installed on the DB host? The wiring is manual and per-host; the README says to add the line to `crontab -e` on the DB host, and no workflow or Ansible role references `s3-backup.sh`. [verified leadminer.io@256a710:data-backup/README.md:76-86]
- Is there any tested restore of the Leadminer QA or prod database? No restore drill is documented in the ops repo.
- Who holds prod SSH access and the S3 bucket credentials?
- Is the host behind `vars.LEADMINER_QA_IP` still the QA Supabase host, or retired? The variable is still used by `update-droplet.yaml`, `supabase-storage-upload.yml`, `deploy-ansible.yml` and `deploy-monitoring.yml`. [verified leadminer.io@256a710:.github/workflows/update-droplet.yaml:18] [verified leadminer.io@256a710:.github/workflows/deploy-ansible.yml:62]
- What is the actual production database host and container name for a given deploy? The `supabase-db-prod` name follows the `deploy_env` convention but the exact rendered value is only on the server. [verified supabase-selfhost-ops@56638b9:AGENTS.md:88]

## Post-incident record

Record the following in the incident issue:

- Which layer was rolled back and why.
- The failed commit SHA and the revert commit SHA.
- The exact workflow run URL for the rollback deploy.
- Whether the database was restored, and if so, which dump timestamp and which tables were excluded.
- Any sequence resync commands that were run.
- Whether the frontend image was rebuilt, and from which commit.
- The time the environment was confirmed healthy and by whom.

## Related docs

- [./deploy.md](./deploy.md)
- [./incident-response.md](./incident-response.md)
- [./supabase-operations.md](./supabase-operations.md)
