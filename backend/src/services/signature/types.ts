export interface PersonLD {
  name?: string;
  image?: string;
  jobTitle?: string;
  worksFor?: string;
  address?: string;
  telephone?: string[];
  sameAs?: string[];
}

export interface ExtractSignature {
  isActive(): boolean;
  extract(signature: string): Promise<PersonLD | null>;
}
