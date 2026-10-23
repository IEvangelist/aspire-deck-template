import Reveal from 'reveal.js';
import Markdown from 'reveal.js/plugin/markdown/markdown.esm.js';
import Notes from 'reveal.js/plugin/notes/notes.esm.js';
import 'reveal.js/dist/reveal.css';
import '@fontsource/poppins/latin-400.css';
import '@fontsource/poppins/latin-500.css';
import '@fontsource/poppins/latin-600.css';
import '@fontsource/poppins/latin-700.css';
import '@fontsource/fira-code/latin-400.css';
import '@fontsource/fira-code/latin-500.css';
import '@fontsource/fira-code/latin-600.css';
import configUrl from '../deck.config.json?url&no-inline';
import markdownUrl from '../slides.md?url&no-inline';
import diagramsUrl from '../diagrams.json?url&no-inline';
import { assetUrl, description, parseDeckJson, type DeckConfig } from './config';
import { prepareCode, preloadCodeLanguages, syncCodeFocus } from './code';
import { iconElement, loadIcons, renderIcons } from './icons';
import { iconAliases } from './icon-names';
import { parseDiagramJson } from './diagram-config';
import { renderDiagrams } from './diagrams';
import './styles.css';

function element<T extends HTMLElement>(id: string, type: { new(): T }): T {
  const value = document.getElementById(id);
  if (!(value instanceof type)) throw new Error(`Missing presentation element: ${id}`);
  return value;
}

function text<K extends keyof HTMLElementTagNameMap>(tag: K, value: string, className = '') {
  const node = document.createElement(tag);
  node.textContent = value;
  node.className = className;
  return node;
}

const root = element('presentation', HTMLElement);
const viewport = element('slide-viewport', HTMLElement);
const toolbar = element('toolbar', HTMLElement);
const menu = element('deck-menu', HTMLDialogElement);
const menuButton = element('menu-toggle', HTMLButtonElement);
const previous = element('previous', HTMLButtonElement);
const next = element('next', HTMLButtonElement);
const position = element('slide-position', HTMLOutputElement);
const currentTitle = element('current-title', HTMLSpanElement);
const themeButton = element('theme', HTMLButtonElement);
const readButton = element('read-mode', HTMLButtonElement);
const overviewButton = element('overview', HTMLButtonElement);
const status = element('deck-status', HTMLParagraphElement);
const darkPreference = matchMedia('(prefers-color-scheme: dark)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const compactViewport = matchMedia('(max-width: 999px), (max-height: 649px)');
const initialUrl = new URL(location.href);
const printMode = initialUrl.searchParams.has('print-pdf');
let reading = !printMode && (initialUrl.searchParams.get('mode') === 'read' ||
  (initialUrl.searchParams.get('mode') !== 'present' && compactViewport.matches));
let explicitTheme = ['light', 'dark'].includes(initialUrl.searchParams.get('theme') ?? '');
let current: HTMLElement;
let slides: HTMLElement[] = [];
let deck: Reveal.Api;
let scrollFrame = 0;

function announce(message: string) {
  status.textContent = message;
}

function showFailure(error: unknown) {
  console.error('Presentation failed.', error);
  element('failure-detail', HTMLParagraphElement).textContent = error instanceof Error ? error.message : String(error);
  element('failure', HTMLElement).hidden = false;
  toolbar.hidden = true;
  root.hidden = true;
  document.documentElement.dataset.deckReady = 'error';
}

async function load(url: string, file: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${file}: could not load (HTTP ${response.status}). Check the published build and asset path.`);
  return response.text();
}

function setTheme(theme: 'light' | 'dark') {
  document.documentElement.dataset.theme = theme;
  themeButton.replaceChildren(iconElement(theme === 'dark' ? 'sun' : 'moon'), text('span', `${theme === 'dark' ? 'Light' : 'Dark'} theme`), text('kbd', 'T'));
  themeButton.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`);
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')!.content = theme === 'dark' ? '#151423' : '#f5f6f8';
}

function toggleTheme() {
  explicitTheme = true;
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  setTheme(theme);
  const url = new URL(location.href);
  url.searchParams.set('theme', theme);
  history.replaceState(null, '', url);
  updatePrintLink();
}

function renderIntro(config: DeckConfig) {
  document.title = config.title;
  for (const [selector, content] of [
    ['meta[name="description"]', description(config)],
    ['meta[name="author"]', config.presenter.name],
    ['meta[property="og:title"]', config.title],
    ['meta[property="og:description"]', description(config)],
  ]) {
    const meta = document.querySelector<HTMLMetaElement>(selector);
    if (meta) meta.content = content;
  }
  root.setAttribute('aria-label', config.title);
  const intro = element('intro', HTMLElement);
  const copy = document.createElement('div');
  copy.className = 'title-copy';
  copy.append(text('h1', config.title));
  if (config.subtitle) copy.append(text('p', config.subtitle, 'subtitle'));
  const start = text('a', 'Start presentation', 'primary-link');
  start.id = 'start-presentation';
  start.append(iconElement('arrowRight'));
  copy.append(start);
  const presenter = document.createElement('div');
  presenter.className = 'presenter';
  if (config.presenter.avatar) {
    intro.classList.add('has-avatar');
    const avatar = document.createElement('img');
    avatar.className = 'presenter-avatar';
    avatar.src = assetUrl(config.presenter.avatar.src, import.meta.env.BASE_URL, location.origin);
    avatar.alt = config.presenter.avatar.alt;
    avatar.addEventListener('error', () => showFailure(new Error(
      `deck.config.json: presenter.avatar.src "${config.presenter.avatar!.src}" could not load. Check the image URL.`,
    )));
    presenter.append(avatar);
  }
  presenter.append(text('p', config.presenter.name, 'presenter-name'));
  const role = [config.presenter.role, config.presenter.organization].filter(Boolean).join(' | ');
  if (role) presenter.append(text('p', role, 'presenter-role'));
  if (config.links.length) {
    const links = document.createElement('nav');
    links.className = 'presenter-links';
    links.setAttribute('aria-label', `${config.presenter.name}'s links`);
    for (const link of config.links) {
      const anchor = text('a', link.label);
      anchor.prepend(iconElement(new URL(link.url).hostname.replace(/^www\./, '') === 'github.com' ? 'github' : 'link'));
      anchor.href = link.url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      links.append(anchor);
    }
    presenter.append(links);
  }
  intro.replaceChildren(copy, presenter);
  const event = config.event && [config.event.name, config.event.date, config.event.location].filter(Boolean).join(' | ');
  if (event) intro.append(text('p', event, 'event'));
}

function staticMode() {
  return reading || printMode || reducedMotion.matches;
}

function compact() {
  return !reading && !printMode && compactViewport.matches;
}

function naturalLayout() {
  return reading || compact();
}

function updateMode() {
  document.documentElement.dataset.reading = String(reading);
  document.documentElement.dataset.static = String(staticMode());
  document.documentElement.dataset.print = String(printMode);
  document.documentElement.dataset.compact = String(compact());
  readButton.replaceChildren(iconElement(reading ? 'screen' : 'book'), text('span', reading ? 'Presentation mode' : 'Reading mode'), text('kbd', 'R'));
  readButton.setAttribute('aria-pressed', String(reading));
  readButton.setAttribute('aria-label', `Switch to ${reading ? 'presentation' : 'reading'} mode`);
  overviewButton.disabled = reading;
  overviewButton.title = reading ? 'Switch to presentation mode for overview.' : 'Overview (Esc)';
}

function dimensions() {
  return {
    width: naturalLayout() ? Math.min(root.clientWidth, 1440) : Math.max(1200, Math.min(1440, root.clientWidth / root.clientHeight * 810)),
    height: naturalLayout() ? root.clientHeight : 810,
  };
}

function slideTitle(slide: HTMLElement, index: number) {
  return slide.dataset.title || slide.querySelector('h1, h2, h3')?.textContent?.trim() || `Slide ${index + 1}`;
}

function synchronize() {
  if (!reading) current = deck.getCurrentSlide();
  if (reading) for (const slide of root.querySelectorAll('section')) slide.removeAttribute('aria-hidden');
  const index = slides.indexOf(current);
  if (index < 0) return;
  document.documentElement.dataset.intro = String(index === 0);
  position.value = `${index + 1} / ${slides.length}`;
  position.setAttribute('aria-label', `Slide ${index + 1} of ${slides.length}`);
  currentTitle.textContent = slideTitle(current, index);
  previous.disabled = index === 0 && (staticMode() || !deck.availableFragments().prev);
  next.disabled = index === slides.length - 1 && (staticMode() || !deck.availableFragments().next);
  for (const link of menu.querySelectorAll<HTMLAnchorElement>('[data-slide]')) {
    if (link.dataset.slide === current.id) link.setAttribute('aria-current', 'step');
    else link.removeAttribute('aria-current');
  }
  document.documentElement.style.setProperty('--slide-scale', String(naturalLayout() ? 1 : deck.getScale()));
  syncCodeFocus(current, staticMode());
}

function targetFor(hash: string): HTMLElement | undefined {
  if (!hash.startsWith('#/')) return undefined;
  const [name, vertical = '0'] = decodeURIComponent(hash.slice(2)).split('/');
  return /^\d+$/.test(name)
    ? deck.getSlide(Number(name), Number(vertical))
    : slides.find((slide) => slide.id === name);
}

function fragmentFor(hash: string): number {
  const parts = decodeURIComponent(hash.slice(2)).split('/');
  const value = parts[/^\d+$/.test(parts[0]) ? 2 : 1];
  if (value === undefined) return -1;
  if (!/^-?\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < -1) {
    throw new RangeError(`Invalid fragment index in "${hash}". Use -1 for the first state or a zero-based fragment number.`);
  }
  return Number(value);
}

function followHash(event: HashChangeEvent) {
  if (document.documentElement.dataset.deckReady !== 'true' || !location.hash.startsWith('#/')) return;
  event.stopImmediatePropagation();
  const slide = targetFor(location.hash);
  if (slide) {
    let fragment: number;
    try {
      fragment = fragmentFor(location.hash);
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      console.error('Presentation link could not be followed.', error);
      announce(error.message);
      return;
    }
    if (!reading && deck.getCurrentSlide() === slide && (deck.getIndices().f ?? -1) === fragment) return;
    goTo(slide, fragment);
  } else {
    announce(`Slide link "${location.hash}" was not found. Open the menu to choose a slide.`);
  }
}

function finishReveals(slide: HTMLElement, selector = '.fragment') {
  for (const fragment of slide.querySelectorAll(selector)) {
    for (const animation of fragment.getAnimations({ subtree: true })) {
      if (animation.playState === 'running' && Number.isFinite(animation.effect?.getComputedTiming().endTime)) animation.finish();
    }
  }
}

// A stepped code block has zero-size markers, so the line it focuses is what should stay in view.
function stepTarget(node: Element): Element | null {
  return node.matches('.code-step') ? node.closest('.code-panel')?.querySelector('.is-focused') ?? null : node;
}

function scrollToCurrentStep() {
  if (staticMode()) return;
  const candidates = [...current.querySelectorAll('.current-fragment')].map(stepTarget).filter((node): node is Element => {
    if (!node) return false;
    const bounds = node.getBoundingClientRect();
    return bounds.width > 0 && bounds.height > 0 && getComputedStyle(node).visibility !== 'hidden';
  });
  const target = candidates.at(-1) ?? current.querySelector('.diagram-node:not(.fragment), .graph-node-list [data-mobile-node]:not(.fragment)');
  if (!target) return;
  const region = target.closest('.architecture-mobile');
  const scroller = region instanceof HTMLElement && getComputedStyle(region).overflowY === 'auto' ? region : viewport;
  if (scroller === viewport && !naturalLayout()) return;
  const bounds = target.getBoundingClientRect();
  const frame = scroller.getBoundingClientRect();
  if (bounds.top < frame.top + 16 || bounds.bottom > frame.bottom - 16) {
    scroller.scrollTo({ top: scroller.scrollTop + bounds.top - frame.top - 24, behavior: 'instant' });
  }
}

// A terminal output expands over a short transition, so check the viewport again once it has its final height.
function showCurrentStep() {
  scrollToCurrentStep();
  const running = [...current.querySelectorAll('.current-fragment')].flatMap((node) => node.getAnimations({ subtree: true }))
    .filter((animation) => animation.playState === 'running' && Number.isFinite(animation.effect?.getComputedTiming().endTime));
  if (running.length) void Promise.allSettled(running.map((animation) => animation.finished)).then(scrollToCurrentStep);
}

function goTo(slide: HTMLElement, fragment = -1) {
  finishReveals(current);
  const indices = deck.getIndices(slide);
  deck.slide(indices.h, indices.v, staticMode() ? -1 : fragment);
  current = slide;
  finishReveals(slide);
  if (reading) {
    viewport.scrollTo({ top: viewport.scrollTop + slide.getBoundingClientRect().top - viewport.getBoundingClientRect().top, behavior: 'instant' });
    const url = new URL(location.href);
    url.hash = `/${slide.id}`;
    if (location.hash !== url.hash) history.pushState(null, '', url);
  }
  synchronize();
  showCurrentStep();
}

function closeMenu() {
  menu.close();
}

function toggleReading() {
  const slide = current;
  reading = !reading;
  const url = new URL(location.href);
  url.searchParams.set('mode', reading ? 'read' : 'present');
  history.replaceState(null, '', url);
  updateMode();
  deck.configure({
    ...dimensions(),
    disableLayout: naturalLayout(),
    overview: !reading,
    fragments: !staticMode(),
    autoAnimate: !staticMode(),
    hash: !reading,
    history: !reading,
  });
  goTo(slide);
  updatePrintLink();
  announce(reading ? 'Reading mode. All fragments are visible; scroll through the slides.' : 'Presentation mode. Use arrow keys or Space to advance.');
}

function updatePrintLink() {
  const url = new URL(location.href);
  url.searchParams.delete('mode');
  url.searchParams.set('print-pdf', '');
  url.hash = '';
  element('print-link', HTMLAnchorElement).href = url.href;
}

function prepareSlides() {
  slides = [...deck.getSlides()];
  if (slides.length < 2) throw new Error('slides.md: add at least one content slide.');
  const ids = new Set<string>();
  for (const [index, slide] of slides.entries()) {
    if (!slide.id) slide.id = `slide-${index + 1}`;
    if (!/^[a-z][a-z\d_-]*$/i.test(slide.id)) {
      throw new Error(`slides.md: slide id "${slide.id}" must start with a letter and contain only letters, numbers, - or _.`);
    }
    if (ids.has(slide.id) || [...document.querySelectorAll('[id]')].filter((node) => node.id === slide.id).length !== 1) {
      throw new Error(`slides.md: duplicate or reserved slide id "${slide.id}". Choose a unique .slide id; intro is reserved.`);
    }
    ids.add(slide.id);
    const content = document.createElement('div');
    content.className = 'slide-content';
    for (const child of [...slide.childNodes]) {
      if (!(child instanceof HTMLElement && child.classList.contains('notes'))) content.append(child);
    }
    if (slide.dataset.kicker) content.prepend(text('p', slide.dataset.kicker, 'slide-kicker'));
    slide.prepend(content);
    for (const image of slide.querySelectorAll('img')) {
      const source = image.getAttribute('src');
      if (source) image.src = assetUrl(source, import.meta.env.BASE_URL, location.origin);
    }
    for (const background of slide.querySelectorAll<HTMLElement>('[data-background-image]')) {
      background.dataset.backgroundImage = assetUrl(background.dataset.backgroundImage!, import.meta.env.BASE_URL, location.origin);
    }
    if (slide.dataset.backgroundImage) {
      slide.dataset.backgroundImage = assetUrl(slide.dataset.backgroundImage, import.meta.env.BASE_URL, location.origin);
    }
  }
  element('start-presentation', HTMLAnchorElement).href = `#/${slides[1].id}`;
  for (const link of root.querySelectorAll<HTMLAnchorElement>('a[href^="#/"]')) {
    const href = link.getAttribute('href')!;
    if (!targetFor(href)) throw new Error(`slides.md: slide link "${href}" has no target.`);
    try {
      fragmentFor(href);
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      throw new Error(`slides.md: ${error.message}`, { cause: error });
    }
  }
  const list = element('slide-list', HTMLOListElement);
  element('menu-summary', HTMLParagraphElement).textContent = `${slides.length} slides`;
  list.replaceChildren(...slides.map((slide, index) => {
    const item = document.createElement('li');
    const anchor = document.createElement('a');
    anchor.href = `#/${slide.id}`;
    anchor.dataset.slide = slide.id;
    anchor.append(text('span', String(index + 1), 'slide-number'), text('span', slideTitle(slide, index)));
    if (slide.parentElement?.classList.contains('stack')) item.className = 'vertical-slide';
    item.append(anchor);
    return item;
  }));
}

function focusPresentation() {
  root.focus({ preventScroll: true });
}

function wireControls() {
  menuButton.addEventListener('click', () => { menu.showModal(); menuButton.setAttribute('aria-expanded', 'true'); });
  menu.addEventListener('close', () => menuButton.setAttribute('aria-expanded', 'false'));
  menu.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const link = event.target.closest<HTMLAnchorElement>('[data-slide]');
    if (!link?.dataset.slide) return;
    event.preventDefault();
    closeMenu();
    goTo(slides.find((slide) => slide.id === link.dataset.slide)!);
    focusPresentation();
  });
  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const link = event.target.closest<HTMLAnchorElement>('a[href^="#/"]');
    if (!link || menu.contains(link)) return;
    event.preventDefault();
    const slide = targetFor(link.getAttribute('href')!);
    if (slide) { goTo(slide, fragmentFor(link.getAttribute('href')!)); focusPresentation(); }
    else announce(`Slide link "${link.getAttribute('href')}" was not found. Open the menu to choose a slide.`);
  });
  previous.addEventListener('click', () => {
    if (reading) goTo(slides[Math.max(0, slides.indexOf(current) - 1)]);
    else deck.prev();
    focusPresentation();
  });
  next.addEventListener('click', () => {
    if (reading) goTo(slides[Math.min(slides.length - 1, slides.indexOf(current) + 1)]);
    else deck.next();
    focusPresentation();
  });
  themeButton.addEventListener('click', toggleTheme);
  readButton.addEventListener('click', () => { closeMenu(); toggleReading(); focusPresentation(); });
  overviewButton.addEventListener('click', () => { closeMenu(); deck.toggleOverview(); focusPresentation(); });
  element('notes', HTMLButtonElement).addEventListener('click', () => {
    closeMenu();
    const plugin = deck.getPlugin('notes');
    if ('open' in plugin && typeof plugin.open === 'function') plugin.open();
    else announce('Speaker notes could not open. Reload and allow popups for this site.');
  });
  document.querySelector('.skip-link')!.addEventListener('click', (event) => { event.preventDefault(); focusPresentation(); });
  viewport.addEventListener('scroll', () => {
    if (!reading || scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      const bounds = viewport.getBoundingClientRect();
      const visible = slides.filter((slide) => {
        const rect = slide.getBoundingClientRect();
        return rect.bottom > bounds.top && rect.top < bounds.bottom;
      });
      visible.sort((a, b) => Math.abs(a.getBoundingClientRect().top - bounds.top) - Math.abs(b.getBoundingClientRect().top - bounds.top));
      if (visible[0]) {
        current = visible[0];
        if (deck.getCurrentSlide() !== current) {
          const indices = deck.getIndices(current);
          deck.slide(indices.h, indices.v, -1);
        }
        synchronize();
      }
    });
  });
  window.addEventListener('keydown', (event) => {
    if (!reading || menu.open || event.altKey || event.ctrlKey || event.metaKey ||
        (event.target instanceof Element && event.target.closest('a, button, input, textarea, select, pre, [role="region"][tabindex], [contenteditable]'))) return;
    const direction = ['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(event.key) ? 1 :
      ['ArrowLeft', 'ArrowUp', 'PageUp'].includes(event.key) ? -1 : 0;
    if (direction) {
      event.preventDefault();
      event.stopImmediatePropagation();
      goTo(slides[Math.max(0, Math.min(slides.length - 1, slides.indexOf(current) + direction))]);
    }
  }, true);
  darkPreference.addEventListener('change', () => {
    if (!explicitTheme) setTheme(darkPreference.matches ? 'dark' : 'light');
  });
  reducedMotion.addEventListener('change', () => {
    updateMode();
    deck.configure({ transition: reducedMotion.matches ? 'none' : 'fade', fragments: !staticMode(), autoAnimate: !staticMode() });
    synchronize();
  });
  window.addEventListener('resize', () => {
    updateMode();
    deck.configure({ ...dimensions(), disableLayout: naturalLayout() });
    synchronize();
  });
  deck.on('slidechanged', () => {
    finishReveals(current);
    if (!reading) viewport.scrollTop = 0;
    synchronize();
    showCurrentStep();
  });
  deck.on('fragmentshown', () => {
    synchronize();
    finishReveals(current, '.fragment.visible:not(.current-fragment)');
    showCurrentStep();
  });
  deck.on('fragmenthidden', () => {
    synchronize();
    finishReveals(current, '.fragment:not(.visible)');
    showCurrentStep();
  });
  deck.on('resize', synchronize);
  deck.addKeyBinding({ keyCode: 84, key: 'T', description: 'Switch theme' }, toggleTheme);
  deck.addKeyBinding({ keyCode: 82, key: 'R', description: 'Switch reading mode' }, toggleReading);
}

async function start() {
  const [configSource, markdown, diagramSource] = await Promise.all([load(configUrl, 'deck.config.json'), load(markdownUrl, 'slides.md'), load(diagramsUrl, 'diagrams.json')]);
  const config = parseDeckJson(configSource);
  const diagrams = parseDiagramJson(diagramSource);
  if (!markdown.trim()) throw new Error('slides.md: the file is empty. Add a Markdown slide.');
  await loadIcons(Object.keys(iconAliases));
  renderIntro(config);
  const source = root.querySelector('section[data-markdown]');
  if (!(source instanceof HTMLElement)) throw new Error('Missing Markdown slide container.');
  const template = document.createElement('textarea');
  template.setAttribute('data-template', '');
  template.textContent = markdown;
  source.append(template);
  const theme = initialUrl.searchParams.get('theme');
  setTheme(theme === 'light' || theme === 'dark' ? theme : darkPreference.matches ? 'dark' : 'light');
  updateMode();
  toolbar.hidden = false;
  const markdownPlugin = Markdown();
  await preloadCodeLanguages(markdown, markdownPlugin);
  await Promise.all([
    document.fonts.load('400 24px Poppins'),
    document.fonts.load('600 32px Poppins'),
    document.fonts.load('700 84px Poppins'),
    document.fonts.load('400 24px "Fira Code"'),
    document.fonts.load('500 18px "Fira Code"'),
  ]);
  deck = new Reveal(root, {
    ...dimensions(),
    margin: 0.07, minScale: 0.15, maxScale: 1.4,
    embedded: true, center: false, controls: false, progress: true,
    hash: !reading, history: !reading,
    transition: reducedMotion.matches ? 'none' : 'fade', transitionSpeed: 'fast', backgroundTransition: 'none',
    disableLayout: naturalLayout(), overview: !reading, scrollActivationWidth: 0,
    fragments: !staticMode(), pdfSeparateFragments: false,
    autoAnimate: !staticMode(),
    autoAnimateDuration: 0.35,
    autoAnimateEasing: 'cubic-bezier(0.16, 1, 0.3, 1)',
    markdown: { headerIds: false, mangle: false },
    keyboardCondition: () => !menu.open && !(document.activeElement instanceof Element &&
      document.activeElement.closest('a, button, input, textarea, select, pre, [role="region"][tabindex], [contenteditable]')),
    plugins: [() => markdownPlugin, Notes],
  });
  await deck.initialize();
  root.removeAttribute('role');
  await renderDiagrams(diagrams, root);
  prepareSlides();
  await prepareCode(root, announce);
  await renderIcons();
  await document.fonts.ready;
  deck.sync();
  current = slides[0];
  wireControls();
  updatePrintLink();
  const target = targetFor(initialUrl.hash);
  if (target) goTo(target, fragmentFor(initialUrl.hash));
  else {
    if (initialUrl.hash.startsWith('#/')) announce(`Slide link "${initialUrl.hash}" was not found. Open the menu to choose a slide.`);
    goTo(slides[0]);
  }
  synchronize();
  document.documentElement.dataset.deckReady = 'true';
}

// Run before Reveal's URL listener so plain links reset cached fragments.
window.addEventListener('hashchange', followHash, true);
void start().catch(showFailure);
