import { Redis } from 'ioredis';
import { Logger } from 'winston';
import { Organization, Person, Tag } from '../../../db/types';
import { PostgreSQLMiningSourceCredentials } from '../../../db/interfaces/MiningSources';
import { PostgresQueryService } from '../../postgresql/PostgresQueryService';
import { TaggingEngine } from '../../tagging/types';
import { DomainStatusVerificationFunction } from './EmailMessage';
import {
  undefinedIfEmpty,
  undefinedIfFalsy
} from '../../../utils/helpers/validation';

export interface PostgreSQLFormat {
  query: string;
  mapping: Record<string, string>;
  credentials: PostgreSQLMiningSourceCredentials;
  sourceName: string;
}

export interface PostgreSQLExtractedContacts {
  type: 'postgresql';
  organizations: Organization[];
  persons: {
    person: Person;
    tags: Tag[];
  }[];
}

function mapRowToContact(
  row: Record<string, unknown>,
  mapping: Record<string, string>
): { email: string; [key: string]: unknown } {
  const contact: { email: string; [key: string]: unknown } = {
    email: ''
  };

  for (const [column, field] of Object.entries(mapping)) {
    if (row[column] !== undefined && row[column] !== null) {
      contact[field] = row[column];
    }
  }

  if (!contact.email || typeof contact.email !== 'string') {
    throw new Error('Email field is required but not found in mapped data');
  }

  return contact as { email: string; [key: string]: unknown };
}

export class PostgreSQLContactEngine {
  constructor(
    private readonly taggingEngine: TaggingEngine,
    private readonly redisClient: Redis,
    private readonly domainStatusVerification: DomainStatusVerificationFunction,
    private readonly logger: Logger,
    private readonly format: PostgreSQLFormat,
    private readonly onBatchProcessed?: (
      batchSize: number
    ) => void | Promise<void>
  ) {}

  private static extractOrganization(contact: {
    email: string;
    [key: string]: unknown;
  }): { name: string | undefined } {
    const worksFor = contact.works_for;
    return {
      name: typeof worksFor === 'string' ? worksFor || undefined : undefined
    };
  }

  private extractPerson(contact: {
    email: string;
    [key: string]: unknown;
  }): Person {
    const {
      email,
      name,
      given_name: givenName,
      family_name: familyName,
      alternate_name: alternateName,
      location,
      job_title: jobTitle,
      same_as: sameAs,
      works_for: worksFor,
      image
    } = contact;

    return {
      email: email as string,
      source: this.format.sourceName,
      name: undefinedIfFalsy((name as string) ?? ''),
      givenName: undefinedIfFalsy((givenName as string) ?? ''),
      familyName: undefinedIfFalsy((familyName as string) ?? ''),
      jobTitle: undefinedIfFalsy((jobTitle as string) ?? ''),
      image: undefinedIfFalsy((image as string) ?? ''),
      location: undefinedIfFalsy((location as string) ?? ''),
      sameAs: undefinedIfEmpty(((sameAs as string) ?? '').split(',')),
      worksFor: undefinedIfFalsy((worksFor as string) ?? ''),
      alternateName: undefinedIfEmpty(
        ((alternateName as string) ?? '').split(',')
      )
    };
  }

  async getContacts(): Promise<PostgreSQLExtractedContacts> {
    const queryService = new PostgresQueryService(this.format.credentials);
    const organizations: Organization[] = [];
    const persons: { person: Person; tags: Tag[] }[] = [];
    const uniqueOrgs = new Set<string>();

    this.logger.info('Starting PostgreSQL extraction', {
      sourceName: this.format.sourceName,
      query: `${this.format.query.substring(0, 100)}...`
    });

    try {
      for await (const batch of queryService.executeQueryStream(
        this.format.query
      )) {
        const contacts = batch.rows.map((row) => {
          try {
            return mapRowToContact(row, this.format.mapping);
          } catch (error) {
            this.logger.warn('Failed to map row to contact', {
              row,
              error: (error as Error).message
            });
            return null;
          }
        });

        const validContacts = contacts.filter(
          (c): c is { email: string; [key: string]: unknown } => c !== null
        );

        for (const contact of validContacts) {
          const orgName =
            PostgreSQLContactEngine.extractOrganization(contact).name;
          if (orgName) {
            uniqueOrgs.add(orgName);
          }
        }

        for (const name of uniqueOrgs) {
          organizations.push({ name });
        }

        const previousPersonCount = persons.length;

        await Promise.allSettled(
          validContacts.map(async (contact) => {
            const person = this.extractPerson(contact);
            const { email } = person;
            const [identifier, domain] = email.split('@');

            const [domainIsValid, domainType] =
              await this.domainStatusVerification(
                this.redisClient,
                domain.toLowerCase()
              );

            if (domainIsValid) {
              persons.push({
                person,
                tags: this.taggingEngine.getTags({
                  header: {},
                  email: {
                    address: email,
                    name: identifier,
                    domainType
                  }
                })
              });
            }
          })
        );

        const batchSize = persons.length - previousPersonCount;

        if (this.onBatchProcessed && batchSize > 0) {
          await this.onBatchProcessed(batchSize);
        }

        this.logger.info('PostgreSQL batch processed', {
          batchSize,
          cumulativeCount: persons.length,
          organizations: organizations.length
        });
      }

      if (persons.length === 0) {
        this.logger.warn('No valid contacts extracted from PostgreSQL', {
          sourceName: this.format.sourceName,
          reason: 'All rows filtered or no valid emails'
        });
      }

      this.logger.info('PostgreSQL extraction completed', {
        sourceName: this.format.sourceName,
        totalContacts: persons.length,
        totalOrganizations: organizations.length
      });

      return {
        type: 'postgresql',
        persons,
        organizations
      };
    } catch (error) {
      this.logger.error('PostgreSQL connection error during extraction', {
        sourceName: this.format.sourceName,
        error: (error as Error).message,
        processedSoFar: persons.length
      });
      throw error;
    }
  }
}
