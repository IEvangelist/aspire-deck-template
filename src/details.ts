// A slide's native <details> must never grow a slide that is being presented. An expanded disclosure can be far taller than the
// screen: it pushes the slide out of view and strands the presenter. Every disclosure on a slide is enhanced, with no opt-in, so a
// generated deck cannot break this way:
//   presenting     the summary opens the content in the one modal dialog index.html carries. The disclosure itself stays closed, so
//                  the slide, the address and every scroll position stay exactly as they were;
//   reading        the native inline details, as authored;
//   print          every disclosure is open, so its content is printed;
//   previews       the speaker view's previews and the overview keep every disclosure closed, and a click does nothing.
// The content is wrapped once, and that same wrapper moves into the dialog and back, so its nodes and listeners are never cloned or
// lost. Without script the markup is a plain <details>.
export type DetailsMode = 'dialog' | 'inline' | 'print' | 'inert';

type Hooks = { overview: () => boolean; focus: () => void };
type Disclosure = { details: HTMLDetailsElement; summary: HTMLElement; body: HTMLElement; authored: boolean };

const disclosures: Disclosure[] = [];
// Every details on a slide, nested ones included, with the state each had when printing began.
const everyDetails = new Map<HTMLDetailsElement, boolean>();
const interactive = 'a, button, input, select, textarea, [contenteditable]';
let hooks: Hooks;
let dialog: HTMLDialogElement | undefined;
let scroller: HTMLElement;
let heading: HTMLElement;
let mode: DetailsMode = 'dialog';
let active: Disclosure | undefined;
let printing = false;
let wired = false;

// Reveal lays each print page out once, from the content it finds, so a disclosure has to be open before that.
export function expandForPrint(root: HTMLElement) {
  for (const details of root.querySelectorAll('.slides details')) details.setAttribute('open', '');
}

export function detailsOpen() {
  return dialog?.open ?? false;
}

// Put the content back and close the dialog. Focus returns to the summary that opened it, unless the slide it is on has gone.
export function closeDetails(restoreFocus = false) {
  const disclosure = active;
  if (!disclosure) return;
  active = undefined;
  disclosure.details.append(disclosure.body);
  disclosure.summary.setAttribute('aria-expanded', 'false');
  if (dialog?.open) dialog.close();
  lockPage(false);
  if (restoreFocus) disclosure.summary.focus({ preventScroll: true });
  else hooks.focus();
}

// A page that scrolls keeps its scrollbar's gutter, and stops scrolling, while the dialog is open: hiding the scrollbar outright would
// widen the page and slide everything under it sideways. The deck's own page does not scroll, so this changes nothing there.
function lockPage(on: boolean) {
  const page = document.scrollingElement;
  document.documentElement.toggleAttribute('data-details-lock', on && page !== null && page.scrollHeight > page.clientHeight);
}

function show(disclosure: Disclosure) {
  if (active || !dialog) return;
  active = disclosure;
  heading.textContent = disclosure.summary.textContent?.trim() ?? '';
  dialog.setAttribute('aria-labelledby', disclosure.summary.id);
  scroller.replaceChildren(disclosure.body);
  disclosure.summary.setAttribute('aria-expanded', 'true');
  lockPage(true);
  dialog.showModal();
  scroller.scrollTop = 0;
  scroller.focus({ preventScroll: true });
}

// Enter and Space reach the summary as clicks too. A control inside the summary (a link, say) keeps its own behavior.
function onClick(event: MouseEvent) {
  if (!(event.target instanceof Element)) return;
  const summary = event.target.closest('summary');
  const disclosure = disclosures.find((item) => item.summary === summary);
  if (!summary || !disclosure) return;
  const control = event.target.closest(interactive);
  if (control && summary.contains(control)) return;
  if (mode === 'inline' || mode === 'print') return;
  event.preventDefault();
  if (mode === 'dialog' && !hooks.overview()) show(disclosure);
}

// Anything else that opens a disclosure while presenting (the browser's find, say) must not grow the slide either.
function onToggle(event: Event) {
  if (printing || mode === 'inline' || mode === 'print') return;
  const disclosure = disclosures.find((item) => item.details === event.target);
  if (disclosure?.details.open) disclosure.details.open = false;
}

function apply() {
  for (const { details, summary, authored } of disclosures) {
    details.open = mode === 'print' || (mode === 'inline' && authored);
    if (mode === 'dialog') {
      summary.setAttribute('aria-haspopup', 'dialog');
      summary.setAttribute('aria-expanded', 'false');
    } else {
      summary.removeAttribute('aria-haspopup');
      summary.removeAttribute('aria-expanded');
    }
  }
}

// Printing includes every disclosure, however the deck is shown, and then puts each back the way it was.
function print(on: boolean) {
  if (on === printing) return;
  printing = on;
  if (on) {
    closeDetails();
    for (const details of everyDetails.keys()) {
      everyDetails.set(details, details.open);
      details.open = true;
    }
  } else {
    for (const [details, open] of everyDetails) details.open = open;
  }
}

export function syncDetails(next: DetailsMode) {
  if (next === mode) return;
  mode = next;
  closeDetails();
  if (!printing) apply();
}

export function prepareDetails(root: HTMLElement, panel: HTMLDialogElement, options: Hooks & { mode: DetailsMode }) {
  const title = panel.querySelector<HTMLElement>('.details-title');
  const region = panel.querySelector<HTMLElement>('.details-scroll');
  if (!title || !region) throw new Error('Missing presentation element: the details dialog needs .details-title and .details-scroll.');
  dialog = panel;
  heading = title;
  scroller = region;
  hooks = options;
  mode = options.mode;
  disclosures.length = 0;
  everyDetails.clear();
  let sequence = 0;
  for (const details of root.querySelectorAll<HTMLDetailsElement>('.slides details')) {
    // The speaker view shows the notes as authored, so a details inside them is left alone.
    if (details.closest('aside.notes')) continue;
    everyDetails.set(details, details.open);
    // A disclosure inside another one is ordinary native markup inside the dialog, so only the outermost ones are enhanced.
    if (details.parentElement?.closest('details')) continue;
    let summary = [...details.children].find((child): child is HTMLElement => child.localName === 'summary');
    if (!summary) {
      summary = document.createElement('summary');
      summary.textContent = 'Details';
      details.prepend(summary);
    }
    while (!summary.id) {
      const id = `details-summary-${++sequence}`;
      if (!document.getElementById(id)) summary.id = id;
    }
    const body = document.createElement('div');
    body.className = 'details-body';
    body.append(...[...details.childNodes].filter((node) => node !== summary));
    details.append(body);
    disclosures.push({ details, summary, body, authored: details.hasAttribute('open') });
  }
  if (!wired) {
    wired = true;
    root.addEventListener('click', onClick, true);
    document.addEventListener('toggle', onToggle, true);
    // Escape and the Close button close through closeDetails, which puts the content back before the dialog stops being open, so a
    // dialog that is hidden never still holds it. The queued close event is only an idempotent fallback for a close from elsewhere.
    panel.addEventListener('cancel', (event) => { event.preventDefault(); closeDetails(true); });
    panel.querySelector('form')?.addEventListener('submit', (event) => { event.preventDefault(); closeDetails(true); });
    panel.addEventListener('close', () => { if (!panel.open) closeDetails(true); });
    addEventListener('beforeprint', () => print(true));
    addEventListener('afterprint', () => print(false));
    matchMedia('print').addEventListener('change', (event) => print(event.matches));
  }
  apply();
}
