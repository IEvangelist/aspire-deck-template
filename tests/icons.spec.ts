import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { iconCatalog, iconVariants } from '../src/icon-catalog';
import { iconAliases, isIconName, resolveIconName } from '../src/icon-names';
import { parseDiagrams } from '../src/diagram-config';
import { assetRequest, authorMarkdown, jump, ready } from './helpers';

const directory = join('node_modules', '@primer', 'octicons', 'build', 'svg');
const installed = readdirSync(directory).filter((file) => file.endsWith('.svg')).map((file) => file.slice(0, -4)).sort();

test('generated catalog covers every installed icon and exact size variant', () => {
  expect([...iconVariants]).toEqual(installed);
  const names = [...new Set(installed.map((name) => name.replace(/-\d+$/, '')))];
  expect(Object.keys(iconCatalog)).toEqual(names);
  for (const variant of installed) {
    expect(isIconName(variant), variant).toBe(true);
    expect(resolveIconName(variant)).toBe(variant);
  }
  for (const [name, variant] of Object.entries(iconCatalog)) {
    const sizes = installed.filter((file) => file.replace(/-\d+$/, '') === name)
      .map((file) => Number(file.match(/-(\d+)$/)![1]));
    const preferred = sizes.includes(24) ? 24 : sizes.includes(16) ? 16 : Math.min(...sizes);
    expect(variant).toBe(`${name}-${preferred}`);
    expect(isIconName(name)).toBe(true);
  }
  for (const invalid of ['', '../rocket', 'rocket-99', 'javascript:alert(1)', 'toString', '__proto__', null, 24]) {
    expect(isIconName(invalid)).toBe(false);
    expect(resolveIconName(invalid)).toBeUndefined();
  }
});

test('all existing aliases preserve their exact source artwork', () => {
  const expected = {
    arrowLeft: 'arrow-left-24', arrowRight: 'arrow-right-24', book: 'book-24',
    cloud: 'cloud-24', code: 'code-24', copy: 'copy-24', database: 'database-24',
    file: 'file-code-24', graph: 'graph-24', github: 'mark-github-24',
    link: 'link-external-24', menu: 'three-bars-24', moon: 'moon-24',
    screen: 'device-desktop-24', sun: 'sun-24', terminal: 'terminal-24', close: 'x-24',
  };
  expect(iconAliases).toEqual(expected);
  for (const [name, variant] of Object.entries(expected)) expect(resolveIconName(name)).toBe(variant);
  expect(resolveIconName('file-24')).toBe('file-24');
  expect(resolveIconName('link-24')).toBe('link-24');
});

test('every bundled variant renders the original SVG geometry from native Markdown', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await authorMarkdown(page, `<!-- .slide: id="all-icons" -->\n## Every bundled drawing\n\n<div>${installed.map((name) => `<span data-icon="${name}"></span>`).join('')}</div>`);
  await ready(page);
  const expected = installed.map((name) => ({
    name, svg: readFileSync(join(directory, `${name}.svg`), 'utf8'),
  }));
  const failures = await page.locator('#all-icons').evaluate((slide, examples) => {
    const failures: string[] = [];
    const parser = new DOMParser();
    for (const { name, svg } of examples) {
      const actual = slide.querySelector(`[data-icon="${name}"] svg`);
      const original = parser.parseFromString(svg, 'text/html').querySelector('svg')!;
      if (!actual || actual.getAttribute('viewBox') !== original.getAttribute('viewBox') ||
          actual.innerHTML !== original.innerHTML || actual.getAttribute('aria-hidden') !== 'true') {
        failures.push(name);
      }
    }
    return failures;
  }, expected);
  expect(failures).toEqual([]);
  await expect(page.locator('#all-icons [data-icon] svg')).toHaveCount(installed.length);
  expect(errors).toEqual([]);
});

test('new names work in both Markdown and rich diagram definitions across modes', async ({ page }) => {
  const diagram = {
    title: 'Icon examples', description: 'New icons in reusable diagram nodes.', width: 800, height: 240,
    nodes: [
      { id: 'server', title: 'Server', detail: ['An API'], icon: 'server', x: 20, y: 40, w: 300, h: 110 },
      { id: 'cache', title: 'Cache', detail: ['A dependency'], icon: 'cache-16', x: 480, y: 40, w: 300, h: 110 },
    ],
    edges: [{ id: 'read', from: 'server', to: 'cache' }],
  };
  expect(parseDiagrams({ icons: diagram }).icons.nodes.map((node) => node.icon)).toEqual(['server', 'cache-16']);
  await page.route(assetRequest('diagrams.json'), (route) => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({ icons: diagram }),
  }));
  await authorMarkdown(page, '<!-- .slide: id="new-icons" -->\n## Icon examples\n\n<span data-icon="rocket"></span> Launch\n\n<span data-icon="copilot-48"></span> Copilot\n\n<div data-diagram="icons"></div>');
  await ready(page);
  await jump(page, 'new-icons');
  for (const theme of ['light', 'dark']) {
    if (await page.locator('html').getAttribute('data-theme') !== theme) await page.keyboard.press('t');
    for (const variant of ['rocket-24', 'copilot-48', 'server-24', 'cache-16']) {
      await expect(page.locator(`#new-icons [data-icon-variant="${variant}"] svg`)).toHaveCount(1);
    }
    const ink = await page.locator('body').evaluate((body) => getComputedStyle(body).color);
    await expect(page.locator('#new-icons [data-icon="rocket"] svg')).toHaveCSS('fill', ink);
    await expect(page.locator('#new-icons svg.architecture-svg .graph-node .octicon')).toHaveCount(2);
  }
  await page.setViewportSize({ width: 617, height: 800 });
  await page.keyboard.press('r');
  await expect(page.locator('#new-icons [data-mobile-node="server"] [data-icon-variant="server-24"] svg')).toBeVisible();
  await page.goto('?print-pdf');
  await expect(page.locator('html')).toHaveAttribute('data-deck-ready', 'true');
  await page.locator('.pdf-page').first().waitFor({ state: 'attached' });
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#new-icons [data-icon="rocket"] svg')).toBeVisible();
});

test('unknown Markdown icons fail visibly with the requested name', async ({ page }) => {
  await authorMarkdown(page, '## Bad icon\n\n<span data-icon="not-a-real-icon"></span>');
  await page.goto('/');
  await expect(page.locator('#failure-detail')).toContainText('unknown icon "not-a-real-icon"');
  await expect(page.locator('html')).toHaveAttribute('data-deck-ready', 'error');
});

test('failed icon module loads fail visibly instead of rendering an empty slot', async ({ page }) => {
  await page.route((url) => url.pathname.endsWith('/rocket-24.svg'), (route) => route.abort('failed'));
  await authorMarkdown(page, '## Failed icon\n\n<span data-icon="rocket"></span>');
  await page.goto('/');
  await expect(page.locator('#failure-detail')).toContainText('Could not load icon "rocket-24"');
  await expect(page.locator('html')).toHaveAttribute('data-deck-ready', 'error');
});
