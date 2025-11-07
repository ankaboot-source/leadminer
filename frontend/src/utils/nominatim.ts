import type { NormalizedLocation } from "~/types/contact";

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

export async function normalizeLocation(
  location: string,
): Promise<NormalizedLocation> {
  try {
    const params = new URLSearchParams({
      q: location,
      addressdetails: '1',
      limit: '1',
      format: 'jsonv2',
    });

    const response = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
      headers: {
        'Accept-Language': 'en', // language can be configured,
        // "User-Agent": "leadminer",
      },
    });
    const result = (await response.json())?.[0];

    const normalized: NormalizedLocation = result
      ? {
          lat: result.lat,
          lon: result.lon,
          display_name: result.display_name,
          address: result.address,
        }
      : {};

    console.log(`Normalized:`, normalized);
    return normalized;
  } catch {
    return {};
  }
}
