import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { parseDiagramJson, parseDiagrams } from '../src/diagram-config';
import { diagramConnections } from '../src/diagram-routes';
import { assetRequest, authorMarkdown, jump, ready } from './helpers';

const definitions = parseDiagramJson(readFileSync('diagrams.json', 'utf8'));
const graph = definitions.architecture;

test('empty diagrams are valid and the generic model has distinct ports and a routed return', () => {
  expect(parseDiagrams({})).toEqual({});
  const connections = diagramConnections(graph);
  const inbound = connections.filter((edge) => edge.to === 'api' && edge.from !== 'cache');
  expect(new Set(inbound.map((edge) => edge.end.y)).size).toBe(inbound.length);
  expect(connections.find((edge) => edge.id === 'read')?.stage).toBe(2);
  expect(connections.find((edge) => edge.id === 'result')?.path).toContain('Q');
});

for (const [name, mutate, field] of [
  ['duplicate node', (input: typeof graph) => { input.nodes[1].id = input.nodes[0].id; }, 'duplicates node'],
  ['missing endpoint', (input: typeof graph) => { input.edges[0].to = 'missing'; }, 'missing endpoint'],
  ['invalid stage', (input: typeof graph) => { input.nodes[0].stage = -1; }, 'stage'],
  ['fractional stage', (input: typeof graph) => { input.edges[0].stage = 1.5; }, 'safe integer'],
  ['invalid geometry', (input: typeof graph) => { input.nodes[0].x = -2; }, '.x'],
  ['bounds overflow', (input: typeof graph) => { input.nodes[0].w = 2000; }, 'outside'],
  ['duplicate edge', (input: typeof graph) => { input.edges[1].id = input.edges[0].id; }, 'duplicates edge'],
] as const) {
  test(`diagram validation reports ${name}`, () => {
    const input = structuredClone(graph);
    mutate(input);
    expect(() => parseDiagrams({ architecture: input })).toThrow('diagrams.json:');
    expect(() => parseDiagrams({ architecture: input })).toThrow(field);
  });
}

test('invalid icon and definition types fail with fields', () => {
  expect(() => parseDiagrams({ architecture: { ...graph, nodes: [{ ...graph.nodes[0], icon: 'not-an-icon' }] } })).toThrow('icon');
  expect(() => parseDiagrams({ architecture: [] })).toThrow('architecture');
  expect(() => parseDiagramJson('{')).toThrow('diagrams.json: invalid JSON');
});

test('whole SVG edges await both nodes and rewind; repeated instances have unique IDs', async ({ page }) => {
  await authorMarkdown(page, '<!-- .slide: id="graph-one" -->\n## Model\n<div data-diagram="architecture"></div>\n\n---\n<!-- .slide: id="graph-two" -->\n## Repeat\n<div data-diagram="architecture"></div>');
  await ready(page);
  await jump(page, 'graph-one');
  const graph = page.locator('#graph-one svg.architecture-svg');
  const edges = graph.locator('.graph-edge');
  expect(await edges.evaluateAll((items) => items.every((edge) => edge.closest('.graph-stage')?.classList.contains('fragment')))).toBe(true);
  await expect(graph.locator('[data-node="api"]')).not.toBeVisible();
  await expect(graph.locator('[data-edge="read"]')).not.toBeVisible();
  await page.locator('#next').click();
  await expect(graph.locator('[data-node="api"]')).toBeVisible();
  await expect(graph.locator('[data-edge="read"]')).not.toBeVisible();
  await page.locator('#next').click();
  await expect(graph.locator('[data-node="cache"]')).toBeVisible();
  await expect(graph.locator('[data-edge="read"]')).toBeVisible();
  await expect(graph.locator('[data-edge="read"] .edge-label')).toBeVisible();
  await expect(graph.locator('[data-edge="read"] .edge-path')).toHaveAttribute('marker-end', /url\(#diagram-/);
  await page.locator('#previous').click();
  await expect(graph.locator('[data-edge="read"]')).not.toBeVisible();
  const ids = await page.locator('svg.architecture-svg [id]').evaluateAll((nodes) => nodes.map((node) => node.id));
  expect(new Set(ids).size).toBe(ids.length);
});

test('rich labels fit their padded nodes in both themes without compression', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  await jump(page, 'rich-architecture');
  for (const theme of ['light', 'dark']) {
    if (await page.locator('html').getAttribute('data-theme') !== theme) await page.keyboard.press('t');
    const errors = await page.locator('#rich-architecture svg.architecture-svg').evaluate((svg) => {
      const errors: string[] = [];
      for (const node of svg.querySelectorAll<SVGGElement>('.graph-node')) {
        const rect = node.querySelector('rect')!;
        const width = Number(rect.getAttribute('width'));
        const height = Number(rect.getAttribute('height'));
        for (const label of node.querySelectorAll<SVGTextElement>('text')) {
          const box = label.getBBox();
          if (!box.width || !box.height) errors.push('inactive label');
          if (box.x < 12 || box.x + box.width > width - 12 || box.y < 12 || box.y + box.height > height - 12) errors.push(label.textContent ?? '');
          const expected = label.classList.contains('node-title') ? '22px' : '20px';
          if (getComputedStyle(label).fontSize !== expected) errors.push('compressed font');
        }
      }
      return errors;
    });
    expect(errors).toEqual([]);
  }
});

test('narrow and reading/static layouts retain every same-data node and relationship', async ({ page }) => {
  await page.setViewportSize({ width: 617, height: 800 });
  await ready(page);
  await jump(page, 'rich-architecture');
  await expect(page.locator('#rich-architecture .architecture-svg')).not.toBeVisible();
  await expect(page.locator('#rich-architecture .architecture-mobile')).toBeVisible();
  await page.keyboard.press('r');
  await expect(page.locator('#rich-architecture [data-mobile-node]')).toHaveCount(graph.nodes.length);
  await expect(page.locator('#rich-architecture [data-mobile-edge]')).toHaveCount(graph.edges.length);
  for (const node of graph.nodes) await expect(page.locator(`#rich-architecture [data-mobile-node="${node.id}"]`)).toBeVisible();
  for (const edge of graph.edges) await expect(page.locator(`#rich-architecture [data-mobile-edge="${edge.id}"]`)).toBeVisible();
});

test('undefined diagrams and oversized labels fail visibly instead of dropping content', async ({ page }) => {
  await authorMarkdown(page, '## Missing\n<div data-diagram="missing"></div>');
  await page.goto('/');
  await expect(page.locator('#failure-detail')).toContainText('diagram "missing"');
  const input = structuredClone(graph);
  input.nodes[0].title = 'A very long title that cannot fit inside this node without being compressed';
  await page.route(assetRequest('diagrams.json'), (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ architecture: input }) }));
  await authorMarkdown(page, '## Wide text\n<div data-diagram="architecture"></div>');
  await page.reload();
  await expect(page.locator('#failure-detail')).toContainText('title does not fit');
});
