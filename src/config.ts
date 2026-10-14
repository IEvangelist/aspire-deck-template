export interface DeckLink {
  label: string;
  url: string;
}

export interface DeckConfig {
  title: string;
  subtitle?: string;
  description?: string;
  presenter: {
    name: string;
    role?: string;
    organization?: string;
    avatar?: { src: string; alt: string };
  };
  event?: { name?: string; date?: string; location?: string };
  links: DeckLink[];
}

function invalid(field: string, message: string): never {
  throw new Error(`deck.config.json: ${field} ${message}`);
}

function object(value: unknown, field: string, keys: string[]): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    invalid(field, 'must be an object.');
  }
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) invalid(`${field}.${key}`, 'is not a supported field.');
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string, required = false): string | undefined {
  if (value === undefined && !required) return undefined;
  if (typeof value !== 'string') invalid(field, 'must be a string.');
  if (!value.trim()) {
    if (required) invalid(field, 'must not be empty.');
    return undefined;
  }
  return value.trim();
}

function requiredText(value: unknown, field: string): string {
  return text(value, field, true)!;
}

export function validateMediaUrl(value: string, field: string): void {
  if (/[\\\s]/.test(value)) {
    throw new Error(`${field}: use a URL without whitespace or backslashes.`);
  }
  if (/^https?:\/\//i.test(value)) {
    let url: URL;
    try {
      url = new URL(value);
    } catch (error) {
      if (error instanceof TypeError) throw new Error(`${field}: the HTTP(S) image URL is invalid.`);
      throw error;
    }
    if (url.username || url.password) throw new Error(`${field}: URL credentials are not allowed.`);
    return;
  }
  if (/^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith('//')) {
    throw new Error(`${field}: use an HTTP(S) URL or a path relative to public/, such as assets/avatar.webp.`);
  }
  let path: string;
  try {
    path = decodeURIComponent(value.split(/[?#]/)[0]);
  } catch (error) {
    if (error instanceof URIError) throw new Error(`${field}: the path contains invalid URL encoding.`);
    throw error;
  }
  if (!path || path.startsWith('public/') || /[\\:]/.test(path) ||
      path.split('/').some((part) => part === '..' || part === '.')) {
    throw new Error(`${field}: use a path relative to public/, without traversal, such as assets/avatar.webp.`);
  }
}

function linkUrl(value: unknown, field: string): string {
  const source = requiredText(value, field);
  let url: URL;
  try {
    url = new URL(source);
  } catch (error) {
    if (error instanceof TypeError) invalid(field, 'must be an absolute HTTP(S) or mailto URL.');
    throw error;
  }
  if (!['https:', 'http:', 'mailto:'].includes(url.protocol) || url.username || url.password ||
      /[\u0000-\u0020]/.test(source) || (url.protocol === 'mailto:' && !url.pathname)) {
    invalid(field, 'must be an HTTP(S) or mailto URL without credentials or whitespace.');
  }
  return source;
}

export function parseDeckConfig(value: unknown): DeckConfig {
  const config = object(value, 'config', ['title', 'subtitle', 'description', 'presenter', 'event', 'links']);
  const presenter = object(config.presenter, 'presenter', ['name', 'role', 'organization', 'avatar']);
  let avatar: DeckConfig['presenter']['avatar'];
  if (presenter.avatar !== undefined) {
    const input = object(presenter.avatar, 'presenter.avatar', ['src', 'alt']);
    const src = requiredText(input.src, 'presenter.avatar.src');
    validateMediaUrl(src, 'deck.config.json: presenter.avatar.src');
    avatar = { src, alt: requiredText(input.alt, 'presenter.avatar.alt') };
  }
  let event: DeckConfig['event'];
  if (config.event !== undefined) {
    const input = object(config.event, 'event', ['name', 'date', 'location']);
    event = {
      name: text(input.name, 'event.name'),
      date: text(input.date, 'event.date'),
      location: text(input.location, 'event.location'),
    };
  }
  const links: DeckLink[] = [];
  if (config.links !== undefined) {
    if (!Array.isArray(config.links)) invalid('links', 'must be an array; use [] or omit it for no links.');
    for (const [index, value] of config.links.entries()) {
      const input = object(value, `links[${index}]`, ['label', 'url']);
      links.push({
        label: requiredText(input.label, `links[${index}].label`),
        url: linkUrl(input.url, `links[${index}].url`),
      });
    }
  }
  return {
    title: requiredText(config.title, 'title'),
    subtitle: text(config.subtitle, 'subtitle'),
    description: text(config.description, 'description'),
    presenter: {
      name: requiredText(presenter.name, 'presenter.name'),
      role: text(presenter.role, 'presenter.role'),
      organization: text(presenter.organization, 'presenter.organization'),
      avatar,
    },
    event,
    links,
  };
}

export function parseDeckJson(source: string): DeckConfig {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`deck.config.json: invalid JSON. ${error.message}`);
    throw error;
  }
  return parseDeckConfig(value);
}

export function normalizeBase(value = ''): string {
  if (!value) return '/';
  if (!value.startsWith('/') || value.startsWith('//') || /[\\?#\s]/.test(value) ||
      value.split('/').some((part) => part === '..' || part === '.')) {
    throw new Error('PAGES_BASE_PATH must be an absolute URL path, such as /another-name/ or /.');
  }
  return `${value.replace(/\/+$/, '')}/`;
}

export function assetUrl(source: string, base: string, origin: string): string {
  validateMediaUrl(source, 'Media URL');
  return /^https?:\/\//i.test(source)
    ? new URL(source).href
    : new URL(source.replace(/^\/+/, ''), new URL(normalizeBase(base), origin)).href;
}

export function description(config: DeckConfig): string {
  return config.description ?? config.subtitle ?? `${config.title} | ${config.presenter.name}`;
}
