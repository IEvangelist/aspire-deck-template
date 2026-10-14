import hljs from 'highlight.js/lib/core';
import type { LanguageFn } from 'highlight.js';
import { aliases, requirements, embedded } from 'virtual:highlight-languages';
import { iconElement } from './icons';

const modules = import.meta.glob<{ default: LanguageFn }>([
  '../node_modules/highlight.js/es/languages/*.js',
  '!../node_modules/highlight.js/es/languages/*.js.js',
]);
const loading = new Map<string, Promise<void>>();

function declaredLanguage(code: Element) {
  const declared = [...code.classList].find((name) => name.startsWith('language-')) ?? code.classList.item(0);
  // Reveal uses bare language classes and "undefined" for unlabeled fences.
  return declared && declared !== 'undefined' ? declared.replace(/^language-/, '') : 'plaintext';
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

export async function prepareCode(root: HTMLElement, announce: (message: string) => void) {
  for (const code of root.querySelectorAll<HTMLElement>('pre > code')) {
    const labelLanguage = declaredLanguage(code);
    const language = await loadLanguage(labelLanguage);
    const pre = code.parentElement!;
    const source = code.textContent ?? '';
    const result = hljs.highlight(source, { language });
    if (result.errorRaised) throw new Error(`slides.md: code language "${labelLanguage}" could not highlight this block.`, { cause: result.errorRaised });
    code.innerHTML = result.value;
    code.classList.add('hljs');
    code.dataset.language = language;
    const panel = document.createElement('figure');
    panel.className = 'code-panel';
    const caption = document.createElement('figcaption');
    const label = pre.dataset.caption ?? labelLanguage;
    const title = document.createElement('span');
    title.append(iconElement('file'), document.createTextNode(label));
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'copy-code';
    copy.textContent = 'Copy';
    copy.prepend(iconElement('copy'));
    copy.setAttribute('aria-label', `Copy ${label} code`);
    copy.addEventListener('click', async () => {
      try {
        if (!navigator.clipboard) throw new Error('Clipboard access requires HTTPS or localhost.');
        await navigator.clipboard.writeText(source);
        announce(`${label} code copied.`);
      } catch (error) {
        console.error('Code copy failed.', error);
        announce(`Could not copy ${label}. Allow clipboard access, or select and copy the code directly.`);
      }
    });
    caption.append(title, copy);
    pre.before(panel);
    panel.append(caption, pre);
    pre.tabIndex = 0;
    pre.setAttribute('role', 'region');
    pre.setAttribute('aria-label', `${label} code. Scroll here if needed.`);
  }
}
