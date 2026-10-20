import type { Diagram, DiagramEdge, DiagramNode, Point, Side } from './diagram-config';

const centerX = (node: DiagramNode) => node.x + node.w / 2;
const centerY = (node: DiagramNode) => node.y + node.h / 2;

function sides(source: DiagramNode, target: DiagramNode, edge: DiagramEdge): [Side, Side] {
  const dx = centerX(target) - centerX(source);
  const dy = centerY(target) - centerY(source);
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  return [
    edge.fromSide ?? (horizontal ? dx >= 0 ? 'right' : 'left' : dy >= 0 ? 'bottom' : 'top'),
    edge.toSide ?? (horizontal ? dx >= 0 ? 'left' : 'right' : dy >= 0 ? 'top' : 'bottom'),
  ];
}

function attach(node: DiagramNode, side: Side, index: number, count: number): Point {
  const ratio = (index + 1) / (count + 1);
  return side === 'left' || side === 'right'
    ? { x: node.x + (side === 'right' ? node.w : 0), y: node.y + node.h * ratio }
    : { x: node.x + node.w * ratio, y: node.y + (side === 'bottom' ? node.h : 0) };
}

function route(points: Point[]): string {
  const distinct = points.filter((point, index) => index === 0 || point.x !== points[index - 1].x || point.y !== points[index - 1].y);
  let result = `M${distinct[0].x} ${distinct[0].y}`;
  for (let index = 1; index < distinct.length - 1; index++) {
    const previous = distinct[index - 1], corner = distinct[index], next = distinct[index + 1];
    const before = Math.hypot(corner.x - previous.x, corner.y - previous.y);
    const after = Math.hypot(next.x - corner.x, next.y - corner.y);
    const radius = Math.min(12, before / 2, after / 2);
    const entry = { x: corner.x + (previous.x - corner.x) * radius / before, y: corner.y + (previous.y - corner.y) * radius / before };
    const exit = { x: corner.x + (next.x - corner.x) * radius / after, y: corner.y + (next.y - corner.y) * radius / after };
    result += ` L${entry.x} ${entry.y} Q${corner.x} ${corner.y} ${exit.x} ${exit.y}`;
  }
  const end = distinct.at(-1)!;
  return `${result} L${end.x} ${end.y}`;
}

export function diagramConnections(diagram: Diagram) {
  const nodes = new Map(diagram.nodes.map((node) => [node.id, node]));
  const edges = diagram.edges.map((edge) => {
    const source = nodes.get(edge.from)!;
    const target = nodes.get(edge.to)!;
    return { edge, source, target, sides: sides(source, target, edge) };
  });
  return edges.map(({ edge, source, target, sides: [fromSide, toSide] }) => {
    const outbound = edges.filter((item) => item.edge.from === edge.from && item.sides[0] === fromSide);
    const inbound = edges.filter((item) => item.edge.to === edge.to && item.sides[1] === toSide);
    const start = attach(source, fromSide, outbound.findIndex((item) => item.edge.id === edge.id), outbound.length);
    const end = attach(target, toSide, inbound.findIndex((item) => item.edge.id === edge.id), inbound.length);
    const elbow = fromSide === 'left' || fromSide === 'right'
      ? [{ x: (start.x + end.x) / 2, y: start.y }, { x: (start.x + end.x) / 2, y: end.y }]
      : [{ x: start.x, y: (start.y + end.y) / 2 }, { x: end.x, y: (start.y + end.y) / 2 }];
    return { ...edge, source, target, start, end,
      path: route([start, ...(edge.via.length ? edge.via : elbow), end]),
      stage: Math.max(edge.stage, source.stage),
      labelAt: edge.labelAt ?? { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 - 14 },
    };
  });
}
