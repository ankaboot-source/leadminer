import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  createSmsProvider,
  SMS_GATEWAY_PROVIDER_NAME,
  type SmsGatewayCredentials,
} from "./mod.ts";
import { SmsGatewayProvider } from "./sms-gateway-provider.ts";

Deno.test("createSmsProvider creates sms-gateway provider", () => {
  const provider = createSmsProvider("sms-gateway", {
    smsGateway: { baseUrl: "https://gateway.example.com" },
  });
  assertEquals(provider.name, "sms-gateway");
});

Deno.test("sms-gateway provider requires baseUrl", () => {
  assertThrows(() => {
    const provider = new SmsGatewayProvider({ baseUrl: "" } as SmsGatewayCredentials);
    return provider;
  });
});

Deno.test(
  "sms-gateway provider sends { to, message, id } body shape",
  async () => {
    const originalFetch = globalThis.fetch;
    let capturedUrl = "";
    let capturedBody: unknown = null;

    globalThis.fetch = ((
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      capturedUrl = String(input);
      capturedBody = init?.body;
      return Promise.resolve(new Response(
        JSON.stringify({ id: "msg_1", status: "sent", error: null }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ));
    }) as typeof fetch;

    try {
      const provider = new SmsGatewayProvider({
        baseUrl: "https://gateway.example.com",
      });
      const result = await provider.send({
        to: "+21697522154",
        from: "Leadminer",
        body: "Hello",
      });

      assertEquals(result.success, true);
      assertEquals(result.messageId, "msg_1");
      assertEquals(capturedUrl, "https://gateway.example.com/send-sms");
      const body = JSON.parse(String(capturedBody)) as Record<string, unknown>;
      assertEquals(body.to, "+21697522154");
      assertEquals(body.message, "Hello");
      assertEquals(typeof body.id, "string");
      assertEquals("phone" in body, false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
);

Deno.test(
  "sms-gateway provider maps status:failed to a failure result",
  async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() =>
      Promise.resolve(new Response(
        JSON.stringify({ id: "msg_x", status: "failed", error: "no sim" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ))) as typeof fetch;

    try {
      const provider = new SmsGatewayProvider({
        baseUrl: "https://gateway.example.com",
      });
      const result = await provider.send({
        to: "+21697522154",
        from: "Leadminer",
        body: "Hello",
      });
      assertEquals(result.success, false);
      assertEquals(result.error, "no sim");
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
);

Deno.test("sms-gateway provider extracts error from 4xx response", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() =>
    Promise.resolve(new Response(JSON.stringify({ error: "bad payload" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    }))) as typeof fetch;

  try {
    const provider = new SmsGatewayProvider({
      baseUrl: "https://gateway.example.com",
    });
    const result = await provider.send({
      to: "+21697522154",
      from: "Leadminer",
      body: "Hello",
    });
    assertEquals(result.success, false);
    assertEquals(result.error, "bad payload");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("SMS_GATEWAY_PROVIDER_NAME is the stable id", () => {
  assertEquals(SMS_GATEWAY_PROVIDER_NAME, "sms-gateway");
});

Deno.test("sms-gateway provider returns timeout error when fetch aborts", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() =>
    Promise.reject(new DOMException("aborted", "AbortError"))) as typeof fetch;

  try {
    const provider = new SmsGatewayProvider({
      baseUrl: "https://gateway.example.com",
    });
    const result = await provider.send({
      to: "+21697522154",
      from: "Leadminer",
      body: "Hello",
    });
    assertEquals(result.success, false);
    assertEquals(typeof result.error, "string");
    assertEquals(result.error?.includes("timeout"), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
