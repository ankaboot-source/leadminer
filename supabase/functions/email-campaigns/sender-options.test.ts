import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  getSenderCredentialIssue,
  listUniqueSenderSources,
} from "./sender-options.ts";

Deno.test("listUniqueSenderSources keeps distinct sender emails", () => {
  const sources = [
    { email: "bader.lejmi@gmail.com", type: "google", credentials: {} },
    { email: "sales@acme.io", type: "imap", credentials: {} },
    { email: "BADER.LEJMI@gmail.com", type: "google", credentials: {} },
  ];

  const result = listUniqueSenderSources(sources);
  assertEquals(result.length, 2);
  assertEquals(result[0].email, "bader.lejmi@gmail.com");
  assertEquals(result[1].email, "sales@acme.io");
});

Deno.test("getSenderCredentialIssue flags expired OAuth token", () => {
  const issue = getSenderCredentialIssue(
    {
      email: "bader.lejmi@gmail.com",
      type: "google",
      credentials: { expiresAt: 1000 },
    },
    2000,
  );

  assertEquals(issue, "OAuth token expired. Reconnect this source.");
});
