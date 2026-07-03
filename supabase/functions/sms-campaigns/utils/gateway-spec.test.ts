import {
  assertEquals,
  assertExists,
  assertNotEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildSmsBody,
  type DiscoveredSmsSchema,
  discoverGatewaySpec,
  extractSmsRequestSchema,
  testGatewayReachability,
} from "./gateway-spec.ts";

/**
 * Minimal OpenAPI 3.0 spec with a /send-sms endpoint that uses
 * `{ to, message }` field names.
 */
const SWAGGER_SPEC_SEND_SMS = {
  openapi: "3.0.0",
  info: { title: "Test Gateway", version: "1.0.0" },
  paths: {
    "/send-sms": {
      post: {
        summary: "Send an SMS",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["to", "message"],
                properties: {
                  to: { type: "string" },
                  message: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "OK" } },
      },
    },
  },
};

/**
 * Minimal OpenAPI 3.0 spec with a /messages endpoint that uses
 * `{ phone, text }` field names.
 */
const SWAGGER_SPEC_MESSAGES_PHONE = {
  openapi: "3.0.0",
  info: { title: "Test Gateway", version: "1.0.0" },
  paths: {
    "/messages": {
      post: {
        summary: "Send a message",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["phone", "text"],
                properties: {
                  phone: { type: "string" },
                  text: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "OK" } },
      },
    },
  },
};

/**
 * Stub the global fetch with a sequence of responses. Each call to
 * fetch consumes the next response in the list. Once exhausted, the
 * final response is repeated.
 */
function stubFetch(
  responses: Array<{
    status: number;
    body?: string;
    contentType?: string;
  }>,
): { restore: () => void } {
  const original = globalThis.fetch;
  let callIndex = 0;

  globalThis.fetch = (async (
    _input: RequestInfo | URL,
    _init?: RequestInit,
  ) => {
    const index =
      callIndex < responses.length ? callIndex : responses.length - 1;
    callIndex += 1;
    const spec = responses[index];
    if (!spec) {
      return new Response("not found", { status: 404 });
    }
    const headers: Record<string, string> = {};
    if (spec.contentType) {
      headers["content-type"] = spec.contentType;
    }
    return new Response(spec.body ?? "", {
      status: spec.status,
      headers,
    });
  }) as typeof fetch;

  return {
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

Deno.test(
  "discoverGatewaySpec returns parsed spec when /swagger.json exists",
  async () => {
    const stub = stubFetch([
      {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(SWAGGER_SPEC_SEND_SMS),
      },
    ]);
    try {
      const spec = await discoverGatewaySpec("http://gateway.example.com");
      assertExists(spec);
      assertEquals(typeof spec, "object");
      const paths = (spec as { paths?: Record<string, unknown> }).paths;
      assertExists(paths);
      assertExists(paths["/send-sms"]);
    } finally {
      stub.restore();
    }
  },
);

Deno.test(
  "discoverGatewaySpec returns null when no spec is found",
  async () => {
    const stub = stubFetch([
      { status: 404, body: "not found" },
      { status: 404, body: "not found" },
      { status: 404, body: "not found" },
      { status: 404, body: "not found" },
      { status: 404, body: "not found" },
      { status: 404, body: "not found" },
    ]);
    try {
      const spec = await discoverGatewaySpec("http://no-spec.example.com");
      assertEquals(spec, null);
    } finally {
      stub.restore();
    }
  },
);

Deno.test(
  "discoverGatewaySpec skips malformed JSON and continues",
  async () => {
    const stub = stubFetch([
      { status: 200, contentType: "application/json", body: "not json {" },
      {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(SWAGGER_SPEC_SEND_SMS),
      },
    ]);
    try {
      const spec = await discoverGatewaySpec("http://gateway.example.com");
      assertExists(spec);
    } finally {
      stub.restore();
    }
  },
);

Deno.test("discoverGatewaySpec returns null for empty baseUrl", async () => {
  const spec = await discoverGatewaySpec("");
  assertEquals(spec, null);
});

Deno.test(
  "extractSmsRequestSchema finds /send-sms endpoint with `to` field",
  () => {
    const schema = extractSmsRequestSchema(SWAGGER_SPEC_SEND_SMS);
    assertExists(schema);
    assertEquals(schema.endpoint, "/send-sms");
    assertEquals(schema.phoneField, "to");
    assertEquals(schema.messageField, "message");
    assertEquals(schema.method, "POST");
    assertEquals(schema.requiredFields.includes("to"), true);
    assertEquals(schema.requiredFields.includes("message"), true);
  },
);

Deno.test(
  "extractSmsRequestSchema finds /messages endpoint with `phone` field",
  () => {
    const schema = extractSmsRequestSchema(SWAGGER_SPEC_MESSAGES_PHONE);
    assertExists(schema);
    assertEquals(schema.endpoint, "/messages");
    assertEquals(schema.phoneField, "phone");
    assertEquals(schema.messageField, "text");
    assertEquals(schema.method, "POST");
  },
);

Deno.test("extractSmsRequestSchema returns null for empty spec", () => {
  const schema = extractSmsRequestSchema(null);
  assertEquals(schema, null);

  const schema2 = extractSmsRequestSchema({});
  assertEquals(schema2, null);

  const schema3 = extractSmsRequestSchema({ openapi: "3.0.0", paths: {} });
  assertEquals(schema3, null);
});

Deno.test(
  "extractSmsRequestSchema returns null when required fields are missing",
  () => {
    const spec = {
      openapi: "3.0.0",
      paths: {
        "/send-sms": {
          post: {
            requestBody: {
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      unrelatedField: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };
    const schema = extractSmsRequestSchema(spec);
    assertEquals(schema, null);
  },
);

Deno.test("buildSmsBody uses schema fields when provided", () => {
  const schema: DiscoveredSmsSchema = {
    endpoint: "/send-sms",
    phoneField: "to",
    messageField: "text",
    method: "POST",
    requiredFields: ["to", "text"],
  };
  const body = buildSmsBody(schema, "+33612345678", "hello");
  assertEquals(body.to, "+33612345678");
  assertEquals(body.text, "hello");
  // Should not include the legacy `phone` or `message` keys.
  assertEquals((body as Record<string, unknown>).phone, undefined);
  assertEquals((body as Record<string, unknown>).message, undefined);
});

Deno.test(
  "buildSmsBody falls back to { phone, message } when schema is null",
  () => {
    const body = buildSmsBody(null, "+33612345678", "hello");
    assertEquals(body.phone, "+33612345678");
    assertEquals(body.message, "hello");
  },
);

Deno.test(
  "buildSmsBody falls back to { phone, message } when spec has no body schema",
  () => {
    // A spec with a path and a POST operation but NO `requestBody` field.
    // `extractSmsRequestSchema` must return `null` (no body schema to
    // extract field names from), and the caller must then fall back to
    // the legacy `{ phone, message }` shape via `buildSmsBody`.
    const specWithoutBody = {
      openapi: "3.0.0",
      info: { title: "Test Gateway", version: "1.0.0" },
      paths: {
        "/send-sms": {
          post: {
            summary: "Send an SMS (no body schema declared)",
            responses: { "200": { description: "OK" } },
          },
        },
      },
    };
    const schema = extractSmsRequestSchema(specWithoutBody);
    assertEquals(
      schema,
      null,
      "Spec without a requestBody must yield a null schema",
    );

    // The downstream `buildSmsBody` call receives that null and must
    // fall back to the legacy `{ phone, message }` shape.
    const body = buildSmsBody(schema, "+21697522154", "hello");
    assertEquals(body.phone, "+21697522154");
    assertEquals(body.message, "hello");
  },
);

Deno.test("testGatewayReachability reports success on 200", async () => {
  const stub = stubFetch([
    { status: 200, contentType: "application/json", body: "ok" },
  ]);
  try {
    const result = await testGatewayReachability(
      "http://gateway.example.com",
      null,
      1000,
    );
    assertEquals(result.success, true);
    assertNotEquals(result.message.indexOf("reachable"), -1);
  } finally {
    stub.restore();
  }
});

Deno.test(
  "testGatewayReachability reports success on 4xx (server alive)",
  async () => {
    const stub = stubFetch([
      { status: 422, contentType: "application/json", body: "bad" },
    ]);
    try {
      const result = await testGatewayReachability(
        "http://gateway.example.com",
        null,
        1000,
      );
      assertEquals(result.success, true);
    } finally {
      stub.restore();
    }
  },
);

Deno.test("testGatewayReachability reports failure on 5xx", async () => {
  const stub = stubFetch([
    { status: 503, contentType: "application/json", body: "down" },
  ]);
  try {
    const result = await testGatewayReachability(
      "http://gateway.example.com",
      null,
      1000,
    );
    assertEquals(result.success, false);
  } finally {
    stub.restore();
  }
});

Deno.test(
  "testGatewayReachability reports failure on network error",
  async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new TypeError("connection refused");
    }) as typeof fetch;
    try {
      const result = await testGatewayReachability(
        "http://unreachable.example.com",
        null,
        1000,
      );
      assertEquals(result.success, false);
    } finally {
      globalThis.fetch = original;
    }
  },
);

Deno.test(
  "testGatewayReachability reports failure on missing URL",
  async () => {
    const result = await testGatewayReachability("", null, 1000);
    assertEquals(result.success, false);
  },
);
