import {
  assertEquals,
  assertExists,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createSmsProvider, type SmsGatewayIosCredentials } from "./mod.ts";
import {
  SMS_GATEWAY_IOS_APP_ID,
  SMS_GATEWAY_IOS_PROVIDER_NAME,
} from "./sms-gateway-ios-provider.ts";

Deno.test("createSmsProvider creates sms-gateway-ios provider", () => {
  const provider = createSmsProvider("sms-gateway-ios", {
    smsGatewayIos: {
      baseUrl: "https://gateway.example.com",
    },
  });

  assertEquals(provider.name, SMS_GATEWAY_IOS_PROVIDER_NAME);
});

Deno.test("sms-gateway-ios provider requires baseUrl", () => {
  const credentials: SmsGatewayIosCredentials = {
    baseUrl: "",
  };

  assertThrows(() => {
    createSmsProvider("sms-gateway-ios", {
      smsGatewayIos: credentials,
    });
  });
});

Deno.test(
  "sms-gateway-ios provider POSTs to /send-sms with iOS body shape (to, message, id)",
  async () => {
    const originalFetch = globalThis.fetch;
    let capturedUrl = "";
    let capturedBody: unknown = null;
    let capturedHeaders: HeadersInit | undefined;

    globalThis.fetch = (async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      capturedUrl = String(input);
      capturedBody = init?.body;
      capturedHeaders = init?.headers;
      return new Response(
        JSON.stringify({ id: "msg_ios_1", status: "sent", error: null }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    try {
      const provider = createSmsProvider("sms-gateway-ios", {
        smsGatewayIos: {
          baseUrl: "https://gateway.example.com",
        },
      });

      const result = await provider.send({
        to: "+21697522154",
        from: "Leadminer",
        body: "Hello",
      });

      assertEquals(result.success, true);
      assertEquals(result.messageId, "msg_ios_1");
      // Path always lives under `/send-sms`; the baseUrl is joined as-is.
      assertEquals(capturedUrl, "https://gateway.example.com/send-sms");
      const body = JSON.parse(String(capturedBody)) as Record<string, unknown>;
      // iOS app uses `to` and `message`, plus a per-request `id`.
      assertEquals(body.to, "+21697522154");
      assertEquals(body.message, "Hello");
      assertExists(body.id);
      // No legacy `phone` field — the iOS app would ignore it.
      assertEquals(body.phone, undefined);
      const headers = capturedHeaders as Record<string, string> | undefined;
      assertEquals(headers?.["Content-Type"], "application/json");
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
);

Deno.test(
  "sms-gateway-ios provider returns error message from 4xx response",
  async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ error: "Invalid recipient" }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    try {
      const provider = createSmsProvider("sms-gateway-ios", {
        smsGatewayIos: {
          baseUrl: "https://gateway.example.com",
        },
      });

      const result = await provider.send({
        to: "+21697522154",
        from: "Leadminer",
        body: "Hello",
      });

      assertEquals(result.success, false);
      assertEquals(result.error, "Invalid recipient");
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
);

Deno.test(
  "sms-gateway-ios provider treats status:failed as a failure even on 2xx",
  async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({ id: "msg_x", status: "failed", error: "no sim" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    try {
      const provider = createSmsProvider("sms-gateway-ios", {
        smsGatewayIos: {
          baseUrl: "https://gateway.example.com",
        },
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

Deno.test(
  "sms-gateway-ios provider maps a 5xx response to an error",
  async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ error: "boom" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    try {
      const provider = createSmsProvider("sms-gateway-ios", {
        smsGatewayIos: {
          baseUrl: "https://gateway.example.com",
        },
      });

      const result = await provider.send({
        to: "+21697522154",
        from: "Leadminer",
        body: "Hello",
      });

      assertEquals(result.success, false);
      assertEquals(typeof result.error, "string");
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
);

Deno.test("SMS_GATEWAY_IOS_APP_ID is the stable app id", () => {
  assertEquals(SMS_GATEWAY_IOS_APP_ID, "ios-sms-gateway");
});
