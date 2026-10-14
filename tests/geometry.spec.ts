import { expect, test } from '@playwright/test';
import { jump, ready, renderedIds } from './helpers';

const scenes = [
  { name: 'desktop-light', width: 1440, height: 900, theme: 'light', mode: 'present' },
  { name: 'desktop-dark', width: 1440, height: 900, theme: 'dark', mode: 'present' },
  { name: 'projector-light', width: 1280, height: 720, theme: 'light', mode: 'present' },
  { name: 'projector-dark', width: 1280, height: 720, theme: 'dark', mode: 'present' },
  { name: 'wide-centered', width: 1920, height: 1000, theme: 'dark', mode: 'present' },
  { name: 'narrow-presentation-light', width: 617, height: 800, theme: 'light', mode: 'present' },
  { name: 'narrow-presentation-dark', width: 617, height: 800, theme: 'dark', mode: 'present' },
  { name: 'desktop-reading', width: 1280, height: 900, theme: 'light', mode: 'read' },
  { name: 'mobile-light', width: 390, height: 844, theme: 'light', mode: 'read' },
  { name: 'mobile-dark', width: 390, height: 844, theme: 'dark', mode: 'read' },
  { name: 'small-mobile', width: 320, height: 568, theme: 'dark', mode: 'read' },
] as const;

for (const scene of scenes) {
  test(`active authored text, code, media and targets fit ${scene.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: scene.width, height: scene.height });
    await ready(page, `?mode=${scene.mode}&theme=${scene.theme}`);
    const ids = await renderedIds(page);
    for (const [index, id] of ids.entries()) {
      if (index > 0) await jump(page, id);
      const errors = await page.locator(`#${id}`).evaluate((slide, mode) => {
        const failures: string[] = [];
        const stage = document.getElementById('presentation')!.getBoundingClientRect();
        const bounds = slide.getBoundingClientRect();
        const compact = document.documentElement.dataset.compact === 'true';
        if (!bounds.width || !bounds.height) return [`${slide.id}: inactive or zero-sized slide was measured`];
        const walker = document.createTreeWalker(slide, NodeFilter.SHOW_TEXT);
        let node: Node | null;
        while ((node = walker.nextNode())) {
          if (!node.textContent?.trim() || !(node.parentElement instanceof HTMLElement)) continue;
          const parent = node.parentElement;
          if (parent.closest('aside.notes, pre, script, style') || parent.closest('.fragment:not(.visible)') && mode === 'present') continue;
          if (getComputedStyle(parent).visibility === 'hidden' || getComputedStyle(parent).display === 'none') continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          for (const rect of range.getClientRects()) {
            if (!rect.width || !rect.height) continue;
            if (rect.left < bounds.left - 1 || rect.right > bounds.right + 1) failures.push(`${slide.id}: horizontal text overflow: ${node.textContent.trim()}`);
            if (mode === 'present' && !compact && (rect.top < stage.top - 1 || rect.bottom > stage.bottom - 8)) failures.push(`${slide.id}: clipped projector text: ${node.textContent.trim()}`);
          }
        }
        for (const image of slide.querySelectorAll('img')) {
          const rect = image.getBoundingClientRect();
          if (!image.complete || !image.naturalWidth) failures.push(`${slide.id}: image did not load`);
          else if (Math.abs(rect.width / rect.height - image.naturalWidth / image.naturalHeight) > 0.02) failures.push(`${slide.id}: distorted image`);
          if (rect.right > bounds.right + 1 || rect.left < bounds.left - 1) failures.push(`${slide.id}: image overflow`);
        }
        for (const target of slide.querySelectorAll('button, a')) {
          const rect = target.getBoundingClientRect();
          if (rect.height < 43.5) failures.push(`${slide.id}: target shorter than 44px: ${target.textContent}`);
        }
        for (const pre of slide.querySelectorAll('pre')) {
          const rect = pre.getBoundingClientRect();
          if (rect.right > bounds.right + 1 || rect.left < bounds.left - 1) failures.push(`${slide.id}: code panel overflow`);
          const font = parseFloat(getComputedStyle(pre).fontSize);
          const scale = mode === 'read' || compact ? 1 : parseFloat(document.documentElement.style.getPropertyValue('--slide-scale'));
          if (font * scale < 16) failures.push(`${slide.id}: code shrank below 16px`);
        }
        return failures;
      }, scene.mode);
      expect(errors, `${scene.name}, ${id}`).toEqual([]);
      if (index === 0 || await page.locator(`#${id} pre`).count() > 0) {
        await page.screenshot({ path: testInfo.outputPath(`${scene.name}-${id}.png`) });
      }
    }
    const controls = await page.locator('#toolbar button, #toolbar .brand-link').evaluateAll((targets) => targets.map((target) => {
      const bounds = target.getBoundingClientRect();
      return { label: target.textContent || target.getAttribute('aria-label'), width: bounds.width, height: bounds.height };
    }));
    expect(controls.every((target) => target.width >= 44 && target.height >= 44)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
