import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createSmsProvider, type SimpleSmsGatewayCredentials } from "./mod.ts";
import type { DiscoveredSmsSchema } from "../utils/gateway-spec.ts";

Deno.test("createSmsProvider creates simple-sms-gateway provider", () => {
  const provider = createSmsProvider("simple-sms-gateway", {
    simpleSmsGateway: {
      baseUrl: "https://gateway.example.com",
    },
  });

  assertEquals(provider.name, "simple-sms-gateway");
});

Deno.test("simple-sms-gateway provider requires credentials", () => {
  const credentials: SimpleSmsGatewayCredentials = {
    baseUrl: "",
  };

  assertThrows(() => {
    createSmsProvider("simple-sms-gateway", {
      simpleSmsGateway: credentials,
    });
  });
});

Deno.test(
  "simple-sms-gateway provider maps successful send response",
  async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ id: "msg_123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    try {
      const provider = createSmsProvider("simple-sms-gateway", {
        simpleSmsGateway: {
          baseUrl: "https://gateway.example.com",
        },
      });

      const result = await provider.send({
        to: "+33612345678",
        from: "Leadminer",
        body: "Hello",
      });

      assertEquals(result.success, true);
      assertEquals(result.messageId, "msg_123");
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
);

Deno.test(
  "simple-sms-gateway provider uses discovered body schema when provided",
  async () => {
    const originalFetch = globalThis.fetch;
    let capturedBody: unknown = null;

    globalThis.fetch = (async (
      _input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      capturedBody = init?.body;
      return new Response(JSON.stringify({ id: "msg_discovered" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const discovered: DiscoveredSmsSchema = {
      endpoint: "/send-sms",
      phoneField: "to",
      messageField: "text",
      method: "POST",
      requiredFields: ["to", "text"],
    };

    try {
      const provider = createSmsProvider("simple-sms-gateway", {
        simpleSmsGateway: {
          baseUrl: "https://gateway.example.com",
          bodySchema: discovered,
        },
      });

      const result = await provider.send({
        to: "+33612345678",
        from: "Leadminer",
        body: "Hello",
      });

      assertEquals(result.success, true);
      assertEquals(result.messageId, "msg_discovered");
      const body = JSON.parse(String(capturedBody)) as Record<string, unknown>;
      // Discovered field names, not the legacy defaults.
      assertEquals(body.to, "+33612345678");
      assertEquals(body.text, "Hello");
      assertEquals(body.phone, undefined);
      assertEquals(body.message, undefined);
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
);
