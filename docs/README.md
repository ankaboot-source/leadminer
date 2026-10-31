# Leadminer docs

For developers new to this repository who need to change or debug it.

With these docs you can **trace a mining run** from request to stored contact, **add a
service provider** behind an existing interface, and **debug a stuck task** by finding the
process and stream that owns it.

Scope: architecture, the mining pipeline, the HTTP API, campaigns, local setup, and the
three mining side-services. Campaign internals are in [campaigns.md](campaigns.md); deeper
data-model detail beyond the campaign tables is still thin.

## 15-minute path

1. [README local setup](../README.md#-how-to-run-locally) — get the stack running.
2. [Architecture](architecture.md) — processes, ports and request paths.
3. [Mining pipeline](mining-pipeline.md) — Fetch → Extract → Clean → Signature.
4. One service doc, e.g. [Enrichment](services/enrichment.md).
5. [Campaigns](campaigns.md) — channels, tables, tracking and consent.

## All docs

- [Docs index](README.md)
- [Architecture](architecture.md)
- [Mining pipeline](mining-pipeline.md)
- [API reference](api.md)
- [Campaigns](campaigns.md)
- [Local development](local-development.md)
- [Enrichment](services/enrichment.md), [Email verification](services/email-verification.md), [Signature extraction](services/signature-extraction.md)
