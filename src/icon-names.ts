import { iconCatalog, iconVariants } from './icon-catalog';

export const iconAliases = {
  arrowLeft: 'arrow-left-24',
  arrowRight: 'arrow-right-24',
  book: 'book-24',
  cloud: 'cloud-24',
  code: 'code-24',
  copy: 'copy-24',
  database: 'database-24',
  file: 'file-code-24',
  graph: 'graph-24',
  github: 'mark-github-24',
  link: 'link-external-24',
  menu: 'three-bars-24',
  moon: 'moon-24',
  screen: 'device-desktop-24',
  sun: 'sun-24',
  terminal: 'terminal-24',
  close: 'x-24',
} as const satisfies Record<string, typeof iconVariants[number]>;

export type IconVariant = typeof iconVariants[number];
export type IconName = keyof typeof iconCatalog | IconVariant | keyof typeof iconAliases;

const names = new Map<string, IconVariant>(iconVariants.map((name) => [name, name]));
for (const [name, variant] of Object.entries({ ...iconCatalog, ...iconAliases })) names.set(name, variant);

export function resolveIconName(value: unknown): IconVariant | undefined {
  return typeof value === 'string' ? names.get(value) : undefined;
}

export function isIconName(value: unknown): value is IconName {
  return resolveIconName(value) !== undefined;
}
