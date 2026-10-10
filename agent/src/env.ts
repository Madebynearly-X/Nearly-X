export type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
  ENVIRONMENT?: string;
  ALLOW_DEV_AUTH_BYPASS?: string;
  OWNER_EMAIL?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  LLM_PROVIDER?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  LLM_INPUT_USD_PER_1K_TOKENS?: string;
  LLM_OUTPUT_USD_PER_1K_TOKENS?: string;
  CANVA_CLIENT_ID?: string;
  CANVA_CLIENT_SECRET?: string;
  CANVA_REDIRECT_URI?: string;
  CANVA_TOKEN_ENCRYPTION_KEY?: string;
  LINKEDIN_CLIENT_ID?: string;
  LINKEDIN_CLIENT_SECRET?: string;
  LINKEDIN_REDIRECT_URI?: string;
  LINKEDIN_TOKEN_ENCRYPTION_KEY?: string;
  LINKEDIN_API_VERSION?: string;
  ADOBE_EXPRESS_EMBED_CLIENT_ID?: string;
  ADOBE_EXPRESS_EMBED_APPROVED?: string;
  APP_PUBLIC_ORIGIN?: string;
};

export type AppEnv = {
  Bindings: Env;
  Variables: { ownerEmail: string };
};
