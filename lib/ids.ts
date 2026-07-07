const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

export function randId(len = 10) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

function slugify(label: string) {
  return (
    label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "link"
  );
}

// readable + unique-ish, e.g. "sequoia-k3f9p"
export function shareSlug(label: string) {
  return `${slugify(label)}-${randId(5)}`;
}
