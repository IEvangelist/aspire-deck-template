import { description, type DeckConfig } from './config';

export interface ImageSize {
  width: number;
  height: number;
}

export interface MetaTag {
  tag: 'meta';
  attrs: Record<string, string>;
}

const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const maxBytes = 5 * 1024 * 1024;

// A PNG starts with an 8-byte signature and an IHDR chunk whose first two fields are the width and height, so the
// metadata can state the real dimensions without an image library.
export function checkSocialImage(bytes: Uint8Array, field: string): ImageSize {
  const header = String.fromCharCode(...bytes.slice(12, 16));
  if (bytes.length < 24 || signature.some((value, index) => bytes[index] !== value) || header !== 'IHDR') {
    throw new Error(`${field} must be a PNG image.`);
  }
  if (bytes.length > maxBytes) throw new Error(`${field} is ${(bytes.length / 1024 / 1024).toFixed(1)} MB. Keep it under 5 MB.`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const size = { width: view.getUint32(16), height: view.getUint32(20) };
  if (size.width < 600 || size.height < 315) {
    throw new Error(`${field} is ${size.width}x${size.height}. Use at least 600x315; 1200x630 is ideal.`);
  }
  return size;
}

// Open Graph and Twitter share metadata. Image URLs must be absolute, so they exist only when the site URL is known
// (the Pages workflow provides it). Everything about the share card comes from the optional social block in
// deck.config.json, so a generated copy edits or deletes that one block and nothing else.
export function socialTags(config: DeckConfig, canonical: string | undefined, size: ImageSize | undefined): MetaTag[] {
  const social = config.social;
  const property = (name: string, content: string): MetaTag => ({ tag: 'meta', attrs: { property: name, content } });
  const named = (name: string, content: string): MetaTag => ({ tag: 'meta', attrs: { name, content } });
  const title = social?.title ?? config.title;
  const summary = social?.description ?? description(config);
  const tags = [
    property('og:title', title),
    property('og:description', summary),
    property('og:type', 'website'),
    property('og:locale', 'en_US'),
    named('twitter:title', title),
    named('twitter:description', summary),
  ];
  if (social?.siteName) tags.push(property('og:site_name', social.siteName));
  if (canonical) tags.push(property('og:url', canonical));
  if (social && canonical && size) {
    const image = new URL(social.image.replace(/^\/+/, ''), canonical).href;
    tags.push(property('og:image', image));
    if (image.startsWith('https:')) tags.push(property('og:image:secure_url', image));
    tags.push(
      property('og:image:type', 'image/png'),
      property('og:image:width', String(size.width)),
      property('og:image:height', String(size.height)),
      property('og:image:alt', social.alt),
      named('twitter:card', 'summary_large_image'),
      named('twitter:image', image),
      named('twitter:image:alt', social.alt),
    );
  } else {
    tags.push(named('twitter:card', 'summary'));
  }
  return tags;
}
