import { EmailEnricher, Person } from './EmailEnricher';

export type EnricherType = 'voilanorbert' | 'thedig';

interface Config {
  LOAD_BALANCE_ENRICHERS: boolean;
}

export interface Enricher {
  default: boolean;
  type: EnricherType;
  instance: EmailEnricher;
  rule: (contact: Partial<Person>) => boolean;
}

export default class ContactEnrichmentManager {
  private lastUsedInstances: Set<string> = new Set();

  constructor(
    private readonly enrichers: Enricher[],
    private readonly config: Config
  ) {
    if (!this.enrichers.length) {
      throw new Error('At least one enricher is required.');
    }

    const defaultEnrichers = this.enrichers.filter(
      (enricher) => enricher.default
    );
    if (!defaultEnrichers.length || defaultEnrichers.length > 1) {
      throw new Error(
        `Expected one enricher as default got ${defaultEnrichers.length}.`
      );
    }
  }

  /**
   * Updates the list of last used enrichers and maintains the size.
   *
   * @param availableInstances - The available enricher instances.
   * @param instance - The enricher instance that was used.
   */
  private maintainLastUsedInstances(
    availableInstances: EmailEnricher[],
    instance: EmailEnricher
  ): void {
    this.lastUsedInstances.add(instance.constructor.name);

    const allInstancesUsed = availableInstances.every((available) =>
      this.lastUsedInstances.has(available.constructor.name)
    );

    if (allInstancesUsed) {
      availableInstances.forEach((available) => {
        this.lastUsedInstances.delete(available.constructor.name);
      });
    }
  }

  /**
   * Retrieves the next enricher capable of verifying the given contact.
   *
   * @param {Contact} contact - The contact to verify.
   * @returns {EmailEnricher} The selected enricher instance.
   * @throws {Error} If no enricher can verify the contact.
   */
  getEnricher(
    contact: Partial<Person>,
    type?: EnricherType
  ): {
    type: EnricherType;
    instance: EmailEnricher;
  } {
    if (type) {
      const enricher = this.enrichers.find((e) => e.type === type);

      if (!enricher) {
        throw new Error(`Enricher with type <${type}> not found.`);
      }

      return {
        type: enricher.type,
        instance: enricher.instance
      };
    }

    const enrichers = this.enrichers.filter(({ rule }) => rule(contact));

    if (enrichers.length === 0) {
      // Fallback to default
      const enr = this.enrichers.find((enricher) => enricher.default)!;
      return {
        type: enr.type,
        instance: enr.instance
      };
    }

    let ValidEnricher = enrichers[0];

    if (this.config.LOAD_BALANCE_ENRICHERS || enrichers.length > 1) {
      const available = enrichers.filter(
        (instance) => !this.lastUsedInstances.has(instance.constructor.name)
      );

      if (available.length) {
        this.maintainLastUsedInstances(
          available.map((e) => e.instance),
          available[0].instance
        );
      } else {
        // Use any instance and update history for better balancing next time.
        this.maintainLastUsedInstances(
          enrichers.map((e) => e.instance),
          enrichers[0].instance
        );
      }
      [ValidEnricher] = available.length ? available : enrichers;
    }

    return {
      type: ValidEnricher.type,
      instance: ValidEnricher.instance
    };
  }

  /**
   * Retrieves enrichers for multiple contacts, returning each enricher instance
   * along with the contacts associated with that enricher.
   *
   * @param contacts - The list of contacts to verify.
   * @returns An array of tuples containing
   *          enricher instances and their corresponding contacts.
   */
  getEnrichers(contacts: Partial<Person>[]): [
    {
      type: Enricher['type'];
      instance: Enricher['instance'];
    },
    Partial<Person>[]
  ][] {
    const enricherMap = new Map<
      string,
      {
        enricher: {
          type: Enricher['type'];
          instance: Enricher['instance'];
        };
        contacts: Partial<Person>[];
      }
    >();

    for (const contact of contacts) {
      const enricher = this.getEnricher(contact);
      const { type } = enricher;

      if (!enricherMap.has(type)) {
        enricherMap.set(type, { enricher, contacts: [] });
      }
      enricherMap.get(type)!.contacts.push(contact);
    }

    // Convert the map to an array of tuples
    return Array.from(enricherMap.values()).map(
      ({ enricher, contacts: contactsList }) => [enricher, contactsList]
    );
  }
}
