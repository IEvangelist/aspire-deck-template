import { expect, test } from '@playwright/test';
import { assetUrl, normalizeBase, parseDeckConfig, parseDeckJson } from '../src/config';

const minimal = { title: 'A talk', presenter: { name: 'A presenter' } };

test('only a title and presenter name are required', () => {
  const config = parseDeckConfig(minimal);
  expect(config.links).toEqual([]);
  expect(config.presenter.avatar).toBeUndefined();
  expect(config.event).toBeUndefined();
});

test('optional text, avatar, event, and arbitrarily labeled ordered links', () => {
  const config = parseDeckConfig({
    ...minimal,
    subtitle: '',
    presenter: { name: 'Presenter', role: 'Engineer', organization: 'Community', avatar: { src: 'assets/avatar.webp', alt: 'Presenter image' } },
    event: { name: 'Event', date: 'Any date text', location: 'Online' },
    links: [{ label: 'My unusual website label', url: 'https://example.com/path' }, { label: 'Email', url: 'mailto:hi@example.com' }],
  });
  expect(config.subtitle).toBeUndefined();
  expect(config.presenter.avatar?.src).toBe('assets/avatar.webp');
  expect(config.event?.date).toBe('Any date text');
  expect(config.links.map((link) => link.label)).toEqual(['My unusual website label', 'Email']);
});

const invalid: [string, unknown, string][] = [
  ['missing title', { presenter: minimal.presenter }, 'title'],
  ['wrong title type', { ...minimal, title: 42 }, 'title'],
  ['empty title', { ...minimal, title: ' ' }, 'title'],
  ['missing presenter', { title: 'A talk' }, 'presenter'],
  ['wrong role type', { ...minimal, presenter: { ...minimal.presenter, role: 42 } }, 'presenter.role'],
  ['unknown field', { ...minimal, subtitel: 'Typo' }, 'subtitel'],
  ['wrong links type', { ...minimal, links: null }, 'links'],
  ['missing label', { ...minimal, links: [{ url: 'https://example.com/' }] }, 'links[0].label'],
  ['unsafe link', { ...minimal, links: [{ label: 'Unsafe', url: 'javascript:alert(1)' }] }, 'links[0].url'],
  ['relative link', { ...minimal, links: [{ label: 'Relative', url: '/somewhere' }] }, 'links[0].url'],
  ['URL credentials', { ...minimal, links: [{ label: 'Credentials', url: 'https://user:password@example.com/' }] }, 'links[0].url'],
  ['missing image alt', { ...minimal, presenter: { name: 'Presenter', avatar: { src: 'assets/avatar.webp' } } }, 'presenter.avatar.alt'],
  ['unsafe avatar', { ...minimal, presenter: { name: 'Presenter', avatar: { src: 'data:image/svg+xml,hello', alt: 'Image' } } }, 'presenter.avatar.src'],
  ['path traversal', { ...minimal, presenter: { name: 'Presenter', avatar: { src: '../avatar.webp', alt: 'Image' } } }, 'presenter.avatar.src'],
  ['encoded traversal', { ...minimal, presenter: { name: 'Presenter', avatar: { src: '%2e%2e/avatar.webp', alt: 'Image' } } }, 'presenter.avatar.src'],
  ['public prefix', { ...minimal, presenter: { name: 'Presenter', avatar: { src: 'public/assets/avatar.webp', alt: 'Image' } } }, 'presenter.avatar.src'],
  ['invalid remote image', { ...minimal, presenter: { name: 'Presenter', avatar: { src: 'https://', alt: 'Image' } } }, 'presenter.avatar.src'],
];

for (const [name, value, field] of invalid) {
  test(`configuration error identifies ${name}`, () => {
    expect(() => parseDeckConfig(value)).toThrow('deck.config.json');
    expect(() => parseDeckConfig(value)).toThrow(field);
  });
}

test('invalid JSON fails with the filename', () => {
  expect(() => parseDeckJson('{')).toThrow('deck.config.json: invalid JSON');
});

test('base paths support root and renamed project pages', () => {
  expect(normalizeBase()).toBe('/');
  expect(normalizeBase('/')).toBe('/');
  expect(normalizeBase('/another-name')).toBe('/another-name/');
  expect(assetUrl('assets/avatar.webp', '/another-name/', 'https://deck.example')).toBe('https://deck.example/another-name/assets/avatar.webp');
  expect(assetUrl('/assets/avatar.webp', '/', 'https://deck.example')).toBe('https://deck.example/assets/avatar.webp');
  expect(assetUrl('https://images.example/avatar.webp', '/another-name/', 'https://deck.example')).toBe('https://images.example/avatar.webp');
  expect(() => normalizeBase('//another-host/')).toThrow('PAGES_BASE_PATH');
  expect(() => normalizeBase('/../escape/')).toThrow('PAGES_BASE_PATH');
});
