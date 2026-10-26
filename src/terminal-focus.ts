import { slideOf } from './code';

// Opt-in terminal focus. A slide that sets data-terminal-focus="true" gives its recorded terminal the whole slide once the output
// is revealed: the kicker and heading fold away, the support copy marked .terminal-support is hidden, and the window moves into
// the freed space with its output flexing to the remaining height. It is a presentation layout only: reading, print and a page
// without script keep every line of the slide.
type Entry = { slide: HTMLElement; response: HTMLElement; support: HTMLElement[] };

const entries: Entry[] = [];
let presentation: HTMLElement | undefined;
const leadSelector = 'p.slide-kicker, h1, h2, h3, h4, h5, h6';

// The kicker and the headings above the terminal go in a fold, so they can ease closed (a grid row from 1fr to 0fr, like the
// output) and keep their own margins, which would otherwise collapse into the terminal's.
function fold(nodes: HTMLElement[]) {
  if (!nodes.length) return;
  const outer = document.createElement('div');
  outer.className = 'terminal-lead';
  const body = document.createElement('div');
  body.className = 'terminal-lead-body';
  nodes[0].before(outer);
  body.append(...nodes);
  outer.append(body);
}

function foldLead(content: HTMLElement, panel: HTMLElement) {
  let run: HTMLElement[] = [];
  for (const child of [...content.children] as HTMLElement[]) {
    if (child === panel) break;
    if (child.matches(leadSelector)) {
      run.push(child);
    } else {
      fold(run);
      run = [];
    }
  }
  fold(run);
}

function invalid(where: string, found: string) {
  return new Error(`${where}: data-terminal-focus must be "true" (found ${found}). Write data-terminal-focus="true" in the slide comment, or remove it to keep the standard terminal layout.`);
}

// Reveal's Markdown reads only the name="value" pairs of a slide comment, and it drops an empty or malformed one without a word, so
// the slide would silently stay standard. The source is checked as well: in a slide comment the one accepted spelling is
// data-terminal-focus="true". Slides are the chunks between the separators, and a slide without an id is named the way the shell names it.
export function checkTerminalFocusSource(markdown: string) {
  markdown.split(/^(?:---|--)[ \t]*\r?$/m).forEach((chunk, index) => {
    for (const comment of chunk.matchAll(/<!--\s*\.(slide|element):([\s\S]*?)-->/g)) {
      if (!/\bdata-terminal-focus\b/.test(comment[2])) continue;
      const where = `slides.md: slide "${/<!--\s*\.slide:[^>]*?\bid="([^"]+)"/.exec(chunk)?.[1] ?? `slide-${index + 2}`}"`;
      if (comment[1] === 'element') {
        throw new Error(`${where}: data-terminal-focus belongs in the slide comment, <!-- .slide: data-terminal-focus="true" -->, not on an element.`);
      }
      const value = [...comment[2].matchAll(/([^"= ]+?)="([^"]*)"/g)].find((pair) => pair[1] === 'data-terminal-focus')?.[2];
      if (value !== 'true') throw invalid(where, value === undefined ? 'no quoted value' : JSON.stringify(value));
    }
  });
}

// Run once the terminals are built. A focus slide that cannot work stops the load and names the slide, like every other
// pattern: only the exact value "true" opts in, and the slide needs one recorded terminal directly in its content.
export function prepareTerminalFocus(root: HTMLElement) {
  entries.length = 0;
  presentation = root;
  for (const slide of root.querySelectorAll<HTMLElement>('section[data-terminal-focus]')) {
    const where = slideOf(slide);
    const value = slide.getAttribute('data-terminal-focus');
    if (value !== 'true') throw invalid(where, JSON.stringify(value));
    if (slide.querySelector('section')) {
      throw new Error(`${where}: data-terminal-focus belongs on the slide that holds the terminal, not on a group of vertical slides.`);
    }
    const panels = slide.querySelectorAll<HTMLElement>('.terminal-panel');
    if (!panels.length) throw new Error(`${where}: data-terminal-focus needs a recorded terminal (data-terminal) on the same slide.`);
    if (panels.length > 1) throw new Error(`${where}: data-terminal-focus supports one recorded terminal per slide, but this slide has ${panels.length}.`);
    const panel = panels[0];
    const content = panel.parentElement;
    if (!content?.classList.contains('slide-content') || content.parentElement !== slide) {
      throw new Error(`${where}: data-terminal-focus needs the recorded terminal directly on the slide, not inside a layout column or card.`);
    }
    foldLead(content, panel);
    entries.push({ slide, response: panel.querySelector<HTMLElement>('.terminal-response')!, support: [...slide.querySelectorAll<HTMLElement>('.terminal-support')] });
  }
}

// The layout follows the output's own state every time, so Next, Back, deep links, history, the speaker view and a mode change can
// never leave it stale. The output is shown when its fragment is visible, or always where fragments are off (reduced motion): the
// terminal is built after Reveal turns them off, so its fragment never gets the visible class there and the style sheet shows it.
export function syncTerminalFocus(presenting: boolean, fragmentsOff: boolean) {
  for (const { slide, response, support } of entries) {
    const focused = presenting && (fragmentsOff || response.classList.contains('visible'));
    if (slide.classList.contains('is-terminal-focused') === focused) continue;
    // A link that has focus when its copy is hidden would drop focus onto the page, so the presentation takes it first.
    if (focused && support.some((node) => node.contains(document.activeElement))) presentation?.focus({ preventScroll: true });
    slide.classList.toggle('is-terminal-focused', focused);
    for (const node of support) node.toggleAttribute('inert', focused);
  }
}
