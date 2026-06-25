import { createLogger, Logger } from "../../_shared/logger.ts";

// --- Types (matching backend/src/services/enrichment/Engine.ts) ---

export interface Person {
  url: string;
  email: string;
  name?: string;
  image?: string;
  job_title?: string;
  given_name?: string;
  family_name?: string;
  works_for?: string;
  alternate_name?: string[];
  location?: string;
  same_as?: string[];
  identifiers: string[];
}

export interface EngineResult {
  person_id?: string;
  email: string;
  name?: string;
  image?: string;
  location?: string;
  jobTitle?: string;
  organization?: string;
  givenName?: string;
  familyName?: string;
  sameAs?: string[];
  identifiers?: string[];
  alternateName?: string[];
}

export interface EngineResponse {
  token?: string;
  engine: string;
  raw_data: unknown[];
  data: EngineResult[];
}

// --- Helpers (matching backend/src/utils/helpers/validation.ts) ---

function undefinedIfEmpty<T>(array: T[]): T[] | undefined {
  const filteredArray = array.filter((val): val is T => Boolean(val));
  return filteredArray.length > 0 ? filteredArray : undefined;
}

function undefinedIfFalsy<T>(value: T): T | undefined {
  return value || undefined;
}

// --- Logger ---

const logger = createLogger("enrich-engines");

// --- EnrichLayer Engine ---

interface EnrichLayerProfileExtra {
  github_profile_id?: string;
  facebook_profile_id?: string;
  twitter_profile_id?: string;
  website?: string;
}

interface EnrichLayerExperience {
  company: string;
  title: string;
}

interface EnrichLayerProfile {
  city: string;
  full_name: string;
  first_name: string;
  last_name: string;
  state: string;
  country: string;
  country_full_name: string;
  occupation: string;
  profile_pic_url: string;
  public_identifier: string;
  extra: EnrichLayerProfileExtra;
  experiences: EnrichLayerExperience[];
}

interface EnrichLayerResponse {
  email: string;
  profile: EnrichLayerProfile;
  linkedin_profile_url: string;
  facebook_profile_url: string;
  twitter_profile_url: string;
}

function getProfileUrls(
  profile: EnrichLayerProfileExtra | undefined,
): string[] {
  const urls: string[] = [];

  if (profile?.github_profile_id) {
    urls.push(`https://github.com/${profile.github_profile_id}`);
  }
  if (profile?.facebook_profile_id) {
    urls.push(`https://facebook.com/${profile.facebook_profile_id}`);
  }
  if (profile?.twitter_profile_id) {
    urls.push(`https://twitter.com/${profile.twitter_profile_id}`);
  }
  if (profile?.website) {
    urls.push(profile.website);
  }

  return urls;
}

function parseEnrichLayerResponse(
  response: EnrichLayerResponse,
): EngineResult | null {
  const mapped = {
    name: undefinedIfFalsy(response?.profile?.full_name ?? ""),
    givenName: undefinedIfFalsy(response?.profile?.first_name ?? ""),
    familyName: undefinedIfFalsy(response?.profile?.last_name ?? ""),
    jobTitle: undefinedIfFalsy(response?.profile?.occupation ?? ""),
    organization: undefinedIfFalsy(
      response?.profile?.experiences?.[0]?.company ?? "",
    ),
    image: undefinedIfFalsy(response?.profile?.profile_pic_url ?? ""),
    identifiers: undefinedIfEmpty(
      [response?.profile?.public_identifier].filter((id): id is string =>
        Boolean(id),
      ),
    ),
    location: undefinedIfFalsy(
      [
        response?.profile?.city,
        response?.profile?.state,
        response?.profile?.country_full_name,
      ]
        .filter((loc): loc is string => Boolean(loc))
        .join(", "),
    ),
    sameAs: undefinedIfEmpty([
      response?.linkedin_profile_url,
      response?.facebook_profile_url,
      response?.twitter_profile_url,
      ...getProfileUrls(response?.profile?.extra),
    ]),
  };

  // Filter out if all values are empty
  const hasData = Object.values(mapped).some(
    (field) =>
      field !== undefined && !(Array.isArray(field) && field.length === 0),
  );

  return hasData ? { email: response.email, ...mapped } : null;
}

/**
 * EnrichLayer: reverse email lookup via API
 * Uses POST /api/v2/profile/resolve/email with query params
 */
export async function enrichLayerLookup(
  email: string,
): Promise<EngineResponse> {
  const url = Deno.env.get("ENRICHLAYER_URL");
  const apiKey = Deno.env.get("ENRICHLAYER_API_KEY");

  if (!url || !apiKey) {
    throw new Error("ENRICHLAYER_URL and ENRICHLAYER_API_KEY must be set");
  }

  logger.debug("EnrichLayer lookup request", { email });

  const params = new URLSearchParams({
    email,
    lookup_depth: "superficial",
    enrich_profile: "enrich",
  });

  const response = await fetch(
    `${url}/api/v2/profile/resolve/email?${params}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`EnrichLayer API error: ${response.status} - ${errorText}`);
  }

  const data: EnrichLayerResponse = await response.json();
  // EnrichLayer returns the response without email in body, add it
  const enrichedData = { ...data, email };

  logger.debug("EnrichLayer lookup response", {
    email,
    hasProfile: Boolean(data.profile),
  });

  const parsed = parseEnrichLayerResponse(enrichedData);
  return {
    engine: "enrichLayer",
    data: parsed ? [parsed] : [],
    raw_data: [enrichedData],
  };
}

// --- TheDig Engine ---

interface TheDigPersonRequest {
  url?: string;
  name?: string;
  email: string;
  familyName?: string;
  givenName?: string;
  image?: string[];
  sameAs?: string[];
  jobTitle?: string[];
  worksFor?: string[];
  identifier?: string[];
  homeLocation?: string;
  workLocation?: string;
  alternateName?: string[];
}

interface TheDigPersonResponse {
  email: string;
  name: string;
  givenName: string;
  familyName?: string;
  alternateName?: string[];
  image?: string[];
  jobTitle?: string[];
  worksFor?: string[];
  homeLocation?: string;
  workLocation?: string;
  sameAs?: string[];
  identifier?: string[];
  statusCode: number;
  error_msg?: string;
}

function mapPersonForTheDig(person: Partial<Person>): TheDigPersonRequest {
  let personMapped: TheDigPersonRequest = {
    email: person.email as string,
    name: person.name as string,
    homeLocation: person.location,
    alternateName: person.alternate_name,
    familyName: person.family_name,
    givenName: person.given_name,
    identifier: person.identifiers,
    image: person.image ? [person.image] : undefined,
    jobTitle: person.job_title ? [person.job_title] : undefined,
    sameAs: person.same_as,
    url: person.url,
    workLocation: person.location,
    worksFor: person.works_for ? [person.works_for] : undefined,
  };

  personMapped = Object.fromEntries(
    Object.entries(personMapped).filter(([, value]) => Boolean(value)),
  ) as TheDigPersonRequest;
  return personMapped;
}

function parseTheDigResponse(
  response: TheDigPersonResponse,
): EngineResult | null {
  const result: EngineResult = {
    email: response.email,
    name: undefinedIfFalsy(response.name),
    givenName: undefinedIfFalsy(response.givenName),
    familyName: undefinedIfFalsy(response.familyName),
    image: undefinedIfFalsy(response.image?.[0]),
    jobTitle: undefinedIfFalsy(response.jobTitle?.[0]),
    organization: undefinedIfFalsy(response.worksFor?.[0]),
    sameAs: undefinedIfEmpty(response.sameAs ?? []),
    identifiers: undefinedIfEmpty(response.identifier ?? []),
    alternateName: undefinedIfEmpty(response.alternateName ?? []),
    location: undefinedIfFalsy(
      [response.homeLocation, response.workLocation]
        .flat()
        .filter(Boolean)
        .join(", "),
    ),
  };

  // Check if at least one field has data
  const {
    givenName,
    familyName,
    sameAs,
    organization,
    jobTitle,
    location,
    alternateName,
    image,
  } = result;

  const hasData = ![
    givenName,
    familyName,
    sameAs,
    organization,
    jobTitle,
    location,
    alternateName,
    image,
  ].every((field) => !field || field.length === 0);

  return hasData ? result : null;
}

/**
 * TheDig: enrich person via API
 * Uses POST /person/ with person object
 */
export async function thedigEnrich(
  person: Partial<Person>,
): Promise<EngineResponse> {
  const url = Deno.env.get("THEDIG_URL");
  const apiKey = Deno.env.get("THEDIG_API_KEY");

  if (!url || !apiKey) {
    throw new Error("THEDIG_URL and THEDIG_API_KEY must be set");
  }

  logger.debug("TheDig enrich request", { email: person.email });

  const personMapped = mapPersonForTheDig(person);

  const response = await fetch(`${url}/person/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify(personMapped),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`TheDig API error: ${response.status} - ${errorText}`);
  }

  const data: TheDigPersonResponse = await response.json();
  const statusCode = data.statusCode ?? response.status;

  logger.debug("TheDig enrich response", {
    email: person.email,
    statusCode,
  });

  // Handle 203 No Content (no enrichment data available)
  if (statusCode === 203 && !data.sameAs?.length) {
    return {
      engine: "thedig",
      data: [],
      raw_data: [data],
    };
  }

  const parsed = parseTheDigResponse(data);
  return {
    engine: "thedig",
    data: parsed ? [parsed] : [],
    raw_data: [data],
  };
}

// --- Voilanorbert Engine ---

interface VoilanorbertResponse {
  status: string;
  success: boolean;
  token: string;
}

/**
 * Voilanorbert: async enrichment via webhook
 * Uses POST /enrich/upload with form-encoded data
 * Returns token; actual results come via webhook
 */
export async function voilanorbertEnrichAsync(
  emails: string[],
  webhook: string,
): Promise<EngineResponse> {
  const url = Deno.env.get("VOILANORBERT_URL");
  const apiKey = Deno.env.get("VOILANORBERT_API_KEY");
  const username = Deno.env.get("VOILANORBERT_USERNAME");

  if (!url || !apiKey || !username) {
    throw new Error(
      "VOILANORBERT_URL, VOILANORBERT_API_KEY, and VOILANORBERT_USERNAME must be set",
    );
  }

  logger.debug("Voilanorbert enrich request", { emailCount: emails.length });

  // Form-encoded body: data=email1\nemail2&webhook=...
  const formData = new URLSearchParams();
  formData.append("data", emails.join("\n"));
  formData.append("webhook", webhook);

  // Basic auth: username:password (password is the API key)
  const authHeader = btoa(`${username}:${apiKey}`);

  const response = await fetch(`${url}/enrich/upload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${authHeader}`,
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Voilanorbert API error: ${response.status} - ${errorText}`,
    );
  }

  const data: VoilanorbertResponse = await response.json();

  if (!data.success) {
    throw new Error("Failed to upload emails to enrichment.");
  }

  logger.debug("Voilanorbert enrich response", {
    emailCount: emails.length,
    token: data.token,
  });

  return {
    engine: "voilanorbert",
    token: data.token,
    data: [],
    raw_data: [],
  };
}

// --- Sync Enrichment (tries engines in order) ---

/**
 * Try sync enrichment engines in order:
 * 1. EnrichLayer (email only)
 * 2. TheDig (email + name)
 *
 * Returns the first successful result with data.
 */
export async function enrichSync(
  person: Partial<Person>,
): Promise<EngineResponse> {
  // Try EnrichLayer first (requires email only)
  if (person.email) {
    try {
      logger.debug("Trying EnrichLayer", { email: person.email });
      const enrichLayerResult = await enrichLayerLookup(person.email);

      if (enrichLayerResult.data.length > 0) {
        logger.debug("EnrichLayer succeeded", { email: person.email });
        return enrichLayerResult;
      }

      logger.debug("EnrichLayer returned no data, trying TheDig", {
        email: person.email,
      });
    } catch (err) {
      logger.warn("EnrichLayer failed, trying TheDig", {
        error: (err as Error).message,
        email: person.email,
      });
    }
  }

  // Try TheDig (requires email and name)
  if (person.email && person.name) {
    try {
      logger.debug("Trying TheDig", { email: person.email, name: person.name });
      const thedigResult = await thedigEnrich(person);

      if (thedigResult.data.length > 0) {
        logger.debug("TheDig succeeded", { email: person.email });
        return thedigResult;
      }

      logger.debug("TheDig returned no data", { email: person.email });
    } catch (err) {
      logger.error("TheDig failed", {
        error: (err as Error).message,
        email: person.email,
      });
    }
  }

  // No engine succeeded
  logger.debug("All sync engines exhausted", { email: person.email });
  return {
    engine: "none",
    data: [],
    raw_data: [],
  };
}
