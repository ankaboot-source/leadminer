export default interface CatchAllDomainsCache {
  exists(domain: string): Promise<boolean>;
  add(domain: string): Promise<void>;
}
