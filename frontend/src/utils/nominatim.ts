import type { NormalizedLocation } from '~/types/contact';

const MAP_URL = 'https://www.openstreetmap.org';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function normalizeLocation(
  location: string,
  language = 'en',
): Promise<NormalizedLocation> {
  try {
    const { NOMINATIM_URL } = useRuntimeConfig().public;
    const params = new URLSearchParams({
      q: location,
      addressdetails: '1',
      limit: '1',
      format: 'jsonv2',
    });

    const response = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
      headers: {
        'Accept-Language': language, // Language of results
      },
    });
    const result = (await response.json())?.[0];

    const normalized: NormalizedLocation = result
      ? {
          osm_type: result.osm_type,
          osm_id: result.osm_id,
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
  language = 'en',
): Promise<NormalizedLocation[]> {
  const results: NormalizedLocation[] = [];
  const total = locations.length;
  let progress = 0;

  for (const location of locations) {
    console.log(`Normalizing location ${++progress}/${total}: ${location}`);

    const normalized = await normalizeLocation(location, language);

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
  const { error } = await $supabase
    // @ts-expect-error: Issue with nuxt/supabase
    .schema('private')
    .from('persons')
    .update({ location_normalized })
    .match({ location });

  if (error) {
    throw error;
  }
}

export function getLocationUrl(location: NormalizedLocation) {
  if (location.osm_type && location.osm_id) {
    const url = `${MAP_URL}/${location.osm_type}/${location.osm_id}`;
    return url;
  }

  if (location.lat && location.lon) {
    const url = new URL(`${MAP_URL}/search`);
    url.searchParams.set('lat', location.lat);
    url.searchParams.set('lon', location.lon);
    return url.toString();
  }
}
