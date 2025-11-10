import type { NormalizedLocation } from "~/types/contact";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function normalizeLocation(
  location: string,
): Promise<NormalizedLocation> {
  try {
    const params = new URLSearchParams({
      q: location,
      addressdetails: "1",
      limit: "1",
      format: "jsonv2",
    });

    const response = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
      headers: {
        "Accept-Language": "en", // language can be configured,
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

    return normalized;
  } catch {
    return {};
  }
}

/**
 * Normalize an array of locations sequentially (1 request per second)
 */
export async function normalizeLocations(
  locations: string[],
): Promise<NormalizedLocation[]> {
  const results: NormalizedLocation[] = [];
  const total = locations.length;
  let progress = 0;

  for (const location of locations) {
    console.log(`Normalizing location ${++progress}/${total}: ${location}`);

    const normalized = await normalizeLocation(location);

    await updateNormalizedLocationInDB(location, normalized);
    results.push(normalized);

    if (progress < total) await delay(1000);
  }

  return results;
}

async function updateNormalizedLocationInDB(
  location: string,
  location_normalized: NormalizedLocation,
) {
  const $supabase = useSupabaseClient();
  const { data, error } = await $supabase
    // @ts-expect-error: Issue with nuxt/supabase
    .schema("private")
    .from("persons")
    .update({ location_normalized })
    .match({ location });

  if (error) {
    throw error;
  }

  console.log("Updated DB for location:", location, { data, error });
}
