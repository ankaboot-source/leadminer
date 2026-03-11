interface CampaignRequest {
  userId: string;
  units: number;
  partialCampaign?: boolean;
}

function validateCampaignRequest(payload: unknown): payload is CampaignRequest {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  const { userId, units, partialCampaign } = payload as CampaignRequest;

  if (typeof userId !== "string" || !userId.trim()) {
    return false;
  }

  if (!Number.isInteger(units) || units <= 0) {
    return false;
  }

  return partialCampaign === undefined || typeof partialCampaign === "boolean";
}

Deno.test({
  name: "validateCampaignRequest - should return true for valid payload",
  fn() {
    const validPayload = { userId: "user-123", units: 10 };
    const result = validateCampaignRequest(validPayload);
    if (result !== true) throw new Error("Expected true");
  },
});

Deno.test({
  name: "validateCampaignRequest - should return true for valid payload with partialCampaign",
  fn() {
    const validPayload = { userId: "user-123", units: 10, partialCampaign: true };
    const result = validateCampaignRequest(validPayload);
    if (result !== true) throw new Error("Expected true");
  },
});

Deno.test({
  name: "validateCampaignRequest - should return false for missing userId",
  fn() {
    const invalidPayload = { units: 10 };
    const result = validateCampaignRequest(invalidPayload);
    if (result !== false) throw new Error("Expected false");
  },
});

Deno.test({
  name: "validateCampaignRequest - should return false for empty userId",
  fn() {
    const invalidPayload = { userId: "   ", units: 10 };
    const result = validateCampaignRequest(invalidPayload);
    if (result !== false) throw new Error("Expected false");
  },
});

Deno.test({
  name: "validateCampaignRequest - should return false for non-string userId",
  fn() {
    const invalidPayload = { userId: 123, units: 10 };
    const result = validateCampaignRequest(invalidPayload);
    if (result !== false) throw new Error("Expected false");
  },
});

Deno.test({
  name: "validateCampaignRequest - should return false for zero units",
  fn() {
    const invalidPayload = { userId: "user-123", units: 0 };
    const result = validateCampaignRequest(invalidPayload);
    if (result !== false) throw new Error("Expected false");
  },
});

Deno.test({
  name: "validateCampaignRequest - should return false for negative units",
  fn() {
    const invalidPayload = { userId: "user-123", units: -5 };
    const result = validateCampaignRequest(invalidPayload);
    if (result !== false) throw new Error("Expected false");
  },
});

Deno.test({
  name: "validateCampaignRequest - should return false for non-integer units",
  fn() {
    const invalidPayload = { userId: "user-123", units: 5.5 };
    const result = validateCampaignRequest(invalidPayload);
    if (result !== false) throw new Error("Expected false");
  },
});

Deno.test({
  name: "validateCampaignRequest - should return false for invalid partialCampaign type",
  fn() {
    const invalidPayload = { userId: "user-123", units: 10, partialCampaign: "true" };
    const result = validateCampaignRequest(invalidPayload);
    if (result !== false) throw new Error("Expected false");
  },
});

Deno.test({
  name: "validateCampaignRequest - should return false for null payload",
  fn() {
    const result = validateCampaignRequest(null);
    if (result !== false) throw new Error("Expected false");
  },
});

Deno.test({
  name: "validateCampaignRequest - should return false for undefined payload",
  fn() {
    const result = validateCampaignRequest();
    if (result !== false) throw new Error("Expected false");
  },
});

Deno.test({
  name: "validateCampaignRequest - should return false for array payload",
  fn() {
    const result = validateCampaignRequest([{ userId: "user-123", units: 10 }]);
    if (result !== false) throw new Error("Expected false");
  },
});

Deno.test({
  name: "validateCampaignRequest - should return false for string payload",
  fn() {
    const result = validateCampaignRequest("userId=123&units=10");
    if (result !== false) throw new Error("Expected false");
  },
});
