// Ported from backend enrichment engines (Deno-compatible)
// Clients + Engine classes implementing the Engine interface

import type {
  Engine,
  EngineResponse,
  EngineResult,
  Person,
} from "../types.ts";
import Enricher from "./Enricher.ts";

// ─── Helper functions (from backend/src/utils/helpers/validation.ts) ────────

function undefinedIfEmpty<T>(array: T[]): T[] | undefined {
  const filteredArray = array.filter((val): val is T => Boolean(val));
  return filteredArray.length > 0 ? filteredArray : undefined;
}

function undefinedIfFalsy<T>(value: T): T | undefined {
  return value || undefined;
}

// ─── EnrichLayer Client ─────────────────────────────────────────────────────

interface Experience {
  starts_at: { day: number; month: number; year: number };
  ends_at: { day?: number | null; month?: number | null; year?: number | null };
  company: string;
  company_linkedin_profile_url?: string | null;
  company_facebook_profile_url?: string | null;
  title: string;
  description: string;
  location?: string | null;
  logo_url?: string | null;
}

interface Profile {
  city: string;
  full_name: string;
  first_name: string;
  last_name: string;
  state: string;
  country: string;
  country_full_name: string;
  languages: string[];
  occupation: string;
  profile_pic_url: string;
  public_identifier: string;
  extra: ProfileExtra;
  experiences: Experience[];
}

interface ProfileExtra {
  github_profile_id?: string;
  facebook_profile_id?: string;
  twitter_profile_id?: string;
  website?: string;
}

interface ReverseEmailLookupParams {
  email: string;
  lookup_depth: "superficial" | "deep";
  enrich_profile?: "skip" | "enrich";
}

interface ReverseEmailLookupResponse {
  email: string;
  profile: Profile;
  last_updated: string;
  similarity_score: number;
  linkedin_profile_url: string;
  facebook_profile_url: string;
  twitter_profile_url: string;
}

class EnrichLayerClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor() {
    this.baseUrl = Deno.env.get("ENRICHLAYER_URL") || "";
    this.apiKey = Deno.env.get("ENRICHLAYER_API_KEY") || "";
  }

  async reverseEmailLookup(
    params: ReverseEmailLookupParams
  ): Promise<ReverseEmailLookupResponse> {
    const url = new URL("/api/v2/profile/resolve/email", this.baseUrl);
    url.searchParams.set("email", params.email);
    url.searchParams.set("lookup_depth", params.lookup_depth);
    if (params.enrich_profile) {
      url.searchParams.set("enrich_profile", params.enrich_profile);
    }

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });

    if (!response.ok) {
      throw new Error(
        `EnrichLayer API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    return { ...data, email: params.email };
  }
}

// ─── Thedig Client ──────────────────────────────────────────────────────────

interface EnrichPersonRequest {
  url?: string;
  name?: string;
  email: string;
  OptOut?: boolean;
  familyName?: string;
  givenName?: string;
  image?: string[];
  sameAs?: string[];
  jobTitle?: string[];
  worksFor?: string[];
  identifier?: string[];
  nationality?: string[];
  description?: string[];
  homeLocation?: string;
  workLocation?: string;
  alternateName?: string[];
  knowsLanguage?: string[];
}

interface EnrichPersonResponse {
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
  description?: string[];
  knowsLanguage?: string[];
  nationality?: string[];
  OptOut?: boolean;
  url?: string;
  error_msg?: string;
  statusCode: number;
}

class ThedigClient {
  private readonly baseUrl: string;
  private readonly apiToken: string;

  constructor() {
    this.baseUrl = Deno.env.get("THEDIG_URL") || "";
    this.apiToken = Deno.env.get("THEDIG_API_KEY") || "";
  }

  async enrich(person: EnrichPersonRequest): Promise<EnrichPersonResponse> {
    const response = await fetch(`${this.baseUrl}/person/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": this.apiToken,
      },
      body: JSON.stringify(person),
    });

    if (!response.ok) {
      throw new Error(
        `Thedig API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    return {
      ...data,
      statusCode: data.statusCode ?? response.status,
    };
  }

  async enrichBulk(
    persons: EnrichPersonRequest[],
    webhook: string
  ): Promise<{ status: string; success: boolean; token: string }> {
    const response = await fetch(
      `${this.baseUrl}/person/bulk?endpoint=${webhook}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": this.apiToken,
        },
        body: JSON.stringify(persons),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Thedig bulk API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    return {
      status: "running",
      success: true,
      token: data as string,
    };
  }
}

// ─── Voilanorbert Client ────────────────────────────────────────────────────

interface ResponseAsync {
  status: string;
  success: boolean;
  token: string;
}

interface Result {
  email: string;
  fullName: string;
  title: string;
  organization: string;
  location: string;
  twitter: string;
  linkedin: string;
  facebook: string;
  error_msg?: string;
}

interface ResponseWebhook {
  id: string;
  token: string;
  results: Result[];
}

class VoilanorbertClient {
  private static readonly baseURL =
    "https://api.voilanorbert.com/2018-01-08/";

  private readonly baseUrl: string;
  private readonly username: string;
  private readonly apiToken: string;

  constructor() {
    this.baseUrl =
      Deno.env.get("VOILANORBERT_URL") || VoilanorbertClient.baseURL;
    this.username = Deno.env.get("VOILANORBERT_USERNAME") || "";
    this.apiToken = Deno.env.get("VOILANORBERT_API_KEY") || "";
  }

  async enrich(
    emails: string[],
    webhook: string
  ): Promise<ResponseAsync> {
    const credentials = btoa(`${this.username}:${this.apiToken}`);
    const formData = new URLSearchParams();
    formData.append("data", emails.join("\n"));
    formData.append("webhook", webhook);

    const response = await fetch(`${this.baseUrl}/enrich/upload`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      throw new Error(
        `Voilanorbert API error: ${response.status} ${response.statusText}`
      );
    }

    return await response.json();
  }
}

// ─── Engine: EnrichLayer ────────────────────────────────────────────────────

class EnrichLayer implements Engine {
  readonly name = "enrichLayer";
  readonly isSync = true;
  readonly isAsync = false;

  constructor(private readonly client: EnrichLayerClient) {}

  static getProfileUrls(profile: ProfileExtra): string[] {
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
      urls.push(profile?.website);
    }

    return urls;
  }

  // skipcq: JS-0356 - Instance method satisfies Engine interface; no instance state needed
  isValid(contact: Partial<Person>): boolean {
    return Boolean(contact.email);
  }

  async enrichSync(person: Partial<Person>): Promise<EngineResponse> {
    try {
      const response = await this.client.reverseEmailLookup({
        lookup_depth: "superficial",
        enrich_profile: "enrich",
        email: person.email as string,
      });
      return this.parseResult([response]);
    } catch (err) {
      throw new Error((err as Error).message);
    }
  }

  // skipcq: JS-0356 - Instance method satisfies Engine interface; no instance state needed
  enrichAsync(
    _persons: Partial<Person>[],
    _webhook: string
  ): Promise<EngineResponse> {
    throw new Error("Method not implemented.");
  }

  parseResult(data: ReverseEmailLookupResponse[]): EngineResponse {
    const [response] = data;
    const mapped = [
      {
        name: undefinedIfFalsy(response?.profile?.full_name ?? ""),
        givenName: undefinedIfFalsy(response?.profile?.first_name ?? ""),
        familyName: undefinedIfFalsy(response?.profile?.last_name ?? ""),
        jobTitle: undefinedIfFalsy(response?.profile?.occupation ?? ""),
        organization: undefinedIfFalsy(
          response?.profile?.experiences?.[0]?.company ?? ""
        ),
        image: undefinedIfFalsy(response?.profile?.profile_pic_url ?? ""),
        identifiers: undefinedIfEmpty(
          [response?.profile?.public_identifier].filter((id): id is string =>
            Boolean(id)
          )
        ),
        location: undefinedIfFalsy(
          [
            response?.profile?.city,
            response?.profile?.state,
            response?.profile?.country_full_name,
          ]
            .filter((loc): loc is string => Boolean(loc))
            .join(", ")
        ),
        sameAs: undefinedIfEmpty([
          response?.linkedin_profile_url,
          response?.facebook_profile_url,
          response?.twitter_profile_url,
          ...EnrichLayer.getProfileUrls(response?.profile?.extra),
        ]),
      },
    ]
      .filter(
        (result) =>
          !Array.from(Object.values(result)).every(
            (field) => field === undefined || field.length === 0
          )
      )
      .pop();

    return {
      engine: this.name,
      data: mapped ? [{ email: response.email, ...mapped }] : [],
      raw_data: [response],
    };
  }
}

// ─── Engine: TheDig ─────────────────────────────────────────────────────────

class TheDig implements Engine {
  readonly name = "thedig";
  readonly isSync = true;
  readonly isAsync = false;

  constructor(private readonly client: ThedigClient) {}

  // skipcq: JS-0356 - Instance method satisfies Engine interface; no instance state needed
  isValid(contact: Partial<Person>): boolean {
    return Boolean(contact.email && contact.name);
  }

  async enrichSync(person: Partial<Person>): Promise<EngineResponse> {
    try {
      const personMapped = TheDig.mapForClientRequest(person);
      const response = await this.client.enrich(personMapped);
      let enrichResponse = this.parseResult([response]);
      if (response.statusCode === 203 && !response.sameAs?.length) {
        enrichResponse = { engine: this.name, data: [], raw_data: [response] };
      }
      return enrichResponse;
    } catch (err) {
      throw new Error((err as Error).message);
    }
  }

  async enrichAsync(
    persons: Partial<Person>[],
    webhook: string
  ): Promise<EngineResponse> {
    try {
      const mapped = persons.map(TheDig.mapForClientRequest);
      const response = await this.client.enrichBulk(
        mapped.map(({ name, email }) => ({ name, email })),
        webhook
      );

      if (!response.success) {
        throw new Error("Failed to upload emails to enrichment.");
      }
      return {
        engine: this.name,
        token: response.token,
        data: [],
        raw_data: [],
      };
    } catch (err) {
      throw new Error((err as Error).message);
    }
  }

  static mapForClientRequest(
    person: Partial<Person>
  ): EnrichPersonRequest {
    let personMapped: EnrichPersonRequest = {
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
      Object.entries(personMapped).filter(([, value]) => Boolean(value))
    ) as EnrichPersonRequest;
    return personMapped;
  }

  parseResult(enrichedData: EnrichPersonResponse[]): EngineResponse {
    const results = enrichedData;
    const enriched: EngineResult[] = results
      .map((person) => ({
        email: person.email,
        name: undefinedIfFalsy(person.name),
        givenName: undefinedIfFalsy(person.givenName),
        familyName: undefinedIfFalsy(person.familyName),
        image: undefinedIfFalsy(person.image?.[0]),
        jobTitle: undefinedIfFalsy(person.jobTitle?.[0]),
        organization: undefinedIfFalsy(person.worksFor?.[0]),
        sameAs: undefinedIfEmpty(person.sameAs ?? []),
        identifiers: undefinedIfEmpty(person.identifier ?? []),
        alternateName: undefinedIfEmpty(person.alternateName ?? []),
        location: undefinedIfFalsy(
          [person.homeLocation, person.workLocation]
            .flat()
            .filter(Boolean)
            .join(", ")
        ),
      }))
      .filter(
        ({
          givenName,
          familyName,
          sameAs,
          organization,
          jobTitle,
          location,
          alternateName,
          image,
        }) =>
          ![
            givenName,
            familyName,
            sameAs,
            organization,
            jobTitle,
            location,
            alternateName,
            image,
          ].every((field) => !field || field.length === 0)
      );
    return {
      engine: this.name,
      data: enriched,
      raw_data: results,
    };
  }
}

// ─── Engine: Voilanorbert ───────────────────────────────────────────────────

class Voilanorbert implements Engine {
  readonly name = "voilanorbert";
  readonly isSync = false;
  readonly isAsync = true;

  constructor(private readonly client: VoilanorbertClient) {}

  // skipcq: JS-0356 - Instance method satisfies Engine interface; no instance state needed
  isValid(contact: Partial<Person>): boolean {
    return Boolean(contact.email);
  }

  enrichSync(_person: Partial<Person>): Promise<EngineResponse> {
    throw new Error(
      `[${this.constructor.name}]: method enrichSync not implemented.`
    );
  }

  async enrichAsync(
    persons: Partial<Person>[],
    webhook: string
  ): Promise<EngineResponse> {
    try {
      const response = await this.client.enrich(
        persons.map(({ email }) => email as string),
        webhook
      );

      if (!response.success) {
        throw new Error("Failed to upload emails to enrichment.");
      }

      return {
        engine: this.name,
        token: response.token,
        data: [],
        raw_data: [],
      };
    } catch (err) {
      throw new Error((err as Error).message);
    }
  }

  parseResult(enrichedData: unknown[]): EngineResponse {
    const results =
      (enrichedData[0] as ResponseWebhook).results ??
      (enrichedData as ResponseWebhook["results"]);
    const enriched = results
      .map((result) => ({
        email: result.email,
        image: undefinedIfFalsy(""),
        name: undefinedIfFalsy(result.fullName),
        organization: undefinedIfFalsy(result.organization),
        jobTitle: undefinedIfFalsy(result.title),
        location: undefinedIfFalsy(result.location),
        sameAs: undefinedIfEmpty([
          result.facebook,
          result.linkedin,
          result.twitter,
        ]),
      }))
      .filter(
        ({ email, name, location, organization, jobTitle, sameAs }) =>
          email !== "Email" &&
          ![name, location, organization, jobTitle, sameAs].every(
            (field) => field === undefined || field.length === 0
          )
      );
    return {
      engine: this.name,
      data: enriched,
      raw_data: results,
    };
  }
}

// ─── Singleton Enricher (used by index.ts) ──────────────────────────────────

const enricher = new Enricher([
  new EnrichLayer(new EnrichLayerClient()),
  new TheDig(new ThedigClient()),
  new Voilanorbert(new VoilanorbertClient()),
]);

export function enrichSync(
  person: Partial<Person>
): Promise<EngineResponse | null> {
  return enricher.enrichSync(person);
}

export function enrichAsync(
  contacts: Partial<Person>[],
  webhook: string
): Promise<EngineResponse | null> {
  return enricher.enrichAsync(contacts, webhook);
}

export function parseResult(
  result: unknown[],
  engineName: string
): EngineResponse {
  return enricher.parseResult(result, engineName);
}

export { EnrichLayer, TheDig, Voilanorbert };
export type { Person, EngineResponse } from "../types.ts";
