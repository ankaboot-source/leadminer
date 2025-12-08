import type { NormalizedLocation } from '~/types/contact';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

class LocationNormalizer {
  private queue = new Set<string>();
  private processing = false;
  private language: string;

  constructor(language = 'en') {
    this.language = language;
  }

  setLang(language: string) {
    this.language = language;
  }

  // Add a single location or multiple locations
  add(locationOrArray: string | string[]) {
    const locations = Array.isArray(locationOrArray)
      ? locationOrArray
      : [locationOrArray];

    for (const loc of locations) {
      if (!this.queue.has(loc)) {
        this.queue.add(loc);
      }
    }

    this.processQueue();
  }

  private async processQueue() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.size > 0) {
      // Get the first item in the set
      const [location] = this.queue;
      if (!location) break;
      this.queue.delete(location);

      console.log(
        `Normalizing location: ${location}, queue size: ${this.queue.size}`,
      );

      const normalized = await this.normalizeLocation(location);
      await updateNormalizedLocationInDB(location, normalized);

      await delay(1000); // 1 request per second
    }

    this.processing = false;
  }

  async normalizeLocation(location: string): Promise<NormalizedLocation> {
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
          'Accept-Language': this.language, // Language of results
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
}

const normalizer = new LocationNormalizer();
export default normalizer;
