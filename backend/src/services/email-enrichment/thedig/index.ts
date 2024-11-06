import { Logger } from 'winston';
import { EmailEnricher, EnricherResult, Person } from '../EmailEnricher';
import Voilanorbert, {
  EnrichPersonRequest,
  EnrichPersonResponse
} from './client';
import { undefinedIfEmpty, undefinedIfFalsy } from '../utils';

export default class TheDigEmailEnricher implements EmailEnricher {
  constructor(
    private readonly client: Voilanorbert,
    private readonly logger: Logger
  ) {}

  private static isPersonEnriched(
    personRequest: EnrichPersonRequest,
    personResponse: EnrichPersonResponse
  ): boolean {
    const requestKeys = Object.keys(personRequest);
    const responseKeys = Object.keys(personResponse);
    const hasNewFields = responseKeys.some((key) => !(key in personRequest));
    const hasModifiedFields = requestKeys.some((key) => {
      const requestValue = personRequest[key as keyof EnrichPersonRequest];
      const responseValue = personResponse[key as keyof EnrichPersonResponse];

      if (Array.isArray(requestValue) || Array.isArray(responseValue)) {
        return JSON.stringify(requestValue) !== JSON.stringify(responseValue);
      }
      return requestValue !== responseValue;
    });

    return hasNewFields || hasModifiedFields;
  }

  private enrichRequestMapper(person: Partial<Person>) {
    let personMapped: EnrichPersonRequest = {
      email: person.email as string,
      name: person.name as string,
      homeLocation: person.location,
      alternateName: person.alternate_names,
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

    this.logger.debug(
      `[${this.constructor.name}]-[enrichmentMapper]: Formatting person for thedig request`,
      personMapped
    );

    return personMapped;
  }

  async enrichSync(person: Partial<Person>) {
    this.logger.debug(
      `Got ${this.constructor.name}.enrichSync request`,
      person
    );
    try {
      const personMapped = this.enrichRequestMapper(person);
      const response = await this.client.enrich(personMapped);
      const enrichResponse = TheDigEmailEnricher.isPersonEnriched(
        personMapped,
        response
      )
        ? this.enrichmentMapper([response])
        : { data: [], raw_data: [response] };
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
      const response = await this.client.enrichBulk(
        persons.map(({ name, email }) => ({ name, email })),
        webhook
      );

      if (!response.success) {
        throw new Error('Failed to upload emails to enrichment.');
      }

      return response;
    } catch (err) {
      throw new Error((err as Error).message);
    }
  }

  enrichmentMapper(enrichedData: EnrichPersonResponse[]) {
    this.logger.debug(
      `[${this.constructor.name}]-[enrichmentMapper]: Parsing enrichment results`,
      enrichedData
    );
    const results = enrichedData;
    const enriched: EnricherResult[] = results
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
        alternateNames: undefinedIfEmpty(person.alternateName ?? []),
        location: undefinedIfEmpty(
          [
            [person.homeLocation].flat().filter(Boolean).join(','),
            [person.workLocation].flat().filter(Boolean).join(',')
          ].flat()
        )
      }))
      .filter(
        ({ organization, jobTitle, location, alternateNames, image }) =>
          ![organization, jobTitle, location, alternateNames, image].every(
            (field) => !field || field.length === 0
          )
      );
    return {
      data: enriched,
      raw_data: results
    };
  }
}
