import hljs from 'highlight.js/lib/core';
import type { LanguageFn } from 'highlight.js';
import { aliases, requirements, embedded } from 'virtual:highlight-languages';
import { iconElement } from './icons';

const modules = import.meta.glob<{ default: LanguageFn }>([
  '../node_modules/highlight.js/es/languages/*.js',
  '!../node_modules/highlight.js/es/languages/*.js.js',
]);
const loading = new Map<string, Promise<void>>();

// Reveal's Markdown plugin reads "```ts [1|3-4]" into data-line-numbers, but marked's default renderer
// (used to preload languages) keeps the bracket spec in the class name. Strip it so both agree.
const lineSpec = /\s*\[[\s\d,|:-]*\].*$/;

function declaredLanguage(code: Element) {
  const declared = [...code.classList].find((name) => name.startsWith('language-')) ?? code.classList.item(0);
  const label = declared ? declared.replace(/^language-/, '').replace(lineSpec, '') : '';
  // Reveal uses bare language classes and "undefined" for unlabeled fences.
  return label && label !== 'undefined' ? label : 'plaintext';
}

async function loadLanguage(label: string): Promise<string> {
  const alias = label.toLowerCase();
  if (!Object.hasOwn(aliases, alias)) {
    throw new Error(`slides.md: unsupported code language "${label}". Use a Highlight.js language name/alias, or plaintext.`);
  }
  const name = aliases[alias];
  if (hljs.getLanguage(name)) return name;
  if (!loading.has(name)) {
    loading.set(name, (async () => {
      const loader = modules[`../node_modules/highlight.js/es/languages/${name}.js`];
      if (!loader) throw new Error(`slides.md: code language "${label}" has no published module.`);
      for (const dependency of requirements[name] ?? []) await loadLanguage(dependency);
      const module = await loader();
      hljs.registerLanguage(name, module.default);
      // Register before embedded grammars so mutually embedded languages do not deadlock.
      for (const dependency of embedded[name] ?? []) await loadLanguage(dependency);
    })());
  }
  await loading.get(name);
  return name;
}

export async function preloadCodeLanguages(source: string, plugin: unknown) {
  if (!plugin || typeof plugin !== 'object' || !('marked' in plugin)) throw new Error('Reveal Markdown parser is unavailable.');
  const parser = plugin.marked;
  if (!parser || (typeof parser !== 'object' && typeof parser !== 'function') ||
      !('parse' in parser) || typeof parser.parse !== 'function') throw new Error('Reveal Markdown parser is unavailable.');
  const html: unknown = parser.parse(source, { headerIds: false, mangle: false });
  if (typeof html !== 'string') throw new Error('Reveal Markdown must use its synchronous parser.');
  const template = document.createElement('template');
  template.innerHTML = html;
  for (const code of template.content.querySelectorAll('pre > code')) await loadLanguage(declaredLanguage(code));
}

type Block = { code: HTMLElement; pre: HTMLElement; source: string; language: string; label: string };
type Ranges = [number, number][];
type FocusBlock = { pre: HTMLElement; lines: HTMLElement[]; steps: Ranges[]; markers: HTMLElement[]; step: number; seen: boolean };

const focusBlocks: FocusBlock[] = [];
// A command that asks for JSON must show the complete JSON document, not an excerpt.
const claimsJson = /(?:^|\s)(?:--json|--(?:format|output)[ =]json|-o[ =]json)(?=\s|$)/i;

function slideOf(node: Element) {
  return `slides.md: slide "${node.closest('section')?.id ?? 'unknown'}"`;
}

// Wrap every line of the highlighted markup in a .code-line span, closing and reopening token spans at each newline.
// The newline stays a text node between the lines, so textContent (and therefore Copy) is the original source. An empty
// line gets a <br>: it adds no text, but without it a selection copy would silently drop the blank line.
function lineMarkup(markup: string, first: number): string {
  const open: string[] = [];
  let number = first;
  let empty = true;
  const begin = () => {
    empty = true;
    return `<span class="code-line" data-line="${number}">${open.join('')}`;
  };
  const finish = () => `${empty ? '<br>' : ''}${'</span>'.repeat(open.length)}</span>`;
  let html = begin();
  for (const token of markup.split(/(<span[^>]*>|<\/span>|\n)/)) {
    if (token === '\n') {
      html += `${finish()}\n`;
      number++;
      html += begin();
    } else {
      if (token.startsWith('</span')) open.pop();
      else if (token.startsWith('<span')) open.push(token);
      else if (token) empty = false;
      html += token;
    }
  }
  return `${html}${finish()}`;
}

async function highlightBlock(code: HTMLElement): Promise<Block> {
  const pre = code.parentElement as HTMLElement;
  // Reveal only recognizes digits, commas, hyphens and | in brackets. Anything else would silently do nothing.
  const stray = [...code.classList].find((name) => name.startsWith('['));
  if (stray) {
    throw new Error(`${slideOf(pre)}: "${stray}" after the code language is not a line-step list. Use digits, commas, hyphens and | in brackets, such as [1|3-4], or remove it.`);
  }
  const labelLanguage = declaredLanguage(code);
  const language = await loadLanguage(labelLanguage);
  const source = code.textContent ?? '';
  const result = hljs.highlight(source, { language });
  if (result.errorRaised) throw new Error(`slides.md: code language "${labelLanguage}" could not highlight this block.`, { cause: result.errorRaised });
  const offset = code.dataset.lnStartFrom ?? '';
  code.innerHTML = lineMarkup(result.value, /^\d+$/.test(offset) ? Number(offset) : 1);
  code.classList.add('hljs');
  code.dataset.language = language;
  return { code, pre, source, language, label: pre.dataset.caption ?? labelLanguage };
}

function scrollRegion(pre: HTMLElement, label: string) {
  pre.tabIndex = 0;
  pre.setAttribute('role', 'region');
  pre.setAttribute('aria-label', label);
}

function copyButton(label: string, kind: string, source: string, announce: (message: string) => void) {
  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'copy-code';
  copy.textContent = 'Copy';
  copy.prepend(iconElement('copy'));
  copy.setAttribute('aria-label', `Copy ${label} ${kind}`);
  copy.addEventListener('click', async () => {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard access requires HTTPS or localhost.');
      await navigator.clipboard.writeText(source);
      announce(`${label} ${kind} copied.`);
    } catch (error) {
      console.error('Code copy failed.', error);
      announce(`Could not copy ${label}. Allow clipboard access, or select and copy the ${kind} directly.`);
    }
  });
  return copy;
}

function codePanel(block: Block, announce: (message: string) => void) {
  const panel = document.createElement('figure');
  panel.className = 'code-panel';
  const caption = document.createElement('figcaption');
  const title = document.createElement('span');
  title.append(iconElement('file'), document.createTextNode(block.label));
  caption.append(title, copyButton(block.label, 'code', block.source, announce));
  block.pre.before(panel);
  panel.append(caption, block.pre);
  scrollRegion(block.pre, `${block.label} code. Scroll here if needed.`);
  return panel;
}

// "1-3,5|7" -> [[[1, 3], [5, 5]], [[7, 7]]]. Numbers are relative to the block, as in Reveal.
function parseSteps(spec: string, count: number, where: string): Ranges[] {
  return spec.split('|').map((step) => {
    const ranges: Ranges = [];
    for (const piece of step.split(',').map((part) => part.trim()).filter(Boolean)) {
      const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(piece);
      if (!match) throw new Error(`${where}: "${piece}" is not a line number or a range such as 3-5.`);
      const from = Number(match[1]);
      const to = match[2] ? Number(match[2]) : from;
      if (from < 1 || to < from || to > count) {
        throw new Error(`${where}: lines ${piece} are outside this ${count}-line code block. Use numbers from 1 to ${count}.`);
      }
      ranges.push([from, to]);
    }
    return ranges;
  });
}

// Reveal numbers a slide's fragments when it initializes, and an unnumbered fragment would then be revealed after all of
// them. A fragment created here (a line step or a terminal output) takes its place in document order instead: it is
// numbered just before the first fragment that follows it, or last when none does.
function enrollFragment(fragment: HTMLElement) {
  const slide = fragment.closest('section');
  if (!slide) return;
  const numbered = [...slide.querySelectorAll<HTMLElement>('.fragment[data-fragment-index]')].filter((other) => other !== fragment);
  const following = numbered.find((other) => (fragment.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0);
  const indexOf = (node: HTMLElement) => Number(node.dataset.fragmentIndex);
  const index = following ? indexOf(following) : Math.max(-1, ...numbered.map(indexOf)) + 1;
  for (const other of numbered) if (indexOf(other) >= index) other.dataset.fragmentIndex = String(indexOf(other) + 1);
  fragment.dataset.fragmentIndex = String(index);
}

// data-line-numbers comes from Reveal's own fence syntax: ```ts [1|3-4]. Later steps are native fragments,
// so Next, Back, fragment hashes and the fragment counter behave like every other reveal.
function registerFocus(block: Block, panel: HTMLElement) {
  const spec = block.code.dataset.lineNumbers;
  if (spec === undefined || block.pre.closest('aside.notes')) return;
  const lines = [...block.code.querySelectorAll<HTMLElement>(':scope > .code-line')];
  const steps = spec.trim() ? parseSteps(spec, lines.length, `${slideOf(block.pre)}, ${block.label}`) : [];
  const markers = steps.slice(1).map(() => {
    const marker = document.createElement('span');
    marker.className = 'code-step fragment';
    marker.setAttribute('aria-hidden', 'true');
    panel.append(marker);
    enrollFragment(marker);
    return marker;
  });
  focusBlocks.push({ pre: block.pre, lines, steps, markers, step: -2, seen: false });
}

async function terminalPanel(command: HTMLElement, announce: (message: string) => void, consumed: Set<HTMLElement>) {
  const where = slideOf(command);
  const output = command.nextElementSibling;
  const commandCode = command.querySelector<HTMLElement>(':scope > code');
  const outputCode = output instanceof HTMLPreElement ? output.querySelector<HTMLElement>(':scope > code') : null;
  if (!commandCode || !(output instanceof HTMLPreElement) || !outputCode) {
    throw new Error(`${where}: a terminal command (data-terminal) needs its output in a code block right after it.`);
  }
  consumed.add(output);
  const shown = await highlightBlock(commandCode);
  const result = await highlightBlock(outputCode);
  if (!result.source.trim()) throw new Error(`${where}: the terminal output is empty. Paste the complete output of the command.`);
  if (result.language === 'json') {
    try {
      JSON.parse(result.source);
    } catch (error) {
      throw new Error(`${where}: the terminal output labeled json is not complete, valid JSON (${error instanceof Error ? error.message : String(error)}). Paste the whole output, or label it text.`, { cause: error });
    }
  } else if (claimsJson.test(shown.source)) {
    throw new Error(`${where}: the terminal command asks for JSON, so label its output block json and paste the complete output.`);
  }

  const caption = command.dataset.caption ?? 'Terminal';
  const panel = document.createElement('figure');
  panel.className = 'code-panel terminal-panel';
  const header = document.createElement('figcaption');
  const title = document.createElement('span');
  const label = document.createElement('span');
  label.className = 'terminal-label';
  // The label is always present, so a static page never implies the command just ran.
  label.textContent = command.dataset.terminal?.trim() || 'Recorded example';
  title.append(iconElement('terminal'), document.createTextNode(`${caption} `), label);
  header.append(title, copyButton(caption, 'command', shown.source, announce));

  const line = document.createElement('div');
  line.className = 'terminal-command-line';
  const prompt = document.createElement('span');
  prompt.className = 'terminal-prompt';
  prompt.setAttribute('aria-hidden', 'true');
  prompt.textContent = '$';
  command.classList.add('terminal-command');
  command.before(panel);
  line.append(prompt, command);

  // The output is one native fragment: Next expands it, Back collapses it, static modes show it.
  const response = document.createElement('div');
  response.className = 'terminal-response fragment';
  const clip = document.createElement('div');
  clip.className = 'terminal-clip';
  output.classList.add('terminal-output');
  clip.append(output);
  response.append(clip);
  scrollRegion(output, `${caption} output. Scroll here if needed.`);
  panel.append(header, line, response);
  enrollFragment(response);
}

export async function prepareCode(root: HTMLElement, announce: (message: string) => void) {
  focusBlocks.length = 0;
  const consumed = new Set<HTMLElement>();
  for (const code of root.querySelectorAll<HTMLElement>('pre > code')) {
    const pre = code.parentElement as HTMLElement;
    if (consumed.has(pre)) continue;
    if (pre.dataset.terminal !== undefined) {
      await terminalPanel(pre, announce, consumed);
      continue;
    }
    const block = await highlightBlock(code);
    registerFocus(block, codePanel(block, announce));
  }
}

function showFocus(block: FocusBlock) {
  const focused = block.lines.filter((line) => line.classList.contains('is-focused'));
  const first = focused[0];
  const last = focused.at(-1);
  const body = block.pre;
  if (!first || !last || body.scrollHeight <= body.clientHeight + 1) return;
  const padding = parseFloat(getComputedStyle(body).paddingTop) || 0;
  if (first.offsetTop < body.scrollTop + padding || last.offsetTop + last.offsetHeight > body.scrollTop + body.clientHeight - padding) {
    body.scrollTo({ top: Math.max(0, first.offsetTop - padding), behavior: 'smooth' });
  }
}

// Focus is derived from the native fragment state every time, so Next, Back, hashes, jumps and mode changes can never
// leave a stale step. Static modes (read, print, reduced motion) show complete, neutral code. The body only scrolls when
// the step changes or its slide arrives, never against a presenter's manual scroll.
export function syncCodeFocus(current: HTMLElement | undefined, staticMode: boolean) {
  for (const block of focusBlocks) {
    const revealed = block.markers.filter((marker) => marker.classList.contains('visible')).length;
    const step = staticMode ? (block.steps.length === 1 ? 0 : -1) : Math.min(revealed, block.steps.length - 1);
    const changed = step !== block.step;
    if (changed) {
      block.step = step;
      const wanted = new Set<number>();
      for (const [from, to] of block.steps[step] ?? []) for (let number = from; number <= to; number++) wanted.add(number);
      block.lines.forEach((line, index) => line.classList.toggle('is-focused', wanted.has(index + 1)));
      block.pre.dataset.focusStep = step < 0 ? '' : String(step + 1);
    }
    const arriving = block.pre.closest('section') === current;
    if (!staticMode && arriving && (changed || !block.seen)) showFocus(block);
    block.seen = arriving;
  }
}
