export async function shortenUrl(longUrl: string): Promise<string | null> {
  try {
    const url = new URL("https://is.gd/create.php");
    url.searchParams.set("format", "simple");
    url.searchParams.set("url", longUrl);

    const response = await fetch(url.toString());

    if (!response.ok) {
      return null;
    }

    const shortUrl = await response.text();

    if (shortUrl.startsWith("Error:")) {
      return null;
    }

    return shortUrl.trim();
  } catch {
    return null;
  }
}