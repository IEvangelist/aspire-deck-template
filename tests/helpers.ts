import { expect, type Frame, type Page, type Request as PlaywrightRequest } from '@playwright/test';

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

// The model behind the diagram tests: an AppHost and a frontend reach an API that reads a cache, with a routed result path.
// Tests serve it as diagrams.json, so they never depend on which diagrams a deck's own diagrams.json defines.
export const architectureDiagram = {
  title: 'A connected application model',
  description: 'The AppHost and frontend connect to the API through separate inbound ports. The API reads from a cache, and a routed result path closes the cycle.',
  width: 1200,
  height: 480,
  nodes: [
    { id: 'model', title: 'AppHost', detail: ['Describe the model'], icon: 'code', x: 40, y: 70, w: 260, h: 110, stage: 0 },
    { id: 'web', title: 'Frontend', detail: ['Make a request'], icon: 'screen', x: 40, y: 300, w: 260, h: 110, stage: 6 },
    { id: 'api', title: 'API', detail: ['Accept requests', 'Use dependencies'], icon: 'cloud', x: 440, y: 180, w: 300, h: 140, stage: 2, kind: 'hub' },
    { id: 'cache', title: 'Cache', detail: ['Keep useful data'], icon: 'database', x: 880, y: 195, w: 280, h: 110, stage: 4 },
  ],
  edges: [
    { id: 'declare', from: 'model', to: 'api', stage: 1, label: 'declares', labelAt: { x: 368, y: 112 }, fromSide: 'right', toSide: 'left' },
    { id: 'request', from: 'web', to: 'api', stage: 7, label: 'request', labelAt: { x: 368, y: 380 }, fromSide: 'right', toSide: 'left' },
    { id: 'read', from: 'api', to: 'cache', stage: 3, label: 'reads', labelAt: { x: 806, y: 229 }, fromSide: 'right', toSide: 'left' },
    { id: 'result', from: 'cache', to: 'api', stage: 5, label: 'result', labelAt: { x: 800, y: 455 }, fromSide: 'bottom', toSide: 'bottom', via: [{ x: 1020, y: 425 }, { x: 590, y: 425 }], kind: 'return' },
  ],
};

export async function authorDiagrams(page: Page, diagrams: Record<string, unknown> = { architecture: architectureDiagram }) {
  await page.route(assetRequest('diagrams.json'), (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(diagrams) }));
}

// A deck.config.json and slides.md for the page, so a test never depends on the intro fields or slides its deck happens to have.
export async function authorDeck(page: Page, config: Record<string, unknown>, markdown: string) {
  await authorMarkdown(page, markdown);
  await page.route(assetRequest('deck.config.json'), (route) => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({ title: 'Fixture deck', presenter: { name: 'Presenter' }, ...config }),
  }));
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
  // When the browser itself cannot make a request (a socket or buffer error on a busy host, say), the page stays unstarted with
  // nothing else to show. The failed requests are named if the deck does not become ready, so that is never mistaken for an app error.
  const unreachable: string[] = [];
  const record = (request: PlaywrightRequest) => {
    const reason = request.failure()?.errorText ?? 'failed';
    if (reason !== 'net::ERR_ABORTED') unreachable.push(`${new URL(request.url()).pathname} (${reason})`);
  };
  page.on('requestfailed', record);
  try {
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('data-deck-ready', 'true');
  } catch (error) {
    if (unreachable.length) throw new Error(`The deck did not start because the browser could not load ${unreachable.join(', ')}.`, { cause: error });
    throw error;
  } finally {
    page.off('requestfailed', record);
  }
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

export async function previewFrame(view: Page, selector: string): Promise<Frame> {
  await expect(view.locator(selector)).toHaveCount(1, { timeout: 20_000 });
  // The popup sees a preview's finished document even when that preview navigates late or reloads. A navigating
  // iframe briefly has a document with no root element yet, so a slow origin must not make this wait throw.
  await view.waitForFunction((css) => document.querySelector<HTMLIFrameElement>(css)?.contentDocument?.documentElement?.dataset.deckReady === 'true', selector, { timeout: 30_000 });
  const frame = await (await view.locator(selector).elementHandle())!.contentFrame();
  if (!frame) throw new Error(`The ${selector} preview has no document.`);
  return frame;
}

// The real Reveal speaker view: a popup window with live current and upcoming previews.
export async function openSpeakerView(page: Page, how: 'key' | 'menu' = 'key') {
  const popup = page.waitForEvent('popup');
  if (how === 'key') await page.keyboard.press('s');
  else {
    await page.locator('#menu-toggle').click();
    await page.locator('#notes').click();
  }
  const view = await popup;
  await view.waitForLoadState('load');
  await expect(view.locator('#connection-status')).toBeHidden({ timeout: 20_000 });
  const current = await previewFrame(view, '#current-slide iframe');
  const upcoming = await previewFrame(view, '#upcoming-slide iframe');
  return { view, current, upcoming };
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
