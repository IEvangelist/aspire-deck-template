import {
  checkSpeed, checkStyle,
  type ChapterTransition, type TransitionDefaults, type TransitionStyle,
} from './transitions';

export interface DeckLink {
  label: string;
  url: string;
}

export interface DeckSocial {
  image: string;
  alt: string;
  title?: string;
  description?: string;
  siteName?: string;
}

export const slideNumberPositions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;
export type SlideNumberPosition = typeof slideNumberPositions[number];

export interface SlideNumber {
  visible: boolean;
  position: SlideNumberPosition;
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
  transition: TransitionDefaults;
  chapters: Record<string, ChapterTransition>;
  slideNumber: SlideNumber;
  social?: DeckSocial;
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

// The deck default is Reveal's own single transition, so only a chapter may use an in/out pair.
function transitionSettings(value: unknown, field: string, pair: boolean): ChapterTransition {
  const settings: ChapterTransition = {};
  const input = object(value, field, ['style', 'speed', 'background']);
  const where = (key: string) => `deck.config.json: ${field}.${key}`;
  if (input.style !== undefined) settings.style = checkStyle(requiredText(input.style, `${field}.style`), where('style'), pair);
  if (input.speed !== undefined) settings.speed = checkSpeed(requiredText(input.speed, `${field}.speed`), where('speed'));
  if (input.background !== undefined) {
    settings.background = checkStyle(requiredText(input.background, `${field}.background`), where('background'), false) as TransitionStyle;
  }
  return settings;
}

// Each chapter is a named set of transition settings. A slide begins it with data-chapter, so what a chapter covers
// lives beside the slides and a definition that no slide uses does no harm.
function parseChapters(value: unknown): Record<string, ChapterTransition> {
  const chapters: Record<string, ChapterTransition> = {};
  if (value === undefined) return chapters;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    invalid('chapters', 'must be an object that names each chapter, such as { "code": { "style": "slide" } }.');
  }
  for (const [id, entry] of Object.entries(value)) {
    if (!/^[a-z][a-z\d_-]*$/i.test(id)) {
      invalid(`chapters.${id}`, 'is not a valid chapter id. Use letters, numbers, - or _, starting with a letter.');
    }
    chapters[id] = transitionSettings(entry, `chapters.${id}`, true);
  }
  return chapters;
}

// The slide counter is a badge in one corner. Left out, it is visible at the bottom left.
function parseSlideNumber(value: unknown): SlideNumber {
  const settings: SlideNumber = { visible: true, position: 'bottom-left' };
  if (value === undefined) return settings;
  const input = object(value, 'slideNumber', ['visible', 'position']);
  if (input.visible !== undefined) {
    if (typeof input.visible !== 'boolean') invalid('slideNumber.visible', 'must be true or false.');
    settings.visible = input.visible;
  }
  if (input.position !== undefined) {
    const position = slideNumberPositions.find((known) => known === input.position);
    if (!position) invalid('slideNumber.position', `must be one of ${slideNumberPositions.join(', ')}.`);
    settings.position = position;
  }
  return settings;
}

export function parseDeckConfig(value: unknown): DeckConfig {
  const config = object(value, 'config', ['title', 'subtitle', 'description', 'presenter', 'event', 'links', 'transition', 'chapters', 'slideNumber', 'social']);
  const presenter = object(config.presenter, 'presenter', ['name', 'role', 'organization', 'avatar']);
  let social: DeckConfig['social'];
  if (config.social !== undefined) {
    const input = object(config.social, 'social', ['image', 'alt', 'title', 'description', 'siteName']);
    const image = requiredText(input.image, 'social.image');
    if (/^[a-z][a-z\d+.-]*:|^\/\//i.test(image)) {
      invalid('social.image', 'must be a PNG path relative to public/, such as assets/social-card.png. Remote images are not supported.');
    }
    validateMediaUrl(image, 'deck.config.json: social.image');
    if (!/\.png$/i.test(image.split(/[?#]/)[0])) invalid('social.image', 'must be a .png file.');
    const alt = requiredText(input.alt, 'social.alt');
    if (alt.length > 420) invalid('social.alt', 'must be 420 characters or fewer.');
    social = {
      image, alt,
      title: text(input.title, 'social.title'),
      description: text(input.description, 'social.description'),
      siteName: text(input.siteName, 'social.siteName'),
    };
  }
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
    transition: config.transition === undefined ? {} : transitionSettings(config.transition, 'transition', false) as TransitionDefaults,
    chapters: parseChapters(config.chapters),
    slideNumber: parseSlideNumber(config.slideNumber),
    social,
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
