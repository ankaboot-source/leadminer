/**
 * Self-tests for the SMS Gateway Mock Server.
 *
 * These tests verify the mock server's own behavior directly,
 * not the campaign processor.
 */

import {
  assertEquals,
  assertExists,
  assertMatch,
  assertObjectMatch,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createMockServer, resetMockServer } from "./index.ts";

const BASE = "http://localhost:8000";
const PROVIDER_SIMPLE = `${BASE}/simple-sms-gateway`;
const PROVIDER_SMSGATE = `${BASE}/smsgate`;

function makeApp() {
  const app = createMockServer();
  return app.fetch.bind(app);
}

Deno.test("simple-sms-gateway: rejects missing phone", async () => {
  resetMockServer();
  const mockFetch = makeApp();

  const request = new Request(`${PROVIDER_SIMPLE}/send-sms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Hello" }),
  });

  const response = await mockFetch(request);
  assertEquals(response.status, 400, "Should return 400 for missing phone");

  const body = await response.json();
  assertEquals(body.success, false, "Response should have success: false");
  assertEquals(
    body.message?.includes("phone"),
    true,
    "Error should mention phone",
  );
});

Deno.test("simple-sms-gateway: rejects missing message", async () => {
  resetMockServer();
  const mockFetch = makeApp();

  const request = new Request(`${PROVIDER_SIMPLE}/send-sms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "+33612345678" }),
  });

  const response = await mockFetch(request);
  assertEquals(response.status, 400, "Should return 400 for missing message");

  const body = await response.json();
  assertEquals(body.success, false, "Response should have success: false");
});

Deno.test("simple-sms-gateway: returns success with sequential ID", async () => {
  resetMockServer();
  const mockFetch = makeApp();

  // First request
  let request = new Request(`${PROVIDER_SIMPLE}/send-sms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "+33612345678", message: "Hello" }),
  });

  let response = await mockFetch(request);
  assertEquals(response.status, 200, "Should return 200 for valid request");

  let body = await response.json();
  assertEquals(body.success, true, "Response should have success: true");
  assertMatch(body.id ?? body.messageId, /^mock_1$/, "First ID should be mock_1");

  // Second request
  request = new Request(`${PROVIDER_SIMPLE}/send-sms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "+33612345679", message: "Hello 2" }),
  });

  response = await mockFetch(request);
  body = await response.json();
  assertMatch(body.id ?? body.messageId, /^mock_2$/, "Second ID should be mock_2");
});

Deno.test("simple-sms-gateway: returns failure based on successRate", async () => {
  resetMockServer();
  const mockFetch = makeApp();

  // Set successRate to 0 to always fail
  const configRequest = new Request(`${BASE}/config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ global: { successRate: 0.0, failStatusCode: 500 } }),
  });

  await mockFetch(configRequest);

  // Now send SMS - should fail
  const request = new Request(`${PROVIDER_SIMPLE}/send-sms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "+33612345678", message: "Hello" }),
  });

  const response = await mockFetch(request);
  assertEquals(response.status, 500, "Should return configured failStatusCode");

  const body = await response.json();
  assertEquals(body.success, false, "Response should have success: false");
  assertEquals(body.message, "Mock gateway error", "Should return failMessage");
});

Deno.test("simple-sms-gateway: X-Campaign-Id header stored in message", async () => {
  resetMockServer();
  const mockFetch = makeApp();

  const request = new Request(`${PROVIDER_SIMPLE}/send-sms`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Campaign-Id": "550e8400-e29b-41d4-a716-446655440000",
    },
    body: JSON.stringify({ phone: "+33612345678", message: "Hello" }),
  });

  const response = await mockFetch(request);
  assertEquals(response.status, 200);

  // Verify message was stored with campaign ID
  const listRes = await mockFetch(new Request(`${BASE}/messages?full=true`, {
    method: "GET",
    headers: { "X-Mock-Token": Deno.env.get("X-Mock-Token") || "" },
  }));
  const listBody = await listRes.json();
  const msg = listBody.messages.find(
    (m: Record<string, unknown>) => m.phone === "+33612345678",
  );
  assertExists(msg, "Message should be stored");
  assertEquals(msg.campaignId, "550e8400-e29b-41d4-a716-446655440000");
});

Deno.test("smsgate: rejects unknown provider with 404", async () => {
  resetMockServer();
  const mockFetch = makeApp();

  const request = new Request(`${BASE}/unknown-provider/send-sms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "+33612345678", message: "Hello" }),
  });

  const response = await mockFetch(request);
  assertEquals(response.status, 404, "Should return 404 for unknown provider");

  const body = await response.json();
  assertEquals(body.success, false);
  assertMatch(body.message, /Unknown provider/);
});

Deno.test("smsgate: missing Basic Auth returns 401", async () => {
  resetMockServer();
  const mockFetch = makeApp();

  const request = new Request(`${PROVIDER_SMSGATE}/send-sms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      textMessage: { text: "Hello" },
      phoneNumbers: ["+33612345678"],
    }),
  });

  const response = await mockFetch(request);
  assertEquals(response.status, 401, "Should return 401 without auth");

  const body = await response.json();
  assertEquals(body.success, false);
  assertMatch(body.message, /Authorization/);
});

Deno.test("smsgate: valid Basic Auth proceeds with request", async () => {
  resetMockServer();
  const mockFetch = makeApp();

  const credentials = btoa("user:pass");
  const request = new Request(`${PROVIDER_SMSGATE}/send-sms`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${credentials}`,
    },
    body: JSON.stringify({
      textMessage: { text: "Hello from smsgate" },
      phoneNumbers: ["+33612345678"],
    }),
  });

  const response = await mockFetch(request);
  assertEquals(response.status, 200, "Should return 200 with valid auth");

  const body = await response.json();
  assertEquals(body.success, true);
  assertExists(body.id);
  assertExists(body.messageId);
});

Deno.test("smsgate: wrong body format returns 400", async () => {
  resetMockServer();
  const mockFetch = makeApp();

  const credentials = btoa("user:pass");
  const request = new Request(`${PROVIDER_SMSGATE}/send-sms`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${credentials}`,
    },
    // Missing textMessage.text and phoneNumbers
    body: JSON.stringify({ phone: "+33612345678", message: "Hello" }),
  });

  const response = await mockFetch(request);
  assertEquals(response.status, 400, "Should return 400 for wrong format");
});

Deno.test("GET /messages: returns stored messages with pagination", async () => {
  resetMockServer();
  const mockFetch = makeApp();

  // Send a few messages
  for (let i = 0; i < 5; i++) {
    await mockFetch(
      new Request(`${PROVIDER_SIMPLE}/send-sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: `+3361234567${i}`,
          message: `Message ${i}`,
        }),
      }),
    );
  }

  // Paginate
  const response = await mockFetch(
    new Request(`${BASE}/messages?limit=2&offset=1`, {
      method: "GET",
    }),
  );
  const body = await response.json();

  assertEquals(response.status, 200);
  assertEquals(body.messages.length, 2, "Should return 2 messages");
  assertEquals(body.total, 5, "Total should be 5");
  assertEquals(body.limit, 2);
  assertEquals(body.offset, 1);
});

Deno.test("GET /messages: filters by campaignId", async () => {
  resetMockServer();
  const mockFetch = makeApp();

  // Send messages with different campaign IDs
  await mockFetch(
    new Request(`${PROVIDER_SIMPLE}/send-sms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Campaign-Id": "campaign-A",
      },
      body: JSON.stringify({ phone: "+33612345678", message: "Msg A" }),
    }),
  );
  await mockFetch(
    new Request(`${PROVIDER_SIMPLE}/send-sms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Campaign-Id": "campaign-B",
      },
      body: JSON.stringify({ phone: "+33612345679", message: "Msg B" }),
    }),
  );

  const response = await mockFetch(
    new Request(`${BASE}/messages?campaignId=campaign-A`, {
      method: "GET",
    }),
  );
  const body = await response.json();

  assertEquals(body.messages.length, 1);
  assertEquals(body.messages[0].campaignId, "campaign-A");
});

Deno.test("GET /messages: filters by provider", async () => {
  resetMockServer();
  const mockFetch = makeApp();

  // simple-sms-gateway message
  await mockFetch(
    new Request(`${PROVIDER_SIMPLE}/send-sms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "+33612345678", message: "Simple" }),
    }),
  );

  // smsgate message
  const credentials = btoa("user:pass");
  await mockFetch(
    new Request(`${PROVIDER_SMSGATE}/send-sms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify({
        textMessage: { text: "SMSGate" },
        phoneNumbers: ["+33612345679"],
      }),
    }),
  );

  const response = await mockFetch(
    new Request(`${BASE}/messages?provider=smsgate`, {
      method: "GET",
    }),
  );
  const body = await response.json();

  assertEquals(body.messages.length, 1);
  assertEquals(body.messages[0].provider, "smsgate");
});

Deno.test("GET /messages: ?full=true requires valid X-Mock-Token", async () => {
  resetMockServer();
  const mockFetch = makeApp();

  // Send a message
  await mockFetch(
    new Request(`${PROVIDER_SIMPLE}/send-sms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "+33612345678", message: "Hello" }),
    }),
  );

  // Without token
  let response = await mockFetch(
    new Request(`${BASE}/messages?full=true`, {
      method: "GET",
    }),
  );
  assertEquals(response.status, 401, "Should return 401 without token");

  // With wrong token
  response = await mockFetch(
    new Request(`${BASE}/messages?full=true`, {
      method: "GET",
      headers: { "X-Mock-Token": "wrong-token" },
    }),
  );
  assertEquals(response.status, 401, "Should return 401 with wrong token");
});

Deno.test("GET /messages: default redaction masks phone and truncates body", async () => {
  resetMockServer();
  const mockFetch = makeApp();

  // Send a message with long body
  await mockFetch(
    new Request(`${PROVIDER_SIMPLE}/send-sms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: "+33612345678",
        message: "This is a very long message that exceeds fifty characters for testing truncation",
      }),
    }),
  );

  const response = await mockFetch(
    new Request(`${BASE}/messages`, {
      method: "GET",
    }),
  );
  const body = await response.json();

  assertEquals(response.status, 200);
  const msg = body.messages[0];

  // Phone should be masked
  assertMatch(msg.phone, /^\+336\*\*\*\*\*\*78$/, "Phone should be masked");
  // Body should be truncated
  assertMatch(msg.body, /^.{0,50}\.\.\.$/, "Body should be truncated to 50 chars");
});

Deno.test("DELETE /messages: clears all stored messages", async () => {
  resetMockServer();
  const mockFetch = makeApp();

  // Send a message
  await mockFetch(
    new Request(`${PROVIDER_SIMPLE}/send-sms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "+33612345678", message: "Hello" }),
    }),
  );

  // Verify message exists
  let response = await mockFetch(new Request(`${BASE}/messages`, { method: "GET" }));
  let body = await response.json();
  assertEquals(body.total, 1, "Should have 1 message before delete");

  // Delete
  response = await mockFetch(new Request(`${BASE}/messages`, { method: "DELETE" }));
  assertEquals(response.status, 200);

  // Verify messages are gone
  response = await mockFetch(new Request(`${BASE}/messages`, { method: "GET" }));
  body = await response.json();
  assertEquals(body.total, 0, "Should have 0 messages after delete");
});

Deno.test("POST /config: per-provider override changes behavior", async () => {
  resetMockServer();
  const mockFetch = makeApp();

  // Set smsgate to always fail
  await mockFetch(
    new Request(`${BASE}/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providers: {
          smsgate: { successRate: 0, failStatusCode: 429, failMessage: "SMSGate overloaded" },
        },
      }),
    }),
  );

  const credentials = btoa("user:pass");
  const response = await mockFetch(
    new Request(`${PROVIDER_SMSGATE}/send-sms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify({
        textMessage: { text: "Hello" },
        phoneNumbers: ["+33612345678"],
      }),
    }),
  );

  assertEquals(response.status, 429, "Should use provider override failStatusCode");
  const body = await response.json();
  assertEquals(body.message, "SMSGate overloaded");
});

Deno.test("POST /config: global config update", async () => {
  resetMockServer();
  const mockFetch = makeApp();

  const request = new Request(`${BASE}/config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ global: { successRate: 0.5, delayMs: 100 } }),
  });

  const response = await mockFetch(request);
  assertEquals(response.status, 200, "Should return 200 for valid config");

  const body = await response.json();
  assertEquals(body.success, true);
  assertEquals(body.config.global.successRate, 0.5);
  assertEquals(body.config.global.delayMs, 100);
});

Deno.test("resets counter via resetMockServer()", async () => {
  // First, send some messages to increment counter
  {
    const mockFetch = makeApp();

    const request = new Request(`${PROVIDER_SIMPLE}/send-sms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "+33612345678", message: "Hello" }),
    });

    await mockFetch(request);
    await mockFetch(request);
  }

  // Now reset and verify counter starts from 1 again
  resetMockServer();

  const mockFetch = makeApp();

  const request = new Request(`${PROVIDER_SIMPLE}/send-sms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "+33612345678", message: "Hello" }),
  });

  const response = await mockFetch(request);
  const body = await response.json();
  assertMatch(
    body.id ?? body.messageId,
    /^mock_1$/,
    "After reset, ID should be mock_1 again",
  );
});

Deno.test("GET /health returns status, config, and stats", async () => {
  resetMockServer();
  const mockFetch = makeApp();

  const request = new Request(`${BASE}/health`, {
    method: "GET",
  });

  const response = await mockFetch(request);
  assertEquals(response.status, 200, "Should return 200");

  const body = await response.json();
  assertEquals(body.status, "ok", "Should have status: ok");
  assertEquals(body.service, "sms-gateway-mock", "Should have service name");
  assertExists(body.config, "Should include config");
  assertExists(body.stats, "Should include stats");
  assertEquals(typeof body.stats.totalMessages, "number");
  assertEquals(typeof body.stats.campaignsTracked, "number");
});

Deno.test("handles delayMs configuration", async () => {
  resetMockServer();
  const mockFetch = makeApp();

  // Set a 50ms delay
  const configRequest = new Request(`${BASE}/config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ global: { delayMs: 50 } }),
  });

  await mockFetch(configRequest);

  // Send SMS and measure time
  const start = Date.now();
  const request = new Request(`${PROVIDER_SIMPLE}/send-sms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "+33612345678", message: "Hello" }),
  });

  await mockFetch(request);
  const elapsed = Date.now() - start;

  assertEquals(
    elapsed >= 50,
    true,
    `Should delay at least 50ms (was ${elapsed}ms)`,
  );
});

Deno.test("resetMockServer() clears message store", async () => {
  // Send a message
  {
    const mockFetch = makeApp();
    await mockFetch(
      new Request(`${PROVIDER_SIMPLE}/send-sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "+33612345678", message: "Hello" }),
      }),
    );
  }

  // Verify message exists
  let mockFetch = makeApp();
  let response = await mockFetch(new Request(`${BASE}/messages`, { method: "GET" }));
  let body = await response.json();
  assertEquals(body.total, 1);

  // Reset
  resetMockServer();

  // Verify messages are cleared
  mockFetch = makeApp();
  response = await mockFetch(new Request(`${BASE}/messages`, { method: "GET" }));
  body = await response.json();
  assertEquals(body.total, 0, "Message store should be empty after reset");
});