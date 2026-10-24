import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import hljs from 'highlight.js';
import { description, normalizeBase, parseDeckJson } from './src/config';
import { parseDiagramJson } from './src/diagram-config';
import { checkSocialImage, socialTags, type ImageSize } from './src/social';

function configuration() {
  const config = parseDeckJson(readFileSync(new URL('./deck.config.json', import.meta.url), 'utf8'));
  const avatar = config.presenter.avatar?.src;
  if (avatar && !/^https?:\/\//i.test(avatar) &&
      !existsSync(resolve('public', decodeURIComponent(avatar.replace(/^\//, '').split(/[?#]/)[0])))) {
    throw new Error(`deck.config.json: presenter.avatar.src "${avatar}" does not exist in public/. Add the image or omit avatar.`);
  }
  let size: ImageSize | undefined;
  if (config.social) {
    const file = resolve('public', decodeURIComponent(config.social.image.replace(/^\//, '').split(/[?#]/)[0]));
    if (!existsSync(file)) {
      throw new Error(`deck.config.json: social.image "${config.social.image}" does not exist in public/. Add the PNG or remove the social block.`);
    }
    size = checkSocialImage(readFileSync(file), `deck.config.json: social.image "${config.social.image}"`);
  }
  return { config, size };
}

configuration();
parseDiagramJson(readFileSync(new URL('./diagrams.json', import.meta.url), 'utf8'));
const base = normalizeBase(process.env.PAGES_BASE_PATH);
let canonical: string | undefined;
if (process.env.PAGES_URL) {
  const url = new URL(process.env.PAGES_URL);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('PAGES_URL must be an HTTP(S) site URL without credentials, query, or fragment.');
  }
  canonical = `${url.href.replace(/\/+$/, '')}/`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]!);
}

function languageMetadata() {
  const aliases: Record<string, string> = {};
  const requirements: Record<string, string[]> = {};
  const embedded: Record<string, string[]> = {};
  for (const name of hljs.listLanguages()) {
    const language = hljs.getLanguage(name)!;
    for (const alias of [name, ...(language.aliases ?? [])]) aliases[alias.toLowerCase()] = name;
  }
  function canonical(values: unknown): string[] {
    if (!Array.isArray(values)) return [];
    return [...new Set(values.filter((value): value is string => typeof value === 'string')
      .map((value) => aliases[value.toLowerCase()]).filter(Boolean))];
  }
  for (const name of hljs.listLanguages()) {
    const language = hljs.getLanguage(name)!;
    requirements[name] = canonical(Reflect.get(language, 'requires'));
    const dependencies = new Set<string>();
    const visited = new WeakSet<object>();
    function visit(value: unknown) {
      if (!value || typeof value !== 'object' || visited.has(value)) return;
      visited.add(value);
      if ('subLanguage' in value) {
        const sub = value.subLanguage;
        for (const dependency of canonical(typeof sub === 'string' ? [sub] : sub)) dependencies.add(dependency);
      }
      for (const child of Object.values(value)) visit(child);
    }
    visit(language);
    embedded[name] = [...dependencies].filter((dependency) => dependency !== name);
  }
  return { aliases, requirements, embedded };
}

export default defineConfig({
  base,
  build: { target: 'es2022', sourcemap: false },
  plugins: [{
    name: 'highlight-language-metadata',
    resolveId(id) {
      if (id === 'virtual:highlight-languages') return '\0virtual:highlight-languages';
    },
    load(id) {
      if (id === '\0virtual:highlight-languages') {
        return Object.entries(languageMetadata()).map(([name, value]) => `export const ${name} = ${JSON.stringify(value)};`).join('\n');
      }
    },
  }, {
    name: 'deck-metadata',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const { config, size } = configuration();
        return {
          html: html.replace('<title>Aspire presentation</title>', `<title>${escapeHtml(config.title)}</title>`),
          tags: [
            { tag: 'meta', attrs: { name: 'description', content: description(config) } },
            { tag: 'meta', attrs: { name: 'author', content: config.presenter.name } },
            ...socialTags(config, canonical, size),
            ...(canonical ? [{ tag: 'link', attrs: { rel: 'canonical', href: canonical } }] : []),
          ],
        };
      },
    },
  }],
});
