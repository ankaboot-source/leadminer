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
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createMockServer, resetMockServer } from "./index.ts";

Deno.test("rejects missing phone", async () => {
  resetMockServer();

  const app = createMockServer();
  const mockFetch = app.fetch;

  const request = new Request("http://localhost:8000/send-sms", {
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

Deno.test("rejects missing message", async () => {
  resetMockServer();

  const app = createMockServer();
  const mockFetch = app.fetch;

  const request = new Request("http://localhost:8000/send-sms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "+33612345678" }),
  });

  const response = await mockFetch(request);
  assertEquals(response.status, 400, "Should return 400 for missing message");

  const body = await response.json();
  assertEquals(body.success, false, "Response should have success: false");
});

Deno.test("returns success with sequential ID", async () => {
  resetMockServer();

  const app = createMockServer();
  const mockFetch = app.fetch;

  // First request
  let request = new Request("http://localhost:8000/send-sms", {
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
  request = new Request("http://localhost:8000/send-sms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "+33612345679", message: "Hello 2" }),
  });

  response = await mockFetch(request);
  body = await response.json();
  assertMatch(body.id ?? body.messageId, /^mock_2$/, "Second ID should be mock_2");
});

Deno.test("returns failure based on successRate", async () => {
  resetMockServer();

  const app = createMockServer();
  const mockFetch = app.fetch;

  // Set successRate to 0 to always fail
  const configRequest = new Request("http://localhost:8000/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ successRate: 0.0, failStatusCode: 500 }),
  });

  await mockFetch(configRequest);

  // Now send SMS - should fail
  const request = new Request("http://localhost:8000/send-sms", {
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

Deno.test("updates config via POST /config", async () => {
  resetMockServer();

  const app = createMockServer();
  const mockFetch = app.fetch;

  // Update config
  const request = new Request("http://localhost:8000/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ successRate: 0.5, delayMs: 100 }),
  });

  const response = await mockFetch(request);
  assertEquals(response.status, 200, "Should return 200 for valid config");

  const body = await response.json();
  assertEquals(body.success, true, "Response should have success: true");
  assertEquals(body.config.successRate, 0.5, "Should update successRate");
  assertEquals(body.config.delayMs, 100, "Should update delayMs");
});

Deno.test("resets counter via resetMockServer()", async () => {
  // First, send some messages to increment counter
  {
    const app = createMockServer();
    const mockFetch = app.fetch;

    const request = new Request("http://localhost:8000/send-sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "+33612345678", message: "Hello" }),
    });

    await mockFetch(request);
    await mockFetch(request);
  }

  // Now reset and verify counter starts from 1 again
  resetMockServer();

  const app = createMockServer();
  const mockFetch = app.fetch;

  const request = new Request("http://localhost:8000/send-sms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "+33612345678", message: "Hello" }),
  });

  const response = await mockFetch(request);
  const body = await response.json();
  assertMatch(body.id ?? body.messageId, /^mock_1$/, "After reset, ID should be mock_1 again");
});

Deno.test("GET /health returns status and config", async () => {
  resetMockServer();

  const app = createMockServer();
  const mockFetch = app.fetch;

  const request = new Request("http://localhost:8000/health", {
    method: "GET",
  });

  const response = await mockFetch(request);
  assertEquals(response.status, 200, "Should return 200");

  const body = await response.json();
  assertEquals(body.status, "ok", "Should have status: ok");
  assertEquals(body.service, "sms-gateway-mock", "Should have service name");
  assertExists(body.config, "Should include config");
  assertEquals(typeof body.config.successRate, "number", "Config should have successRate");
});

Deno.test("handles delayMs configuration", async () => {
  resetMockServer();

  const app = createMockServer();
  const mockFetch = app.fetch;

  // Set a 50ms delay
  const configRequest = new Request("http://localhost:8000/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ delayMs: 50 }),
  });

  await mockFetch(configRequest);

  // Send SMS and measure time
  const start = Date.now();
  const request = new Request("http://localhost:8000/send-sms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "+33612345678", message: "Hello" }),
  });

  await mockFetch(request);
  const elapsed = Date.now() - start;

  assertEquals(elapsed >= 50, true, `Should delay at least 50ms (was ${elapsed}ms)`);
});