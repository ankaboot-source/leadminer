import { Logger } from 'winston';
import ProxyCurl, { ProfileExtra, ReverseEmailLookupResponse } from './client';
import {
  EmailEnricher,
  EnricherResult,
  EnrichWebhookResponse,
  Person
} from '../EmailEnricher';

export default class ProxyCurlEmailEnricher implements EmailEnricher {
  constructor(
    private readonly client: ProxyCurl,
    private readonly logger: Logger
  ) {}

  private static getProfileUrls(profile: ProfileExtra): string[] {
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

  enrichmentMapper(data: ReverseEmailLookupResponse): {
    raw_data: unknown;
    data: EnricherResult[];
  } {
    const mapped = [
      {
        name: data?.profile?.full_name,
        givenName: data?.profile?.first_name,
        familyName: data?.profile?.last_name,
        jobTitle: data?.profile?.occupation,
        organization: data?.profile?.experiences?.[0]?.company,
        image: data?.profile?.profile_pic_url,
        identifiers: [data?.profile?.public_identifier].filter(
          (id): id is string => Boolean(id)
        ),
        location: [
          [
            data?.profile?.city,
            data?.profile?.state,
            data?.profile?.country_full_name
          ]
            .filter((loc): loc is string => Boolean(loc))
            .join(', ')
        ].filter((loc) => loc),
        sameAs: [
          data?.linkedin_profile_url,
          data?.facebook_profile_url,
          data?.twitter_profile_url,
          ...ProxyCurlEmailEnricher.getProfileUrls(data?.profile?.extra)
        ].filter((url): url is string => Boolean(url))
      }
    ]
      .filter(
        (result) =>
          !Array.from(Object.values(result)).every(
            (field) => field === undefined || field.length === 0
          )
      )
      .pop();

    this.logger.debug(
      `[${this.constructor.name}]-[enrichmentMapper]: Parsing results`,
      mapped
    );

    return {
      data: mapped ? [{ email: data.email, ...mapped }] : [],
      raw_data: data
    };
  }

  async enrichSync(
    person: Partial<Person>
  ): Promise<{ raw_data: unknown; data: EnricherResult[] }> {
    try {
      this.logger.debug(
        `${this.constructor.name}.enrichSync request`,
        person.email
      );
      const response = await this.client.reverseEmailLookup({
        lookup_depth: 'superficial',
        enrich_profile: 'enrich',
        email: person.email as string
      });
      return this.enrichmentMapper(response);
    } catch (err) {
      throw new Error((err as Error).message);
    }
  }

  enrichAsync(
    _persons: Partial<Person>[],
    __webhook: string
  ): Promise<EnrichWebhookResponse> {
    this.logger.debug(
      `${this.constructor.name}.enrichSync request`,
      _persons,
      __webhook
    );
    throw new Error('Method not implemented.');
  }
}
