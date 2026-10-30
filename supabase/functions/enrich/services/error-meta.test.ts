import {
  assertEquals,
  assertFalse,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { errorMeta } from "./error-meta.ts";

Deno.test("errorMeta: serializes an Error without carrying arbitrary values", () => {
  const error = Object.assign(new Error("boom"), {
    code: "E_PROVIDER",
    status: 503,
  });

  const meta = errorMeta(error);

  assertEquals(meta.name, "Error");
  assertEquals(meta.message, "boom");
  assertEquals(meta.code, "E_PROVIDER");
  assertEquals(meta.status, 503);
  assertFalse("stack" in meta ? typeof meta.stack !== "string" : false);
});

Deno.test("errorMeta: falls back to response.status when status is absent", () => {
  const error = Object.assign(new Error("unauthorized"), {
    response: { status: 401 },
  });

  const meta = errorMeta(error);

  assertEquals(meta.message, "unauthorized");
  assertEquals(meta.status, 401);
});

Deno.test("errorMeta: normalizes non-Error throws without dumping object fields", () => {
  const meta = errorMeta({ email: "pii@example.com" });

  assertEquals(meta.name, "UnknownError");
  assertEquals(meta.message, "[object Object]");
  assertFalse(meta.message.includes("pii@example.com"));
});

Deno.test("errorMeta: handles null and undefined", () => {
  assertEquals(errorMeta(null), {
    name: "UnknownError",
    message: "null",
  });
  assertEquals(errorMeta(undefined), {
    name: "UnknownError",
    message: "undefined",
  });
});
