import { Logger } from 'winston';
import {
  undefinedIfEmpty,
  undefinedIfFalsy
} from '../../../utils/helpers/validation';
import { Engine, EngineResult, Person } from '../Engine';
import VoilanorbertApi, {
  EnrichPersonRequest,
  EnrichPersonResponse
} from './client';

export default class Thedig implements Engine {
  readonly name = 'thedig';

  readonly isSync = true;

  readonly isAsync = false;

  constructor(
    private readonly client: VoilanorbertApi,
    private readonly logger: Logger
  ) {}

  // eslint-disable-next-line class-methods-use-this
  isValid(contact: Partial<Person>) {
    return Boolean(contact.email && contact.name);
  }

  async enrichSync(person: Partial<Person>) {
    this.logger.debug(
      `Got ${this.constructor.name}.enrichSync request`,
      person
    );
    try {
      const personMapped = Thedig.mapForClientRequest(person);
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

  async enrichAsync(persons: Partial<Person>[], webhook: string) {
    this.logger.debug(
      `Got ${this.constructor.name}.enrichAsync request`,
      persons
    );
    try {
      const mapped = persons.map(Thedig.mapForClientRequest);
      const response = await this.client.enrichBulk(
        mapped.map(({ name, email }) => ({ name, email })),
        webhook
      );

      if (!response.success) {
        throw new Error('Failed to upload emails to enrichment.');
      }
      return {
        engine: this.name,
        token: response.token,
        data: [],
        raw_data: []
      };
    } catch (err) {
      throw new Error((err as Error).message);
    }
  }

  static mapForClientRequest(person: Partial<Person>) {
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
      worksFor: person.works_for ? [person.works_for] : undefined
    };

    personMapped = Object.fromEntries(
      Object.entries(personMapped).filter(([, value]) => Boolean(value))
    ) as EnrichPersonRequest;
    return personMapped;
  }

  parseResult(enrichedData: EnrichPersonResponse[]) {
    this.logger.debug(
      `[${this.constructor.name}]-[parseResult]: Parsing enrichment results`,
      enrichedData
    );
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
            .join(', ')
        )
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
          image
        }) =>
          ![
            givenName,
            familyName,
            sameAs,
            organization,
            jobTitle,
            location,
            alternateName,
            image
          ].every((field) => !field || field.length === 0)
      );
    return {
      engine: this.name,
      data: enriched,
      raw_data: results
    };
  }
}
