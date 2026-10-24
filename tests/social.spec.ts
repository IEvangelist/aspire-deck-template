import { expect, test } from '@playwright/test';
import { parseDeckConfig } from '../src/config';
import { checkSocialImage, socialTags } from '../src/social';

const minimal = { title: 'A talk', presenter: { name: 'A presenter' } };
const social = { image: 'assets/social-card.png', alt: 'A card that says hello' };

// A valid PNG signature and IHDR chunk with the given size, padded to the requested length.
function png(width: number, height: number, length = 33) {
  const bytes = Buffer.alloc(Math.max(length, 33));
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes);
  bytes.writeUInt32BE(13, 8);
  bytes.write('IHDR', 12, 'ascii');
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return new Uint8Array(bytes);
}

const tagMap = (tags: ReturnType<typeof socialTags>) => Object.fromEntries(tags.map((tag) => [tag.attrs.property ?? tag.attrs.name, tag.attrs.content]));

test.describe('the optional social block in deck.config.json', () => {
  test('is optional, and a deck without it has no share image', () => {
    expect(parseDeckConfig(minimal).social).toBeUndefined();
  });

  test('takes a PNG path relative to public/ with its alt text, and optional title, description and site name', () => {
    expect(parseDeckConfig({ ...minimal, social }).social).toEqual({ ...social, title: undefined, description: undefined, siteName: undefined });
    expect(parseDeckConfig({ ...minimal, social: { ...social, title: ' T ', description: 'D', siteName: 'S' } }).social)
      .toMatchObject({ title: 'T', description: 'D', siteName: 'S' });
  });

  const invalid: [string, Record<string, unknown>, string][] = [
    ['a missing alt text', { image: 'assets/card.png' }, 'social.alt must be a string'],
    ['a missing image', { alt: 'Text' }, 'social.image must be a string'],
    ['a remote image', { ...social, image: 'https://example.com/card.png' }, 'social.image must be a PNG path relative to public/'],
    ['a protocol-relative image', { ...social, image: '//example.com/card.png' }, 'social.image must be a PNG path relative to public/'],
    ['a JPEG', { ...social, image: 'assets/card.jpg' }, 'social.image must be a .png file.'],
    ['a path outside public', { ...social, image: '../card.png' }, 'social.image: use a path relative to public/'],
    ['a public/ prefix', { ...social, image: 'public/assets/card.png' }, 'social.image: use a path relative to public/'],
    ['alt text that is too long', { ...social, alt: 'x'.repeat(421) }, 'social.alt must be 420 characters or fewer.'],
    ['an unknown field', { ...social, width: 1200 }, 'social.width is not a supported field'],
  ];
  for (const [name, value, message] of invalid) {
    test(`rejects ${name}`, () => {
      expect(() => parseDeckConfig({ ...minimal, social: value })).toThrow(message);
    });
  }
});

test.describe('the share image itself', () => {
  test('is read for its real size, so the tags state what the file is', () => {
    expect(checkSocialImage(png(1200, 630), 'image')).toEqual({ width: 1200, height: 630 });
    expect(checkSocialImage(png(600, 315), 'image')).toEqual({ width: 600, height: 315 });
  });

  test('must be a PNG, at least 600 x 315, and under 5 MB', () => {
    expect(() => checkSocialImage(new Uint8Array(40), 'image')).toThrow('image must be a PNG image.');
    expect(() => checkSocialImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(40).fill(0)]), 'image')).toThrow('image must be a PNG image.');
    expect(() => checkSocialImage(png(599, 315), 'image')).toThrow('image is 599x315. Use at least 600x315; 1200x630 is ideal.');
    expect(() => checkSocialImage(png(600, 314), 'image')).toThrow('image is 600x314');
    expect(() => checkSocialImage(png(1200, 630, 5 * 1024 * 1024 + 1), 'image')).toThrow('Keep it under 5 MB.');
  });
});

test.describe('the Open Graph and Twitter tags', () => {
  const config = parseDeckConfig({ ...minimal, description: 'The deck summary', social: { ...social, title: 'Share title', description: 'Share summary', siteName: 'Example site' } });
  const size = { width: 1200, height: 630 };

  test('describe the image absolutely, under the site\'s base path, once the site URL is known', () => {
    const tags = tagMap(socialTags(config, 'https://owner.github.io/another-name/', size));
    expect(tags).toMatchObject({
      'og:title': 'Share title', 'og:description': 'Share summary', 'og:type': 'website', 'og:locale': 'en_US', 'og:site_name': 'Example site',
      'og:url': 'https://owner.github.io/another-name/',
      'og:image': 'https://owner.github.io/another-name/assets/social-card.png',
      'og:image:secure_url': 'https://owner.github.io/another-name/assets/social-card.png',
      'og:image:type': 'image/png', 'og:image:width': '1200', 'og:image:height': '630', 'og:image:alt': social.alt,
      'twitter:card': 'summary_large_image', 'twitter:title': 'Share title', 'twitter:description': 'Share summary',
      'twitter:image': 'https://owner.github.io/another-name/assets/social-card.png', 'twitter:image:alt': social.alt,
    });
  });

  test('add no secure_url for an http site, and accept a leading slash in the path', () => {
    const tags = tagMap(socialTags(parseDeckConfig({ ...minimal, social: { ...social, image: '/assets/social-card.png' } }), 'http://localhost:4000/deck/', size));
    expect(tags['og:image']).toBe('http://localhost:4000/deck/assets/social-card.png');
    expect(tags['og:image:secure_url']).toBeUndefined();
    expect(tags['twitter:card']).toBe('summary_large_image');
  });

  test('stay a text-only summary card when the site URL is unknown, since an image needs an absolute URL', () => {
    const tags = tagMap(socialTags(config, undefined, size));
    expect(tags['twitter:card']).toBe('summary');
    expect(Object.keys(tags).filter((key) => /image/.test(key))).toEqual([]);
    expect(tags['og:url']).toBeUndefined();
    expect(tags['og:title']).toBe('Share title');
  });

  test('stay a text-only summary card without a social block, and use the deck title and description', () => {
    const tags = tagMap(socialTags(parseDeckConfig({ ...minimal, description: 'The deck summary' }), 'https://owner.github.io/deck/', undefined));
    expect(tags).toMatchObject({ 'og:title': 'A talk', 'og:description': 'The deck summary', 'twitter:card': 'summary', 'twitter:title': 'A talk', 'og:locale': 'en_US' });
    expect(Object.keys(tags).filter((key) => /image|site_name/.test(key))).toEqual([]);
  });
});
