export function getImageViaProxy(url: string) {
  const proxy = useRuntimeConfig().public.IMAGE_REVERSE_PROXY?.toString();

  if (!proxy) {
    return url;
  }
  const parsedUrl = new URL(url);
  const result = `${proxy}/${parsedUrl.host}${parsedUrl.pathname}${parsedUrl.search}`;
  return result;
}
