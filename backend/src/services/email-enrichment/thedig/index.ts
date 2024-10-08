import { Logger } from 'winston';
import { EmailEnricher, EnricherResult, Person } from '../EmailEnricher';
import Voilanorbert, { EnrichPersonResponse } from './client';

export default class TheDigEmailEnricher implements EmailEnricher {
  constructor(
    private readonly client: Voilanorbert,
    private readonly logger: Logger
  ) {}

  async enrichSync(person: Partial<Person>) {
    this.logger.debug(
      `Got ${this.constructor.name}.enrichSync request`,
      person
    );
    try {
      const { email, name } = person;
      const response = await this.client.enrich({
        email: email as string,
        name
      });
      return this.enrichmentMapper([response]);
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
      .map(
        ({
          email,
          name,
          worksFor,
          jobTitle,
          homeLocation,
          workLocation,
          givenName,
          familyName,
          alternateName,
          sameAs,
          image
        }) => {
          const location = [homeLocation, workLocation]
            .flat()
            .filter((loc): loc is string => !!loc);
          return {
            email,
            name: name || undefined,
            givenName: givenName || undefined,
            familyName: familyName || undefined,
            alternateNames: alternateName,
            image: image?.length ? image[0] : undefined,
            location: location.length ? location : undefined,
            organization: worksFor?.length ? worksFor[0] : undefined,
            jobTitle: jobTitle?.length ? jobTitle[0] : undefined,
            sameAs: sameAs?.length ? sameAs : undefined
          };
        }
      )
      .filter(
        ({
          organization,
          jobTitle,
          location,
          alternateNames,
          image
        }) =>
          ![
            organization,
            jobTitle,
            location,
            alternateNames,
            image
          ].every((field) => field === undefined || field.length === 0)
      );
    return {
      data: enriched,
      raw_data: results
    };
  }
}
