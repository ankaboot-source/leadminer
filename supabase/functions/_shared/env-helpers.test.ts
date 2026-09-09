import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { getOptionalEnv, getRequiredEnv } from "./env-helpers.ts";

const UNSET = "AUDIT_TEST_OPTIONAL_UNSET_VAR";

Deno.test("getOptionalEnv returns the value when set", () => {
  Deno.env.set(UNSET, "hello");
  try {
    assertEquals(getOptionalEnv(UNSET), "hello");
    assertEquals(getOptionalEnv(UNSET, "fallback"), "hello");
  } finally {
    Deno.env.delete(UNSET);
  }
});

Deno.test("getOptionalEnv falls back when unset", () => {
  // skipcq: JS-W1042 - unset-on-purpose is the point of this test
  assertEquals(getOptionalEnv(UNSET), "");
  assertEquals(getOptionalEnv(UNSET, "fallback"), "fallback");
});

Deno.test("getOptionalEnv falls back when set to empty string", () => {
  Deno.env.set(UNSET, "");
  try {
    assertEquals(getOptionalEnv(UNSET, "fallback"), "fallback");
  } finally {
    Deno.env.delete(UNSET);
  }
});

Deno.test("getRequiredEnv throws a clear error when unset or empty", () => {
  assertThrows(
    () => getRequiredEnv(UNSET),
    Error,
    `Missing required environment variable: ${UNSET}`,
  );
  Deno.env.set(UNSET, "");
  try {
    assertThrows(
      () => getRequiredEnv(UNSET),
      Error,
      `Missing required environment variable: ${UNSET}`,
    );
  } finally {
    Deno.env.delete(UNSET);
  }
});
