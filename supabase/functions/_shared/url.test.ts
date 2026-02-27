import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolvePublicBaseUrl } from "./url.ts";

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
