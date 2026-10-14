import arrowLeft from '@primer/octicons/build/svg/arrow-left-24.svg?raw';
import arrowRight from '@primer/octicons/build/svg/arrow-right-24.svg?raw';
import book from '@primer/octicons/build/svg/book-24.svg?raw';
import cloud from '@primer/octicons/build/svg/cloud-24.svg?raw';
import code from '@primer/octicons/build/svg/code-24.svg?raw';
import copy from '@primer/octicons/build/svg/copy-24.svg?raw';
import database from '@primer/octicons/build/svg/database-24.svg?raw';
import file from '@primer/octicons/build/svg/file-code-24.svg?raw';
import graph from '@primer/octicons/build/svg/graph-24.svg?raw';
import github from '@primer/octicons/build/svg/mark-github-24.svg?raw';
import link from '@primer/octicons/build/svg/link-external-24.svg?raw';
import menu from '@primer/octicons/build/svg/three-bars-24.svg?raw';
import moon from '@primer/octicons/build/svg/moon-24.svg?raw';
import screen from '@primer/octicons/build/svg/device-desktop-24.svg?raw';
import sun from '@primer/octicons/build/svg/sun-24.svg?raw';
import terminal from '@primer/octicons/build/svg/terminal-24.svg?raw';
import close from '@primer/octicons/build/svg/x-24.svg?raw';
import { isIconName, type IconName } from './icon-names';

const icons = { arrowLeft, arrowRight, book, cloud, code, copy, database, file, graph, github, link, menu, moon, screen, sun, terminal, close } satisfies Record<IconName, string>;
export type { IconName } from './icon-names';

export function iconElement(name: IconName): HTMLSpanElement {
  const slot = document.createElement('span');
  slot.className = 'icon-slot';
  slot.setAttribute('aria-hidden', 'true');
  slot.innerHTML = icons[name].replace('<svg ', '<svg aria-hidden="true" focusable="false" class="octicon" ');
  return slot;
}

export function renderIcons(scope: ParentNode = document) {
  for (const slot of scope.querySelectorAll<HTMLElement>('[data-icon]')) {
    const name = slot.dataset.icon;
    if (!isIconName(name)) throw new Error(`slides.md or index.html: unknown icon "${name}". Use a documented icon name.`);
    slot.replaceChildren(iconElement(name));
    slot.setAttribute('aria-hidden', 'true');
  }
}
