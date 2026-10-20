import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { authorMarkdown, captureClipboard, expectCopied, jump, ready } from './helpers';

test('prose and all code roles use the requested self-hosted font families', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await ready(page);
  const faces = await page.evaluate(() => [...document.fonts]
    .filter((font) => font.status === 'loaded')
    .map((font) => ({ family: font.family.replace(/["']/g, ''), weight: font.weight })));
  expect(faces).toContainEqual({ family: 'Poppins', weight: '400' });
  expect(faces).toContainEqual({ family: 'Poppins', weight: '600' });
  expect(faces).toContainEqual({ family: 'Fira Code', weight: '400' });
  expect(faces).toContainEqual({ family: 'Fira Code', weight: '500' });
  for (const selector of ['body', '#intro h1', '.presenter-role', '#toolbar button']) {
    await expect(page.locator(selector).first()).toHaveCSS('font-family', /^Poppins,/);
  }
  await jump(page, 'copyable-code');
  for (const selector of ['pre', 'pre code', 'figcaption > span']) {
    await expect(page.locator(`#copyable-code ${selector}`)).toHaveCSS('font-family', /^"Fira Code",/);
  }
  await expect(page.locator('#copyable-code .copy-code')).toHaveCSS('font-family', /^Poppins,/);
  await page.locator('#menu-toggle').click();
  await expect(page.locator('.menu-controls kbd').first()).toHaveCSS('font-family', /^"Fira Code",/);
  const fonts = requests.filter((url) => /\.(woff2?)(?:\?|$)/.test(url));
  expect(fonts.some((url) => url.includes('fira-code-latin-400'))).toBe(true);
  expect(fonts.every((url) => new URL(url).origin === new URL(page.url()).origin)).toBe(true);
  expect(requests.some((url) => /fonts\.(googleapis|gstatic)\.com/.test(url))).toBe(false);
});

test('reference-informed shell keeps pill actions, soft surfaces and accessible targets in both themes', async ({ page }) => {
  await ready(page);
  for (const theme of ['light', 'dark']) {
    await page.locator('#presentation').focus();
    if (await page.locator('html').getAttribute('data-theme') !== theme) await page.keyboard.press('t');
    for (const selector of ['#next', '#menu-toggle', '#start-presentation']) {
      await expect(page.locator(selector)).toHaveCSS('border-radius', '999px');
    }
    await expect(page.locator('#toolbar')).toHaveCSS('height', '56px');
    const audience = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(audience.violations).toEqual([]);
    await page.locator('#menu-toggle').click();
    await expect(page.locator('#deck-menu')).toHaveCSS('border-radius', '24px');
    await expect(page.locator('#deck-menu')).not.toHaveCSS('box-shadow', 'none');
    const menu = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(menu.violations).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(page.locator('#menu-toggle')).toBeFocused();
  }
});

test('Fira Code ligatures never alter copyable source or code contrast', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await captureClipboard(page);
  await authorMarkdown(page, '<!-- .slide: id="font-code" -->\n## Literal operators\n\n`value !== null`\n\n```typescript\nconst ready = count >= 2 && value !== null;\nconst next = (n: number) => n + 1;\n```\n<!-- .element: data-caption="example.ts" -->');
  await ready(page);
  await jump(page, 'font-code');
  await expect(page.locator('#font-code p code')).toHaveCSS('font-family', /^"Fira Code",/);
  const code = page.locator('#font-code pre code');
  const source = await code.textContent();
  await page.locator('#font-code .copy-code').click();
  await expectCopied(page, source);
  for (const theme of ['light', 'dark']) {
    await page.locator('#presentation').focus();
    if (await page.locator('html').getAttribute('data-theme') !== theme) await page.keyboard.press('t');
    const audit = await new AxeBuilder({ page }).include('#font-code').withRules(['color-contrast']).analyze();
    expect(audit.violations).toEqual([]);
    await expect(page.locator('#font-code .code-panel')).toHaveCSS('border-radius', '22px');
  }
});

test('reduced transparency provides a solid readable toolbar without blur', async ({ page }) => {
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }],
  });
  await ready(page);
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-transparency: reduce)').matches)).toBe(true);
  await expect(page.locator('#toolbar')).toHaveCSS('backdrop-filter', 'none');
  await expect(page.locator('#toolbar')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
});

test('print retains Fira Code with light readable colors and complete code bodies', async ({ page }) => {
  await ready(page, '?print-pdf&theme=dark');
  await page.locator('.pdf-page').first().waitFor({ state: 'attached' });
  await page.emulateMedia({ media: 'print' });
  const code = page.locator('pre code').first();
  await expect(code).toHaveCSS('font-family', /^"Fira Code",/);
  await expect(code).toHaveCSS('color', 'rgb(31, 30, 51)');
  await expect(page.locator('pre').first()).toHaveCSS('max-height', 'none');
  await expect(page.locator('#toolbar')).not.toBeVisible();
});
