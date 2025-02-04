export interface EnrichmentTask {
  id: string;
  status: 'running' | 'done' | 'canceled';
  details: {
    total_to_enrich: number;
    total_enriched: number;
  };
}

export type EnrichContactResponse = {
  total?: number;
  available?: number;
  task?: EnrichmentTask;
};
