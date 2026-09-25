import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import passiveMiningFailureEmail from "./template.ts";

Deno.test("renders the English notification with an encoded reconnect CTA", () => {
  const result = passiveMiningFailureEmail("user+test@example.com", "en");

  assertEquals(
    result.subject,
    "Action required: refresh credentials to continue mining",
  );
  assertStringIncludes(
    result.html,
    "Reconnect to keep continuous mining running.",
  );
  assertStringIncludes(result.html, "user+test@example.com");
  assertStringIncludes(
    result.html,
    "/sources?reconnect=user%2Btest%40example.com",
  );
  assertStringIncludes(result.html, "Reconnect source");
  assert(!result.html.toLowerCase().includes("leadminer"));
  assert(!result.html.includes("LOGO_URL"));
  assert(!result.html.includes("invalid_grant"));
});

Deno.test("renders the French notification with the same CTA", () => {
  const result = passiveMiningFailureEmail("user@example.com", "fr");

  assertEquals(
    result.subject,
    "Action requise : actualisez vos identifiants pour continuer l’extraction",
  );
  assertStringIncludes(
    result.html,
    "Reconnectez la source pour poursuivre l’extraction continue.",
  );
  assertStringIncludes(result.html, "Bonjour");
  assertStringIncludes(result.html, "Reconnecter la source");
  assertStringIncludes(result.html, "/sources?reconnect=user%40example.com");
});

Deno.test("renders a username-based IMAP identifier", () => {
  const result = passiveMiningFailureEmail("imap-user", "en");

  assertStringIncludes(result.html, "imap-user");
  assertStringIncludes(result.html, "/sources?reconnect=imap-user");
});

Deno.test("escapes source text before inserting it into HTML", () => {
  const result = passiveMiningFailureEmail("user&<unsafe>@example.com", "en");

  assertStringIncludes(result.html, "user&amp;&lt;unsafe&gt;@example.com");
  assert(!result.html.includes("user&<unsafe>@example.com"));
});
