export interface Organization {
  id: string;
  name: string;
  alternate_name: string | null;
  location: string[] | null;
  url: string | null;
  legal_name: string | null;
  telephone: string | null;
  email: string | null;
  image: string | null;
  founder: string | null;
  _domain: string | null;
}
