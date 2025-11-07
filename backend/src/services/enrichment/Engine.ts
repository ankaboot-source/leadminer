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

export interface Engine {
  readonly name: string;
  readonly isSync: boolean;
  readonly isAsync: boolean;

  isValid: (contact: Partial<Person>) => boolean;
  enrichAsync(
    persons: Partial<Person>[],
    webhook: string
  ): Promise<EngineResponse>;
  enrichSync(persons: Partial<Person>): Promise<EngineResponse>;
  parseResult(data: unknown[]): EngineResponse;
}
