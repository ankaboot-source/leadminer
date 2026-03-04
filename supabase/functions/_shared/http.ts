import corsHeaders from "./cors.ts";

export const buildRedirectResponse = (location: string): Response => {
  const headers = new Headers(corsHeaders);
  headers.set("Location", location);

  return new Response(null, {
    status: 302,
    headers,
  });
};
