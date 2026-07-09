import { createLogger } from "../../_shared/logger.ts";

const logger = createLogger("sms-campaigns.shortenUrl");

export async function shortenUrl(longUrl: string): Promise<string | null> {
  const start = Date.now();
  logger.info("shortenUrl start", { url: longUrl });
  try {
    const url = new URL("https://is.gd/create.php");
    url.searchParams.set("format", "simple");
    url.searchParams.set("url", longUrl);

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      logger.warn("shortenUrl non-ok response", {
        url: longUrl,
        status: response.status,
        elapsedMs: Date.now() - start,
      });
      return null;
    }

    const shortUrl = await response.text();

    if (shortUrl.startsWith("Error:")) {
      logger.warn("shortenUrl returned error payload", {
        url: longUrl,
        shortUrl,
        elapsedMs: Date.now() - start,
      });
      return null;
    }

    const trimmed = shortUrl.trim();
    logger.info("shortenUrl done", {
      url: longUrl,
      shortUrl: trimmed,
      elapsedMs: Date.now() - start,
    });
    return trimmed;
  } catch (error) {
    logger.error("shortenUrl failed", {
      url: longUrl,
      error: error instanceof Error ? error.message : String(error),
      elapsedMs: Date.now() - start,
    });
    return null;
  }
}
