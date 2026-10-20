/**
 * A text value that is a plain http(s) URL, with a short label (the file name,
 * else the host); null for anything else, so other schemes never become links.
 */
export function linkValue(raw: string | null | undefined) {
  const text = raw?.trim();
  if (!text || /\s/.test(text) || !/^https?:\/\//i.test(text)) return null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  const last = url.pathname.split("/").filter(Boolean).at(-1);
  let label = url.hostname;
  if (last) {
    try {
      label = decodeURIComponent(last);
    } catch {
      label = last;
    }
  }
  return { href: url.toString(), label };
}
