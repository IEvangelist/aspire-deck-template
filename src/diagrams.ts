import { iconElement, loadIcons } from './icons';
import type { Diagram, Diagrams } from './diagram-config';
import { diagramConnections } from './diagram-routes';

function escape(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]!);
}

function checkText(diagram: Diagram, key: string) {
  const context = document.createElement('canvas').getContext('2d');
  if (!context) throw new Error('diagrams.json: text measurement is unavailable.');
  for (const node of diagram.nodes) {
    context.font = '600 22px Poppins';
    if (context.measureText(node.title).width > node.w - 72) {
      throw new Error(`diagrams.json: ${key}.node "${node.id}" title does not fit at 22px with icon/padding. Increase w or shorten the title.`);
    }
    context.font = '400 20px Poppins';
    for (const [index, line] of node.detail.entries()) if (context.measureText(line).width > node.w - 36) {
      throw new Error(`diagrams.json: ${key}.node "${node.id}" detail[${index}] does not fit at 20px. Split detail into lines or increase w.`);
    }
  }
  context.font = '400 20px Poppins';
  for (const edge of diagramConnections(diagram)) if (edge.label) {
    const width = context.measureText(edge.label).width / 2 + 6;
    if (edge.labelAt.x - width < 0 || edge.labelAt.x + width > diagram.width || edge.labelAt.y < 24 || edge.labelAt.y + 8 > diagram.height) {
      throw new Error(`diagrams.json: ${key}.edge "${edge.id}" label needs a padded labelAt inside the diagram bounds.`);
    }
  }
}

const fragment = (stage: number) => stage > 0 ? `class="graph-stage fragment" data-fragment-index="${stage - 1}"` : 'class="graph-stage"';
let instances = 0;

export async function renderDiagrams(definitions: Diagrams, scope: ParentNode = document) {
  for (const mount of scope.querySelectorAll<HTMLElement>('[data-diagram]')) {
    const key = mount.dataset.diagram ?? '';
    if (!Object.hasOwn(definitions, key)) throw new Error(`slides.md: diagram "${key}" is not defined in diagrams.json.`);
    const diagram = definitions[key];
    checkText(diagram, key);
    await loadIcons(['arrowRight', ...diagram.nodes.map((node) => node.icon)]);
    const prefix = `diagram-${++instances}-${key}`;
    const connections = diagramConnections(diagram);
    const stages = [...new Set([0, ...diagram.nodes.map((node) => node.stage), ...connections.map((edge) => edge.stage)])].sort((a, b) => a - b);
    const markup = stages.map((stage) => {
      const edges = connections.filter((edge) => edge.stage === stage).map((edge) => `
        <g class="graph-edge ${edge.kind ?? ''}" data-edge="${edge.id}" data-from="${edge.from}" data-to="${edge.to}" data-effective-stage="${stage}">
          <defs><marker id="${prefix}-${edge.id}-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="userSpaceOnUse"><path d="M1 1 L8 5 L1 9" class="arrow-head" /></marker></defs>
          <path class="edge-path" d="${edge.path}" pathLength="1" marker-end="url(#${prefix}-${edge.id}-arrow)" />
          ${edge.label ? `<text class="edge-label" x="${edge.labelAt.x}" y="${edge.labelAt.y}">${escape(edge.label)}</text>` : ''}
        </g>`).join('');
      const nodes = diagram.nodes.filter((node) => node.stage === stage).map((node) => `
        <g class="graph-node ${node.kind ?? ''}" data-node="${node.id}" transform="translate(${node.x} ${node.y})">
          <rect width="${node.w}" height="${node.h}" rx="12" />
          <g transform="translate(18 18)">${iconElement(node.icon).innerHTML}</g>
          <text class="node-title" x="54" y="36">${escape(node.title)}</text>
          ${node.detail.map((line, index) => `<text class="node-detail" x="18" y="${70 + index * 30}">${escape(line)}</text>`).join('')}
        </g>`).join('');
      return `<g ${fragment(stage)} data-stage="${stage}">${edges}${nodes}</g>`;
    }).join('');
    const mobile = stages.map((stage) => {
      const nodes = diagram.nodes.filter((node) => node.stage === stage).map((node) => `<li ${fragment(stage)} data-mobile-node="${node.id}" data-stage="${stage}">
        ${iconElement(node.icon).outerHTML}<div><strong>${escape(node.title)}</strong><p>${escape(node.detail.join('. '))}</p></div>
      </li>`).join('');
      const edges = connections.filter((edge) => edge.stage === stage).map((edge) => `<li ${fragment(stage)} data-mobile-edge="${edge.id}" data-stage="${stage}" data-effective-stage="${stage}">
        <span class="graph-edge-icon">${iconElement('arrowRight').outerHTML}</span><div><strong>${escape(edge.source.title)} to ${escape(edge.target.title)}</strong>${edge.label ? `<p>${escape(edge.label)}</p>` : ''}</div>
      </li>`).join('');
      return `${nodes}${edges}`;
    }).join('');
    mount.innerHTML = `
      <svg class="architecture-svg" data-graph="${key}" viewBox="0 0 ${diagram.width} ${diagram.height}" role="img" aria-labelledby="${prefix}-title ${prefix}-description" xmlns="http://www.w3.org/2000/svg">
        <title id="${prefix}-title">${escape(diagram.title)}</title>
        <desc id="${prefix}-description">${escape(diagram.description)}</desc>
        ${markup}
      </svg>
      <div class="architecture-mobile" role="region" tabindex="0" aria-label="${escape(diagram.title)}: nodes and connections">
        <ol class="graph-node-list">${mobile}</ol>
      </div>`;
    mount.dataset.steps = String(stages.filter((stage) => stage > 0).length);
  }
}
