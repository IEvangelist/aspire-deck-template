export const iconNames = [
  'arrowLeft', 'arrowRight', 'book', 'cloud', 'code', 'copy', 'database', 'file',
  'graph', 'github', 'link', 'menu', 'moon', 'screen', 'sun', 'terminal', 'close',
] as const;

export type IconName = typeof iconNames[number];

export function isIconName(value: unknown): value is IconName {
  return iconNames.some((name) => name === value);
}
