# Incident response

> Use this runbook when a Leadminer environment is degraded or down, and you need to identify the blast radius, triage the symptom and start the response.

## When to use this

- A production or QA endpoint is returning errors, or the application is unreachable.
- A deploy failed and left a service unhealthy.
- A database or Supabase endpoint is failing.
- Monitoring fired an alert (HTTP status, memory, disk, Redis, fail2ban).

## Preconditions

- Access to the `leadminer.io` and `leadminer` repos.
- Access to Grafana at `https://monitor.ankaboot.io` through GitHub SSO. [verified leadminer.io@256a710:docs/MONITORING.md:63-66]
- SSH access to the relevant host, or the ability to ask a maintainer who has it.
- The on-call approver list for prod: `baderdean`, `zieddhf`. [verified leadminer.io@256a710:.github/workflows/deploy-prod-prodhost.yml:10-16]

## Topology and blast radius

There are five hosts in the production system. They are not symmetric. [verified leadminer.io@256a710:docs/MONITORING.md:5-14]

| Host                                                                    | What it runs                                                                                                                 | Blast radius                                                                                                                                                                                 |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Leadminer prod host (`vars.LEADMINER_PROD_IP`)                          | The prod and QA application stacks, the shared Redis, TheDig (prod+QA), Caddy, and the fail2ban/logrotate/cron configuration | A host failure affects both prod and QA application traffic. The two stacks share the Docker network `leadminer-net` and the same Redis instance.                                            |
| Supabase QA (`vars.SSH_HOST_SUPABASE_QA` / `vars.SUPABASE_QA_IP`)       | The QA self-hosted Supabase stack                                                                                            | A QA Supabase failure affects QA only. It does not affect the application host or prod Supabase.                                                                                             |
| Supabase prod (`vars.SSH_HOST_SUPABASE_PROD` / `vars.SUPABASE_PROD_IP`) | The prod self-hosted Supabase stack                                                                                          | A prod Supabase failure affects prod application features that depend on the database, auth, storage and edge functions.                                                                     |
| Monitoring (`vars.SSH_HOST_MONITORING`, `monitor.ankaboot.io`)          | Prometheus, Grafana, Loki, Blackbox, Uptime-Kuma, redis-exporter, node-exporter                                              | A monitoring host failure removes visibility and alerting; it does not stop the product.                                                                                                     |
| Mail / OVH (`mail.leadminer.io`)                                        | Mail server, Reacher, monitoring agents                                                                                      | A mail-server failure affects email verification and outbound notification mail; it does not stop the application API. [verified leadminer.io@256a710:docs/oxahost-leadminer-server.md:1-20] |

A separate QA host referenced by `vars.LEADMINER_QA_IP` is still in use. It appears in `update-droplet.yaml`, `supabase-storage-upload.yml`, `deploy-ansible.yml` and `deploy-monitoring.yml` for email-template upload, fail2ban/cron/logrotate, monitoring agents and nightly upgrades. Treat it as a live dependency even though the QA application stack runs on the prod host. [verified leadminer.io@256a710:.github/workflows/update-droplet.yaml:18] [verified leadminer.io@256a710:.github/workflows/supabase-storage-upload.yml:31] [verified leadminer.io@256a710:.github/workflows/deploy-ansible.yml:62] [verified leadminer.io@256a710:.github/workflows/deploy-monitoring.yml:186]

## Monitoring

The authority for the monitoring stack is `leadminer.io/docs/MONITORING.md`. [verified leadminer.io@256a710:docs/MONITORING.md:1-72]

- **Master** (`monitor.ankaboot.io`): Loki, Prometheus, Grafana, Blackbox, Uptime-Kuma, redis-exporter, node-exporter.
- **Agents** on the leadminer prod/QA, Supabase prod/QA and mail hosts: Promtail, node-exporter, cAdvisor, postgres-exporter (Supabase only).
- **Metrics**: Prometheus scrapes exporters at 5s; Blackbox probes HTTPS and SMTP endpoints; Redis memory is scraped at 300s.
- **Logs**: Promtail ships container, journal and `/var/log/*` logs to Loki on port `3100`.
- **Alerts**: Grafana Unified Alerting. The file-provisioned rules cover status, memory above 80%, disk at or above 85%, Redis memory above 300MB and fail2ban bans. Alert mail goes to `alert@leadminer.io`.

Use Grafana first. If Grafana is unreachable, use Uptime-Kuma on the master host loopback (`127.0.0.1:3001`) or the per-host `docker logs` / `journalctl` commands in the troubleshooting table.

## Triage by symptom

| Symptom                                                         | First check                                                                | Likely layer                | Go to                                                |
| --------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------- |
| Prod or QA returns 5xx                                          | Grafana status alert, then the application container logs on the prod host | Application stack           | [./troubleshooting.md](./troubleshooting.md)         |
| Both prod and QA are unreachable                                | Caddy and the prod host itself                                             | Shared host / reverse proxy | This document, below                                 |
| A specific API route returns 404 on QA                          | Whether the backend image was rebuilt                                      | Application deploy ordering | [./deploy.md](./deploy.md)                           |
| Database errors, auth failures, or PostgREST function-not-found | Supabase status, the `supabase-db-<env>` container, PostgREST schema cache | Supabase                    | [./supabase-operations.md](./supabase-operations.md) |
| Edge functions return 500                                       | The `functions` service logs and the deployed `_shared` files              | Supabase edge functions     | [./troubleshooting.md](./troubleshooting.md)         |
| Email delivery fails                                            | Mail host reachability and Reacher                                         | Mail / OVH                  | [./troubleshooting.md](./troubleshooting.md)         |
| Disk or memory alert                                            | Prometheus/Grafana host metrics                                            | Host resource exhaustion    | This document, below                                 |

## Procedure

1. Confirm the symptom is real and not a single-client issue: check the public endpoint and the Grafana status panel. [verified leadminer.io@256a710:docs/MONITORING.md:52-59]
2. Identify the affected host from the symptom and the blast-radius table above. [verified leadminer.io@256a710:docs/MONITORING.md:5-14]
3. Open the relevant runbook for the layer: [verified leadminer.io@256a710:docs/MONITORING.md:5-14]
   - Application deploy or config: [./deploy.md](./deploy.md).
   - Application rollback: [./rollback.md](./rollback.md).
   - Database or edge functions: [./supabase-operations.md](./supabase-operations.md).
   - Known symptoms (contacts fetch, stale helper, signature drift, passive-mining auth, html-entities, local E2E): [./troubleshooting.md](./troubleshooting.md).
4. If the fix requires a prod deploy, trigger the workflow and obtain approval from `baderdean` or `zieddhf`. [verified leadminer.io@256a710:.github/workflows/deploy-prod-prodhost.yml:10-16]
5. If the fix requires a rollback, follow [./rollback.md](./rollback.md). Do not hand-edit the droplet compose file. [verified leadminer.io@256a710:.github/workflows/qa-backend-build-deploy-prodhost.yml:128]
6. Record the incident start time, the symptom, the affected host, the action taken and the recovery time. [unverified — confirm before first use]
7. After recovery, run the post-deploy E2E suite against the affected environment. [verified leadminer.io@256a710:.github/workflows/test-leadminer-post-deploy.yml:1-20]

## Escalation

- **QA-only incident**: the maintainer who owns the change; no prod approval required.
- **Prod application incident**: the on-call maintainer plus one of `baderdean` / `zieddhf`. [verified leadminer.io@256a710:.github/workflows/deploy-prod-prodhost.yml:13]
- **Prod Supabase incident**: the Supabase maintainer plus the on-call maintainer. The prod Supabase host is separate from the application host.
- **Host-level or security incident**: escalate immediately; do not attempt a workaround that bypasses the approval gate.
- **Data loss or suspected data corruption**: stop the deploy pipeline, do not run a restore until the rollback owner has confirmed which dump to use, and follow [./rollback.md](./rollback.md).

## Communication

- Use a single incident issue. State the symptom, the affected host, the user impact and the current action.
- Update the issue at every state change (identified, mitigating, recovered).
- Do not paste secret values, connection strings or tokens into the issue.
- For a prod incident, link the failing workflow run and the rollback run.

## Post-incident record

Create a record containing:

- Incident title and severity.
- Start time, detection time, recovery time.
- Affected hosts and layers.
- User impact.
- Root cause (or "unknown" with the evidence gathered).
- What fixed it (commit SHA, workflow run URL, rollback action, database dump).
- What was learned and which runbook or alert needs updating.
- Follow-up actions with owners.

## Related docs

- [./troubleshooting.md](./troubleshooting.md)
- [./deploy.md](./deploy.md)
- [./rollback.md](./rollback.md)
- [./supabase-operations.md](./supabase-operations.md)
