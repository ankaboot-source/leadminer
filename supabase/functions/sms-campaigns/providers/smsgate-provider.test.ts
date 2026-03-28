import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createSmsProvider, type SmsGateCredentials } from "./mod.ts";

Deno.test("createSmsProvider creates smsgate provider", () => {
  const provider = createSmsProvider("smsgate", {
    smsgate: {
      baseUrl: "https://gateway.example.com/messages",
      username: "demo-user",
      password: "demo-pass",
    },
  });

  assertEquals(provider.name, "smsgate");
});

Deno.test("smsgate provider requires baseUrl", () => {
  const credentials: SmsGateCredentials = {
    baseUrl: "",
    username: "demo-user",
    password: "demo-pass",
  };

  assertThrows(() => {
    createSmsProvider("smsgate", {
      smsgate: credentials,
    });
  });
});
