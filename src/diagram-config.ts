import { isIconName, type IconName } from './icon-names';

export type Side = 'left' | 'right' | 'top' | 'bottom';
export interface Point { x: number; y: number }
export interface DiagramNode extends Point {
  id: string; title: string; detail: string[]; icon: IconName;
  w: number; h: number; stage: number; kind?: 'hub' | 'gate';
}
export interface DiagramEdge {
  id: string; from: string; to: string; stage: number;
  label?: string; labelAt?: Point; fromSide?: Side; toSide?: Side;
  via: Point[]; kind?: 'return' | 'telemetry' | 'context';
}
export interface Diagram {
  title: string; description: string; width: number; height: number;
  nodes: DiagramNode[]; edges: DiagramEdge[];
}
export type Diagrams = Record<string, Diagram>;

function fail(field: string, message: string): never {
  throw new Error(`diagrams.json: ${field} ${message}`);
}
function object(value: unknown, field: string, keys?: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(field, 'must be an object.');
  if (keys) for (const key of Object.keys(value)) if (!keys.includes(key)) fail(`${field}.${key}`, 'is not supported.');
  return value as Record<string, unknown>;
}
function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) fail(field, 'must be a nonempty string.');
  return value.trim();
}
function id(value: unknown, field: string): string {
  const result = text(value, field);
  if (!/^[a-z][a-z\d_-]*$/i.test(result)) fail(field, 'must start with a letter and contain letters, numbers, - or _.');
  return result;
}
function number(value: unknown, field: string, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) fail(field, `must be a finite number >= ${minimum}.`);
  return value;
}
function stage(value: unknown, field: string): number {
  if (value === undefined) return 0;
  const result = number(value, field);
  if (!Number.isSafeInteger(result)) fail(field, 'must be a nonnegative safe integer.');
  return result;
}
function choice<T extends string>(value: unknown, field: string, values: readonly T[]): T | undefined {
  if (value === undefined) return undefined;
  const match = values.find((candidate) => candidate === value);
  if (!match) fail(field, `must be one of ${values.join(', ')}.`);
  return match;
}
function point(value: unknown, field: string, width: number, height: number): Point {
  const input = object(value, field, ['x', 'y']);
  const result = { x: number(input.x, `${field}.x`), y: number(input.y, `${field}.y`) };
  if (result.x > width || result.y > height) fail(field, 'must be inside the diagram bounds.');
  return result;
}

export function parseDiagrams(value: unknown): Diagrams {
  const input = object(value, 'diagrams');
  const result: Diagrams = {};
  for (const [key, value] of Object.entries(input)) {
    id(key, 'diagram name');
    const graph = object(value, key, ['title', 'description', 'width', 'height', 'nodes', 'edges']);
    const width = number(graph.width, `${key}.width`, 320);
    const height = number(graph.height, `${key}.height`, 160);
    if (width > 1440 || height > 640) fail(key, 'bounds exceed 1440 x 640. Split the graph instead of shrinking its labels.');
    if (!Array.isArray(graph.nodes) || !graph.nodes.length) fail(`${key}.nodes`, 'must be a nonempty array.');
    if (!Array.isArray(graph.edges)) fail(`${key}.edges`, 'must be an array, including [] for no connections.');
    const nodeIds = new Set<string>();
    const nodes = graph.nodes.map((value, index): DiagramNode => {
      const field = `${key}.nodes[${index}]`;
      const node = object(value, field, ['id', 'title', 'detail', 'icon', 'x', 'y', 'w', 'h', 'stage', 'kind']);
      const name = id(node.id, `${field}.id`);
      if (nodeIds.has(name)) fail(`${field}.id`, `duplicates node "${name}".`);
      nodeIds.add(name);
      if (!isIconName(node.icon)) fail(`${field}.icon`, 'is not a supported icon.');
      if (!Array.isArray(node.detail)) fail(`${field}.detail`, 'must be an array of lines; [] is allowed.');
      const detail = node.detail.map((line, index) => text(line, `${field}.detail[${index}]`));
      const x = number(node.x, `${field}.x`);
      const y = number(node.y, `${field}.y`);
      const w = number(node.w, `${field}.w`, 96);
      const h = number(node.h, `${field}.h`, 64 + detail.length * 30);
      if (x + w > width || y + h > height) fail(field, 'extends outside the diagram bounds.');
      return { id: name, title: text(node.title, `${field}.title`), detail, icon: node.icon, x, y, w, h,
        stage: stage(node.stage, `${field}.stage`), kind: choice(node.kind, `${field}.kind`, ['hub', 'gate']) };
    });
    for (const [index, node] of nodes.entries()) for (const other of nodes.slice(index + 1)) {
      if (node.x < other.x + other.w && node.x + node.w > other.x && node.y < other.y + other.h && node.y + node.h > other.y) {
        fail(`${key}.nodes`, `node "${node.id}" overlaps "${other.id}". Move the boxes apart.`);
      }
    }
    const edgeIds = new Set<string>();
    const edges = graph.edges.map((value, index): DiagramEdge => {
      const field = `${key}.edges[${index}]`;
      const edge = object(value, field, ['id', 'from', 'to', 'stage', 'label', 'labelAt', 'fromSide', 'toSide', 'via', 'kind']);
      const name = id(edge.id, `${field}.id`);
      if (edgeIds.has(name)) fail(`${field}.id`, `duplicates edge "${name}".`);
      edgeIds.add(name);
      const from = id(edge.from, `${field}.from`);
      const to = id(edge.to, `${field}.to`);
      if (!nodeIds.has(from) || !nodeIds.has(to)) fail(field, `has a missing endpoint: ${from} -> ${to}.`);
      if (from === to) fail(field, 'self loops require a separate node; use an explicit return route between nodes.');
      if (edge.via !== undefined && !Array.isArray(edge.via)) fail(`${field}.via`, 'must be an array of waypoint objects.');
      const label = edge.label === undefined ? undefined : text(edge.label, `${field}.label`);
      if (edge.labelAt !== undefined && !label) fail(`${field}.labelAt`, 'requires a label.');
      return { id: name, from, to, label, stage: stage(edge.stage, `${field}.stage`),
        labelAt: edge.labelAt === undefined ? undefined : point(edge.labelAt, `${field}.labelAt`, width, height),
        fromSide: choice(edge.fromSide, `${field}.fromSide`, ['left', 'right', 'top', 'bottom']),
        toSide: choice(edge.toSide, `${field}.toSide`, ['left', 'right', 'top', 'bottom']),
        via: (edge.via ?? []).map((value, index) => point(value, `${field}.via[${index}]`, width, height)),
        kind: choice(edge.kind, `${field}.kind`, ['return', 'telemetry', 'context']) };
    });
    result[key] = { title: text(graph.title, `${key}.title`), description: text(graph.description, `${key}.description`), width, height, nodes, edges };
  }
  return result;
}

export function parseDiagramJson(source: string): Diagrams {
  let value: unknown;
  try { value = JSON.parse(source); }
  catch (error) {
    if (error instanceof SyntaxError) throw new Error(`diagrams.json: invalid JSON. ${error.message}`);
    throw error;
  }
  return parseDiagrams(value);
}
