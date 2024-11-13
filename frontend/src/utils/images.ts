export function getImageViaProxy(url: string, proxy?: string) {
  if (!proxy) {
    return url;
  }
  const result = url.replace(/^https?:\/\/(.+)/, `${proxy}/$1`);
  return result;
}
