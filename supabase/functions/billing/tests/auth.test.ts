function extractBearerToken(header?: string): string | null {
  if (!header) return null;

  const parts = header.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    return null;
  }

  return parts[1];
}

Deno.test({
  name: "extractBearerToken - should extract token from valid header",
  fn() {
    const result = extractBearerToken("Bearer my-secret-token");
    if (result !== "my-secret-token") throw new Error(`Expected "my-secret-token", got "${result}"`);
  },
});

Deno.test({
  name: "extractBearerToken - should handle lowercase bearer",
  fn() {
    const result = extractBearerToken("bearer my-secret-token");
    if (result !== "my-secret-token") throw new Error(`Expected "my-secret-token", got "${result}"`);
  },
});

Deno.test({
  name: "extractBearerToken - should return null for missing header",
  fn() {
    const result = extractBearerToken();
    if (result !== null) throw new Error("Expected null");
  },
});

Deno.test({
  name: "extractBearerToken - should return null for empty header",
  fn() {
    const result = extractBearerToken("");
    if (result !== null) throw new Error("Expected null");
  },
});

Deno.test({
  name: "extractBearerToken - should return null for whitespace only",
  fn() {
    const result = extractBearerToken("   ");
    if (result !== null) throw new Error("Expected null");
  },
});

Deno.test({
  name: "extractBearerToken - should return null for non-bearer scheme",
  fn() {
    const result = extractBearerToken("Basic dXNlcjpwYXNz");
    if (result !== null) throw new Error("Expected null");
  },
});

Deno.test({
  name: "extractBearerToken - should return null for extra parts",
  fn() {
    const result = extractBearerToken("Bearer token extra-parts");
    if (result !== null) throw new Error("Expected null");
  },
});

Deno.test({
  name: "extractBearerToken - should return null for single part",
  fn() {
    const result = extractBearerToken("Bearer");
    if (result !== null) throw new Error("Expected null");
  },
});

function verifyServiceRole(authHeader: string | undefined, serviceRoleKey: string): boolean {
  const token = extractBearerToken(authHeader);
  return token === serviceRoleKey;
}

Deno.test({
  name: "verifyServiceRole - should return true for valid service role key",
  fn() {
    const result = verifyServiceRole("Bearer valid-key", "valid-key");
    if (result !== true) throw new Error("Expected true");
  },
});

Deno.test({
  name: "verifyServiceRole - should return false for invalid key",
  fn() {
    const result = verifyServiceRole("Bearer wrong-key", "valid-key");
    if (result !== false) throw new Error("Expected false");
  },
});

Deno.test({
  name: "verifyServiceRole - should return false for undefined auth header",
  fn() {
    const result = verifyServiceRole(undefined, "valid-key");
    if (result !== false) throw new Error("Expected false");
  },
});

Deno.test({
  name: "verifyServiceRole - should return false for empty auth header",
  fn() {
    const result = verifyServiceRole("", "valid-key");
    if (result !== false) throw new Error("Expected false");
  },
});
