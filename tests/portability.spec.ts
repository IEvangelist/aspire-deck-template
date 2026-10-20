import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { build, preview, type PreviewServer } from 'vite';
import { parseDeckJson } from '../src/config';
import { exampleMarkdown, paintedFonts } from './helpers';

for (const base of ['/', '/another-name/']) {
  test(`production authoring assets, navigation and canonical metadata at ${base}`, async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    const outDir = testInfo.outputPath('site');
    const oldBase = process.env.PAGES_BASE_PATH;
    const oldUrl = process.env.PAGES_URL;
    const canonical = `https://presentations.example${base}`;
    let server: PreviewServer | undefined;
    try {
      process.env.PAGES_BASE_PATH = base;
      process.env.PAGES_URL = canonical;
      await build({ build: { outDir }, logLevel: 'error' });
      server = await preview({
        configFile: false, base, build: { outDir },
        preview: { host: '127.0.0.1', port: 0, strictPort: true },
      });
      const address = server.httpServer.address();
      if (!address || typeof address === 'string') throw new Error('Preview did not bind an isolated port.');
      const origin = `http://127.0.0.1:${address.port}`;
      const failures: string[] = [];
      const requests: string[] = [];
      page.on('request', (request) => requests.push(request.url()));
      page.on('pageerror', (error) => failures.push(error.message));
      page.on('requestfailed', (request) => failures.push(request.url()));
      page.on('response', (response) => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
      const config = parseDeckJson(readFileSync('deck.config.json', 'utf8'));
      await page.route(/\/assets\/deck\.config-[^/]+\.json$/, (route) => route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          ...config,
          presenter: { ...config.presenter, avatar: { src: 'brand/aspire-icon-256.svg', alt: 'Portable image test' } },
        }),
      }));
      await page.route(/\/assets\/slides-[^/]+\.md$/, (route) => route.fulfill({
        contentType: 'text/markdown',
        body: `${exampleMarkdown}\n---\n## Python on Pages\n\n\`\`\`py\nprint("portable")\n\`\`\`\n\n---\n## Rust on Pages\n\n\`\`\`rs\nfn main() { println!("portable"); }\n\`\`\`\n\n---\n## SQL on Pages\n\n\`\`\`sql\nSELECT title FROM talks;\n\`\`\`\n\n---\n## Rich model on Pages\n<div data-diagram="architecture"></div>\n\n---\n<!-- .slide: id="portable-preset" class="layout-split" -->\n## Portable evidence\n<div class="layout-copy"><p>Content stays in Markdown.</p><p><span data-icon="rocket"></span> Launch <span data-icon="copilot-48"></span> Copilot</p></div>\n<figure class="layout-visual"><img src="brand/aspire-icon-256.svg" alt="Official Aspire mark"><figcaption class="layout-caption">A visible caption.</figcaption></figure>\n`,
      }));
      const response = await page.goto(`${origin}${base}?mode=present`);
      const html = await response!.text();
      expect(html).toContain(`href="${canonical}"`);
      await expect(page.locator('html')).toHaveAttribute('data-deck-ready', 'true');
      await page.evaluate(() => document.fonts.ready);
      await expect(page).toHaveTitle(config.title);
      const headingFonts = await paintedFonts(page, '#intro h1');
      expect(headingFonts.every((font) => font.isCustomFont && font.postScriptName === 'Poppins-Bold')).toBe(true);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);
      await expect(page.locator('.presenter-avatar')).toHaveAttribute('src', `${origin}${base}brand/aspire-icon-256.svg`);
      const assets = await page.locator('img').evaluateAll((images) => images.map((image) => {
        if (!(image instanceof HTMLImageElement)) throw new Error('Expected an image element.');
        return { url: image.src, loaded: image.complete && image.naturalWidth > 0 };
      }));
      expect(assets.every((asset) => asset.loaded && asset.url.startsWith(`${origin}${base}`))).toBe(true);
      expect(await page.evaluate(() => document.fonts.check('600 32px Poppins'))).toBe(true);
      expect(await page.evaluate(() => document.fonts.check('400 24px "Fira Code"'))).toBe(true);
      const fonts = await page.evaluate(() => [...document.fonts]
        .filter((font) => font.family.replace(/["']/g, '') === 'Fira Code' && font.status === 'loaded')
        .map((font) => font.weight));
      expect(fonts).toContain('400');
      await expect(page.locator('pre code').first()).toHaveCSS('font-family', /Fira Code/);
      for (const language of ['python', 'rust', 'sql']) {
        const code = page.locator(`code[data-language="${language}"]`);
        await expect(code).toHaveCount(1);
        await expect(code.locator('span')).not.toHaveCount(0);
      }
      await expect(page.locator('svg.architecture-svg')).toHaveCount(1);
      await expect(page.locator('svg.architecture-svg .graph-edge')).toHaveCount(4);
      await expect(page.locator('#intro .lede')).toHaveCount(0);
      await expect(page.locator('#portable-preset')).toHaveClass(/layout-split/);
      await expect(page.locator('#portable-preset img')).toHaveAttribute('src', `${origin}${base}brand/aspire-icon-256.svg`);
      for (const variant of ['rocket-24', 'copilot-48']) {
        await expect(page.locator(`#portable-preset [data-icon-variant="${variant}"] svg`)).toHaveCount(1);
        expect(requests.some((url) => url.startsWith(`${origin}${base}assets/${variant}-`) && url.endsWith('.js'))).toBe(true);
      }
      expect(readdirSync(join(outDir, 'assets')).some((name) => name.startsWith('beaker-24-') && name.endsWith('.js'))).toBe(true);
      expect(requests.some((url) => url.includes('/beaker-24-'))).toBe(false);
      const count = await page.locator('#slide-list a').count();
      await expect(page.locator('#slide-position')).toHaveText(`1 / ${count}`);
      const first = await page.locator('#slide-list a').nth(1).getAttribute('data-slide');
      await page.locator('#start-presentation').click();
      await expect(page.locator('#slide-position')).toHaveText(`2 / ${count}`);
      expect(new URL(page.url()).hash).toBe(`#/${first}`);
      await page.locator('#menu-toggle').click();
      await page.locator('#slide-list [data-slide="code-example"]').click();
      const codeFonts = await paintedFonts(page, '#code-example pre code');
      expect(codeFonts.every((font) => font.isCustomFont && font.postScriptName.startsWith('FiraCode'))).toBe(true);
      await page.locator('#menu-toggle').click();
      const last = await page.locator('#slide-list a').last().getAttribute('data-slide');
      await page.locator('#slide-list a').last().click();
      await expect(page.locator('#slide-position')).toHaveText(`${count} / ${count}`);
      expect(new URL(page.url()).hash).toBe(`#/${last}`);
      await page.locator('#menu-toggle').click();
      expect(await page.locator('#print-link').getAttribute('href')).toMatch(new RegExp(`${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\?[^#]*print-pdf`));
      for (const file of ['Poppins-OFL.txt', 'FiraCode-OFL.txt', 'aspire-brand-CC0.txt', 'revealjs-MIT.txt', 'highlightjs-BSD.txt', 'octicons-MIT.txt']) {
        expect((await page.request.get(`${origin}${base}licenses/${file}`)).ok()).toBe(true);
      }
      expect(failures).toEqual([]);
    } finally {
      if (oldBase === undefined) delete process.env.PAGES_BASE_PATH;
      else process.env.PAGES_BASE_PATH = oldBase;
      if (oldUrl === undefined) delete process.env.PAGES_URL;
      else process.env.PAGES_URL = oldUrl;
      if (server) await new Promise<void>((resolve, reject) => server!.httpServer.close((error) => error ? reject(error) : resolve()));
    }
  });
}
