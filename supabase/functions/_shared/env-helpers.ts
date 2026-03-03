export function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name)

  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}