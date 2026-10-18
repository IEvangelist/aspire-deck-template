import { resolveIconName, type IconName, type IconVariant } from './icon-names';

const modules = import.meta.glob<string>('../node_modules/@primer/octicons/build/svg/*.svg', {
  query: '?raw', import: 'default',
});
const icons = new Map<IconVariant, string>();
const loading = new Map<IconVariant, Promise<void>>();
export type { IconName } from './icon-names';

export async function loadIcons(names: Iterable<string>) {
  const variants = new Set<IconVariant>();
  for (const name of names) {
    const variant = resolveIconName(name);
    if (!variant) throw new Error(`slides.md or index.html: unknown icon "${name}". Use an Octicons name or exact size variant.`);
    variants.add(variant);
  }
  await Promise.all([...variants].map((variant) => {
    if (!loading.has(variant)) {
      loading.set(variant, (async () => {
        const loader = modules[`../node_modules/@primer/octicons/build/svg/${variant}.svg`];
        if (!loader) throw new Error(`Icon "${variant}" is missing from the installed catalog. Run npm run icons:update after updating Octicons.`);
        let markup: string;
        try {
          markup = await loader();
        } catch (error) {
          throw new Error(`Could not load icon "${variant}". Check the published icon assets, then reload.`, { cause: error });
        }
        icons.set(variant, markup);
      })());
    }
    return loading.get(variant);
  }));
}

export function iconElement(name: IconName): HTMLSpanElement {
  const variant = resolveIconName(name);
  const markup = variant && icons.get(variant);
  if (!markup) throw new Error(`Icon "${name}" was not loaded before rendering.`);
  const slot = document.createElement('span');
  slot.className = 'icon-slot';
  slot.dataset.iconVariant = variant;
  slot.setAttribute('aria-hidden', 'true');
  slot.innerHTML = markup.replace('<svg ', '<svg aria-hidden="true" focusable="false" class="octicon" ');
  return slot;
}

export async function renderIcons(scope: ParentNode = document) {
  const slots = [...scope.querySelectorAll<HTMLElement>('[data-icon]')];
  await loadIcons(slots.map((slot) => slot.dataset.icon ?? ''));
  for (const slot of slots) {
    const name = slot.dataset.icon!;
    const variant = resolveIconName(name)!;
    slot.replaceChildren(iconElement(variant));
    slot.setAttribute('aria-hidden', 'true');
  }
}
