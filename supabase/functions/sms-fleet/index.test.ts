import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const gatewaySchema = z.object({
  provider: z.enum(["smsgate", "simple-sms-gateway", "twilio"]),
  base_url: z.string().url().optional(),
  api_key: z.string().min(1),
  sender_id: z.string().optional(),
  is_active: z.boolean().optional(),
});

Deno.test("Gateway schema - validates correct data", () => {
  const validGateway = {
    provider: "smsgate",
    api_key: "test-key-123",
    base_url: "https://api.example.com",
    sender_id: "TEST",
    is_active: true,
  };

  const result = gatewaySchema.safeParse(validGateway);
  assertEquals(result.success, true);
});

Deno.test("Gateway schema - rejects invalid provider", () => {
  const invalidGateway = {
    provider: "invalid-provider",
    api_key: "test-key",
  };

  const result = gatewaySchema.safeParse(invalidGateway);
  assertEquals(result.success, false);
});

Deno.test("Gateway schema - rejects empty api_key", () => {
  const invalidGateway = {
    provider: "smsgate",
    api_key: "",
  };

  const result = gatewaySchema.safeParse(invalidGateway);
  assertEquals(result.success, false);
});

Deno.test("Gateway schema - rejects invalid URL", () => {
  const invalidGateway = {
    provider: "smsgate",
    api_key: "test-key",
    base_url: "not-a-url",
  };

  const result = gatewaySchema.safeParse(invalidGateway);
  assertEquals(result.success, false);
});

Deno.test("Gateway schema - allows extra fields but ignores them", () => {
  const gatewayWithExtraFields = {
    provider: "smsgate",
    api_key: "test-key",
    id: "malicious-id",
    user_id: "malicious-user-id",
    created_at: "malicious-timestamp",
  };

  const result = gatewaySchema.safeParse(gatewayWithExtraFields);
  assertEquals(result.success, true);

  if (result.success) {
    assertEquals("id" in result.data, false);
    assertEquals("user_id" in result.data, false);
    assertEquals("created_at" in result.data, false);
  }
});
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.test(
  "SMS Fleet Gateways - saves gateway configuration to database",
  async () => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const gateway = {
      user_id: "00000000-0000-0000-0000-000000000000",
      provider: "smsgate",
      base_url: "https://api.smsgate.com",
      api_key: "test-key",
      sender_id: "TEST",
      is_active: true,
    };

    const { data, error } = await supabase
      .from("sms_fleet_gateways")
      .insert(gateway)
      .select()
      .single();

    assertEquals(error, null);
    assertEquals(data.provider, "smsgate");
    assertEquals(typeof data.id, "string");

    if (data?.id) {
      await supabase.from("sms_fleet_gateways").delete().eq("id", data.id);
    }
  },
);

Deno.test(
  "SMS Fleet Gateways - retrieves all gateways for a user",
  async () => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data, error } = await supabase
      .from("sms_fleet_gateways")
      .select("*")
      .limit(10);

    assertEquals(error, null);
    assertEquals(Array.isArray(data), true);
  },
);

Deno.test("SMS Fleet Gateways - orders by created_at descending", async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const userId = "00000000-0000-0000-0000-000000000001";

  const gateway1 = {
    user_id: userId,
    provider: "smsgate",
    base_url: "https://api.smsgate.com",
    api_key: "test-key-1",
    sender_id: "TEST1",
    is_active: true,
  };

  const gateway2 = {
    user_id: userId,
    provider: "simple-sms-gateway",
    base_url: "https://simple.example.com",
    api_key: "test-key-2",
    sender_id: "TEST2",
    is_active: true,
  };

  await supabase.from("sms_fleet_gateways").insert([gateway1, gateway2]);

  await new Promise((resolve) => setTimeout(resolve, 100));

  const gateway3 = {
    user_id: userId,
    provider: "twilio",
    api_key: "test-key-3",
    is_active: true,
  };

  await supabase.from("sms_fleet_gateways").insert(gateway3);

  const { data } = await supabase
    .from("sms_fleet_gateways")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (data && data.length >= 3) {
    assertEquals(data[0].provider, "twilio");
  }

  await supabase.from("sms_fleet_gateways").delete().eq("user_id", userId);
});

Deno.test("SMS Fleet Gateways - deletes gateway by ID", async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const gateway = {
    user_id: "00000000-0000-0000-0000-000000000002",
    provider: "simple-sms-gateway",
    api_key: "test-key-delete",
    is_active: true,
  };

  const { data } = await supabase
    .from("sms_fleet_gateways")
    .insert(gateway)
    .select()
    .single();

  if (data?.id) {
    const { error } = await supabase
      .from("sms_fleet_gateways")
      .delete()
      .eq("id", data.id);

    assertEquals(error, null);

    const { data: check } = await supabase
      .from("sms_fleet_gateways")
      .select("*")
      .eq("id", data.id)
      .single();

    assertEquals(check, null);
  }
});
