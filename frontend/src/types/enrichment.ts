export type EnrichContactResponse = {
  taskId: string;
  userId?: string;
  webhookSecretToken?: string;
  total?: string;
  alreadyEnriched?: boolean;
};

export interface EnrichmentTask {
  id: string;
  status: 'running' | 'done' | 'canceled';
  details: {
    progress: {
      total: number;
      enriched: number;
    };
    error: string;
  };
}
