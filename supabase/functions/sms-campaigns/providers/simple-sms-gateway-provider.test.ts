import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createSmsProvider, type SimpleSmsGatewayCredentials } from "./mod.ts";

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
