import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolveCampaignBaseUrlFromEnv, resolvePublicBaseUrl } from "./url.ts";

Deno.test("resolvePublicBaseUrl prefers explicit public URL", () => {
  const value = resolvePublicBaseUrl(
    "https://db-qa.domain.io/",
    "http://kong:8000",
  );
  assertEquals(value, "https://db-qa.domain.io");
});

Deno.test("resolvePublicBaseUrl falls back to secondary URL", () => {
  const value = resolvePublicBaseUrl(undefined, "http://localhost:54321/");
  assertEquals(value, "http://localhost:54321");
});

Deno.test("resolvePublicBaseUrl throws when both values are missing", () => {
  assertThrows(() => resolvePublicBaseUrl());
});

Deno.test("resolveCampaignBaseUrlFromEnv prefers SUPABASE_PROJECT_URL", () => {
  const value = resolveCampaignBaseUrlFromEnv((key) => {
    if (key === "SUPABASE_PROJECT_URL") return "https://db-qa.domain.io/";
    if (key === "SUPABASE_URL") return "http://kong:8000";
    return undefined;
  });

  assertEquals(value, "https://db-qa.domain.io");
});

Deno.test("resolveCampaignBaseUrlFromEnv falls back to SUPABASE_URL", () => {
  const value = resolveCampaignBaseUrlFromEnv((key) => {
    if (key === "SUPABASE_URL") return "http://localhost:54321/";
    return undefined;
  });

  assertEquals(value, "http://localhost:54321");
});
