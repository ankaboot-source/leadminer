import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { generateShortToken } from "./short-token.ts";

Deno.test("generateShortToken returns an 8-char base62 token", () => {
  const token = generateShortToken();

  assertEquals(token.length, 8);
  assert(/^[A-Za-z0-9]+$/.test(token));
});

Deno.test("generateShortToken produces different values", () => {
  const first = generateShortToken();
  const second = generateShortToken();

  assert(first !== second);
});
