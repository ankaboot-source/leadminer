export function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name)

  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

/**
 * Reads an env var that is genuinely optional for this deployment.
 * Lets a function import cleanly on single-provider / partial-config
 * deployments instead of crashing at module load (import-time
 * `getRequiredEnv` killed every request to the whole function).
 */
export function getOptionalEnv(name: string, fallback = ""): string {
  const value = Deno.env.get(name)
  return value === undefined || value === "" ? fallback : value
}
