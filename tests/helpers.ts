import { expect, type Page } from '@playwright/test';

export const exampleMarkdown = `<!-- .slide: id="first-idea" -->
## First idea

A readable paragraph with \`an_identifier_that_can_wrap_without_changing_its_value\`.

- First point <!-- .element: class="fragment" -->
- Second point <!-- .element: class="fragment" -->

Note:
Presenter notes for the first idea.

--

<!-- .slide: id="deeper-idea" -->
## A deeper idea

An optional vertical slide.

---

<!-- .slide: id="code-example" -->
## A useful example

\`\`\`typescript
const message = "Hello, presentation";
console.log(message);
\`\`\`
<!-- .element: data-caption="Example code" -->

![Official Aspire mark](brand/aspire-icon-256.svg)
<!-- .element: class="slide-image" -->
`;

export function assetRequest(file: string) {
  return (url: URL) => url.pathname.endsWith(`/${file}`) &&
    !url.searchParams.has('import') && !url.searchParams.has('url');
}

export async function authorMarkdown(page: Page, source = exampleMarkdown) {
  await page.route(assetRequest('slides.md'), (route) => route.fulfill({ contentType: 'text/markdown', body: source }));
}

export async function captureClipboard(page: Page) {
  await page.addInitScript(() => {
    const write = navigator.clipboard.writeText.bind(navigator.clipboard);
    navigator.clipboard.writeText = (value) => {
      document.documentElement.dataset.copiedCode = value;
      return write(value);
    };
  });
}

export async function expectCopied(page: Page, source: string | null) {
  expect(await page.locator('html').getAttribute('data-copied-code')).toBe(source);
  // Windows' native clipboard returns CRLF even when writeText received LF.
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard.replace(/\r\n/g, '\n')).toBe(source?.replace(/\r\n/g, '\n'));
}

export async function ready(page: Page, path = '?mode=present') {
  await page.goto(path);
  await expect(page.locator('html')).toHaveAttribute('data-deck-ready', 'true');
  await page.evaluate(() => document.fonts.ready);
}

export async function paintedFonts(page: Page, selector: string) {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send('DOM.enable');
    await session.send('CSS.enable');
    const { root } = await session.send('DOM.getDocument');
    const { nodeId } = await session.send('DOM.querySelector', { nodeId: root.nodeId, selector });
    expect(nodeId, `${selector} must exist before measuring painted glyphs`).toBeGreaterThan(0);
    const result: { fonts: { postScriptName: string; isCustomFont: boolean; glyphCount: number }[] } =
      await session.send('CSS.getPlatformFontsForNode', { nodeId });
    const fonts = result.fonts.filter((font) => font.glyphCount > 0);
    expect(fonts.length, `${selector} must have actual painted glyphs, not an inactive measurement`).toBeGreaterThan(0);
    return fonts;
  } finally {
    await session.detach();
  }
}

export async function settleMotion(page: Page) {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const animations = document.getElementById('presentation')!.getAnimations({ subtree: true })
      .filter((animation) => animation.playState === 'running' && Number.isFinite(animation.effect?.getComputedTiming().endTime));
    await Promise.all(animations.map((animation) => animation.finished.catch((error: unknown) => {
      if (!(error instanceof DOMException) || error.name !== 'AbortError') throw error;
    })));
  });
}

export async function jump(page: Page, id: string) {
  await page.locator('#menu-toggle').click();
  await page.locator(`#slide-list a[data-slide="${id}"]`).click();
  await expect(page.locator('#deck-menu')).not.toBeVisible();
  await expect(page.locator(`#${id}`)).toBeVisible();
}

export async function renderedIds(page: Page) {
  return page.locator('#slide-list a').evaluateAll((links) => links.map((link) => {
    if (!(link instanceof HTMLAnchorElement) || !link.dataset.slide) throw new Error('Missing slide menu target.');
    return link.dataset.slide;
  }));
}

export interface Contrast {
  text: string;
  ratio: number;
}

// WCAG contrast of what is really painted. Every translucent background from the element up to the page is composited
// over white paper by the canvas, so a transparent layer is never mistaken for black. With `fill`, the element's own
// background (or its pseudo-element's) is the color being measured, against the surface behind it.
export async function contrastOf(page: Page, selector: string, options: { fill?: boolean; pseudo?: string } = {}): Promise<Contrast[]> {
  return page.evaluate(({ css, fill, pseudo }) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    const painted = (colors: string[]) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, 1, 1);
      for (const color of colors) {
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
      }
      return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
    };
    const layers = (start: Element | null) => {
      const found: string[] = [];
      for (let node = start; node; node = node.parentElement) {
        const color = getComputedStyle(node).backgroundColor;
        if (color !== 'transparent' && !/^rgba\([^)]*,\s*0\)$/.test(color)) found.unshift(color);
      }
      return found;
    };
    const luminance = (rgb: number[]) => {
      const [r, g, b] = rgb.map((value) => { const v = value / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    return [...document.querySelectorAll(css)].map((node) => {
      const style = getComputedStyle(node, pseudo ?? null);
      const surface = painted(layers(fill ? node.parentElement : node));
      const foreground = painted([...layers(fill ? node.parentElement : node), fill ? style.backgroundColor : style.color]);
      const [hi, lo] = [luminance(foreground), luminance(surface)].sort((a, b) => b - a);
      return { text: (node.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40) || node.className.toString(), ratio: (hi + 0.05) / (lo + 0.05) };
    });
  }, { css: selector, fill: options.fill ?? false, pseudo: options.pseudo });
}

export function expectContrast(rows: Contrast[], minimum: number, count: number | undefined, label: string) {
  if (count !== undefined) expect(rows.length, `${label}: elements measured`).toBe(count);
  expect(rows.length, `${label}: something was measured`).toBeGreaterThan(0);
  for (const row of rows) expect(row.ratio, `${label}: ${row.text}`).toBeGreaterThanOrEqual(minimum);
}
