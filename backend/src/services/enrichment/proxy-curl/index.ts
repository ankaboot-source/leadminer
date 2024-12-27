import { Engine, EngineResponse, Person } from '../Engine';
import ProxycurlApi, {
  ProfileExtra,
  ReverseEmailLookupResponse
} from './client';
import { undefinedIfEmpty, undefinedIfFalsy } from '../utils';

import { Logger } from 'winston';

export default class Proxycurl implements Engine {
  constructor(
    private readonly client: ProxycurlApi,
    private readonly logger: Logger
  ) {}

  readonly name = 'proxycurl';

  readonly isSync = true;

  readonly isAsync = false;

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

  // eslint-disable-next-line class-methods-use-this
  isValid(contact: Partial<Person>) {
    return Boolean(contact.email);
  }

  async enrichSync(person: Partial<Person>) {
    try {
      this.logger.debug(`${this.constructor.name}.enrichSync request`, person);
      const response = await this.client.reverseEmailLookup({
        lookup_depth: 'superficial',
        enrich_profile: 'enrich',
        email: person.email as string
      });
      return this.parseResult([response]);
    } catch (err) {
      throw new Error((err as Error).message);
    }
  }

  enrichAsync(_: Partial<Person>[], __: string): Promise<EngineResponse> {
    this.logger.debug(`${this.constructor.name}.enrichSync request`, _, __);
    throw new Error('Method not implemented.');
  }

  parseResult(data: ReverseEmailLookupResponse[]) {
    const [response] = data;
    const mapped = [
      {
        name: undefinedIfFalsy(response?.profile?.full_name ?? ''),
        givenName: undefinedIfFalsy(response?.profile?.first_name ?? ''),
        familyName: undefinedIfFalsy(response?.profile?.last_name ?? ''),
        jobTitle: undefinedIfFalsy(response?.profile?.occupation ?? ''),
        organization: undefinedIfFalsy(
          response?.profile?.experiences?.[0]?.company ?? ''
        ),
        image: undefinedIfFalsy(response?.profile?.profile_pic_url ?? ''),
        identifiers: undefinedIfEmpty(
          [response?.profile?.public_identifier].filter((id): id is string =>
            Boolean(id)
          )
        ),
        location: undefinedIfEmpty([
          [
            response?.profile?.city,
            response?.profile?.state,
            response?.profile?.country_full_name
          ]
            .filter((loc): loc is string => Boolean(loc))
            .join(', ')
        ]),
        sameAs: undefinedIfEmpty([
          response?.linkedin_profile_url,
          response?.facebook_profile_url,
          response?.twitter_profile_url,
          ...Proxycurl.getProfileUrls(response?.profile?.extra)
        ])
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
      `[${this.constructor.name}]-[parseResult]: Parsing results`,
      mapped
    );

    return {
      engine: this.name,
      data: mapped ? [{ email: response.email, ...mapped }] : [],
      raw_data: [response]
    };
  }
}
