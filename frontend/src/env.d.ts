/* eslint-disable */

declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: string;
    VUE_ROUTER_MODE: "hash" | "history" | "abstract" | undefined;
    VUE_ROUTER_BASE: string | undefined;
    SERVER_ENDPOINT: number;
    SUPABASE_PROJECT_URL: string;
    SUPABASE_ANON_KEY: string;
    SUPABASE_MAX_ROWS: number;
    AVERAGE_EXTRACTION_RATE: number;
    BANNER_IMAGE_URL: string;
  }
}
