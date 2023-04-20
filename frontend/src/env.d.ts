/* eslint-disable */

declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: string;
    VUE_ROUTER_MODE: "hash" | "history" | "abstract" | undefined;
    VUE_ROUTER_BASE: string | undefined;
    SERVER_ENDPOINT: number;
    SUPABASE_PROJECT_URL: string;
    SUPABASE_SECRET_PROJECT_TOKEN: string;
    SUPABASE_MAX_ROWS: number;
    GG_CLIENT_ID: string;
    AVERAGE_EXTRACTION_RATE: number;
    BANNER_IMAGE_URL: string;
  }
}
