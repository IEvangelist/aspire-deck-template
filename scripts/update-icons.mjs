import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const packageRoot = new URL('../node_modules/@primer/octicons/', import.meta.url);
const { version } = JSON.parse(readFileSync(new URL('package.json', packageRoot), 'utf8'));
const variants = readdirSync(new URL('build/svg/', packageRoot))
  .filter((file) => file.endsWith('.svg'))
  .map((file) => file.slice(0, -4))
  .sort();
const names = new Map();
for (const variant of variants) {
  const match = /^(.*)-(\d+)$/.exec(variant);
  if (!match) throw new Error(`Unexpected Octicons filename: ${variant}.svg`);
  const [, name, size] = match;
  if (!names.has(name)) names.set(name, []);
  names.get(name).push(Number(size));
}
const preferred = [...names].map(([name, sizes]) => {
  const size = sizes.includes(24) ? 24 : sizes.includes(16) ? 16 : Math.min(...sizes);
  return `  '${name}': '${name}-${size}',`;
});
const rows = [];
for (let index = 0; index < variants.length; index += 5) {
  rows.push(`  ${variants.slice(index, index + 5).map((name) => `'${name}'`).join(', ')},`);
}
const output = `// Generated from @primer/octicons ${version} by npm run icons:update. Do not edit by hand.
export const iconCatalog = {
${preferred.join('\n')}
} as const;

export const iconVariants = [
${rows.join('\n')}
] as const;
`;
writeFileSync(new URL('../src/icon-catalog.ts', import.meta.url), output);
console.log(`Updated ${names.size} icon names and ${variants.length} variants.`);
