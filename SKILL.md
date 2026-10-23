---
name: aspire-deck-authoring
description: Build and edit an Aspire-themed reveal.js slide deck from this template using Markdown, configurable intro metadata, native alignment and motion, diagrams, and syntax-highlighted code. This is deck authoring, not Aspire app/runtime setup.
---

# Author an Aspire deck

Use this guide when creating a talk from this template. Preserve the official
Aspire identity, readable slide geometry, and deck-only scope.

## Authoring surface

- `deck.config.json`: title, subtitle, summary, presenter, optional avatar/event,
  and an arbitrary ordered list of labeled links.
- `slides.md`: all authored slides and presenter notes.
- `diagrams.json`: named reusable rich SVG graph definitions; `{}` is valid.
- `public/assets/`: local images and other static media. Reference files as
  `assets/name.webp`, not `public/assets/name.webp`.

Do not repeat the generated introduction in Markdown. Omitting the avatar must
produce a clean text-led presenter column, not an invented portrait. Use actual,
appropriately licensed media with useful alt text.

Do not add a runnable AppHost, API, Dockerfile, .NET SDK, Aspire CLI install,
or other application to this template. `apphost.mts` in the starter deck is a
highlighted reference excerpt for a separate application, not a file to run here.

## Compose the story

Choose a short title and one main idea per slide. Keep titles and paragraphs
legible at projector scale; split dense content rather than shrinking type.
Use the official Aspire palette and centered content bounds. Poppins is for
headings, prose, controls, and graph labels; Fira Code is for inline/fenced code,
filenames, and keyboard hints. Both are self-hosted. Do not add Google Fonts,
a CDN, or a different font family to an individual slide.
Use aspire.dev as the primary visual authority: heavier Poppins headlines with
open tracking and one accented word, a quiet purple glow, hairline surfaces,
squared deep-purple actions, traffic-light code and diagram windows, numbered
Steps, and mono section kickers. The linked design-system
artifact is secondary guidance; do not drift into a pill-heavy/glossy shell.
Keep the 56px header compact, controls at least 44px, and code captions fixed
above the sole code-body scroller. Preserve the solid toolbar fallback for
reduced transparency and high-contrast text in both themes.
The introduction uses the original source layout and a clearly labeled neutral
placeholder avatar. Replace the configured avatar or omit it; never copy a
personal portrait or invent a headshot.
Keep title primary, subtitle supporting, and presenter/event/links secondary.
`description` remains document/social metadata only; do not echo it as another
audience paragraph or add new intro flags.

Use `---` on its own line for horizontal slides, optionally `--` for vertical
slides. Add a stable native ID when links need to survive reordering:

```markdown
<!-- .slide: id="my-idea" -->
## One useful idea

A short explanation.
```

IDs start with a letter and contain letters, numbers, `-`, or `_`. They must
be unique; `intro` and shell IDs are reserved. Use `[Jump](#/my-idea)` for a
named link. Menu entries and counts come from actual rendered leaf slides,
including vertical slides; do not maintain a separate index table.

## Alignment and media

Use Reveal's native comments, not custom Markdown syntax:

```markdown
![Describe the whole image](assets/diagram.svg)
<!-- .element: class="align-center" -->
```

Shared classes are `align-left`, `align-center`, `align-right`. A `.element`
comment applies to the previous rendered element, often the image's paragraph.
Use `<!-- .slide: class="align-center" -->` for whole-slide alignment.
Source code always remains left-aligned, including on a centered slide.

Images retain their aspect ratio. Do not crop screenshots, stretch logos,
hide meaningful content, or put a small image inside a giant empty frame.
Basic HTML is supported for layouts that Markdown cannot express.

## Native layout presets

Use three optional compositions, not a new visual system or a card grid:

- `layout-statement`: one Markdown `##` claim, optionally a selective
  `<em class="accent">` phrase, then a short paragraph with
  `<!-- .element: class="layout-support" -->`.
- `layout-split`: a Markdown heading followed by explicit `layout-copy` and
  `layout-visual` groups. Use a `div` for copy and a `figure` with an image and
  `layout-caption` for evidence. Give the visual real space and useful alt text.
- `layout-comparison`: a Markdown heading, then `comparison-columns` with two
  `comparison-panel` divs containing genuinely comparable headings/content.

Apply a preset with `<!-- .slide: id="my-slide" class="layout-split" -->`.
Copy exact editable examples from the README or `slides.md`. Ordinary Markdown
remains ordinary Markdown; HTML groups are explicit, not guessed into slots.
Never use nested `section` tags for columns, because Reveal treats them as
vertical slides. Keep the existing title/content anchors, frame, font family,
palette, and one main claim. No decorative motion on every paragraph.

Columns stack in source/reading order on narrow, compact, and reading views.
Code must stay left-aligned, preserve literal text, and retain its fixed-caption
body scroller. Captions/supporting copy are secondary but remain visible and
contrast-safe; do not hide controls or use timed/hover-only affordances.
Never add manual line breaks or replace operators to imitate code ligatures.
Fira Code handles their appearance without changing the text copied or printed.

Keep a large rich graph full-width. A graph in a narrow column must use the
same-data container-aware HTML fallback rather than tiny SVG labels. In desktop
split presentation its full content is reachable in a labeled keyboard-scrolling
region; read/compact/print expand it. Check the real column and all relationships,
not just the browser viewport width or a CSS class.

## Design components

Prefer these shell components over custom HTML. All are plain Markdown or
Reveal's native attribute comments, and all keep working in reading and print:

- Accent one heading word with Markdown bold: `## Write in **Markdown**`.
- `data-kicker="Label"` on the slide comment adds a short mono section label.
  Use it for a few chapter labels, not on every slide.
- Numbered lists render as a Steps rail. Lead each item with `**A short title.**`
  then one sentence; keep three to five steps.
- `card-row` > `card` (an icon `span`, an `h3`, one `p`) is for a few genuine
  peers. Do not make every slide a card grid.
- `<!-- .element: class="feature-list" -->` on its own line after a bullet list
  makes large numbered rows; fragment items still reveal in order.
- Fenced code and `data-diagram` graphs share one window chrome. Name it with
  `data-caption`; never fake window chrome in your own HTML.
- Tables, block quotes, `<kbd>`, and Reveal's native `class="center"` (vertical
  centering for a sparse slide) are styled by the shell.
- The hero grid belongs to the generated title slide only. Do not add grid or
  dot backgrounds to content slides; the ambient glow is already applied.

## Diagrams, icons, and motion

For richer routed graphs, edit a named definition in `diagrams.json` and insert
`<div data-diagram="architecture"></div>` in native Markdown HTML. Preserve the
SVG renderer; do not author a TypeScript graph per talk.

Use the starter schema: title/description/bounds, nodes with unique IDs,
title/detail lines/icon/x/y/w/h/stage, and edges with unique IDs/from/to/stage.
The README documents optional node/edge kinds, side attachments, return
waypoints, and caption coordinates. Ports are allocated from node geometry.
Keep boxes apart and routes/captions clear; use bounds no larger than 1440 x 640.
Do not reduce the 22px titles/20px details or their padding to fit text. Shorten
titles, add detail lines, enlarge boxes within the bounds, or split the model.

Reveal **source box, arrow, destination box** with native fragments. Use separate
stages such as source 0, edge 1, target 2, edge 3, target 4. Effective edge stage
is `max(edge.stage, source.stage)`; do not delay it until the destination is
visible. The arrow is supposed to introduce the next box. Return edges can
connect already-visible nodes; an all-zero definition is a static graph.
Keep the route, arrowhead, and caption inside the same staged group. Do not
render unfragmented guide paths or expose future boxes early. The route draws
first (patterned routes preserve their dash pattern), then its tip/caption finish;
rapid advance must settle the previous
reveal before the next part appears. Back removes the last part cleanly.
Read/print/reduced motion must show the complete graph immediately.

Use the derived narrow HTML flow from the same definitions, with every
node, relationship, and caption retained in stage order. Presentation advances
keep the current step visible in the actual viewport/scrolling region.
Never make SVG labels tiny or keep a
separate, hand-maintained mobile graph. Repeat a named diagram safely: marker
and accessibility IDs are namespaced per instance. Empty definitions are
valid; missing names/endpoints, bad stages/geometry/icons, duplicate nodes,
and text that cannot fit must fail explicitly, not lose content.

Copy and edit the connected `diagram-flow` example in `slides.md`. It is
ordinary HTML with `diagram-node` containers and decorative Octicons:

```html
<div class="diagram-node">
  <span data-icon="code"></span>
  <h3>AppHost</h3>
  <p>A readable description of its role.</p>
</div>
```

Keep the first box visible. Give its connector native fragment index 0, the
next complete box index 1, the next connector index 2, then the next box index 3.
Do not reveal every label/box upfront. The destination is deliberately hidden
until the advance after its arrow. Diagram layouts must stack with readable
labels on narrow screens, preserving arrow direction in static modes.

Connectors are bare accent arrows centred in the gap; do not wrap them in a
circle or badge. Position a connector with insets or margins, never `transform`:
Reveal's auto-animate rewrites `transform` on matched elements, which leaves a
transformed arrow off-centre after the move.

Use `<!-- .element: class="fragment" -->` on a list item or element for a
presenter-stepped reveal. For native auto-animate, use two consecutive slides
with `data-auto-animate="true"` and the same `data-auto-animate-id`; give matching
elements the same `data-id`. Carry the completed context into the second frame;
stage its new arrow and box separately and use
`data-auto-animate-unmatched="false"` to prevent automatic unmatched reveals.
Edit the starter pair rather than adding an animation controller. No autoplay
or animation library is needed.

Reading, reduced-motion, and print must show complete information immediately.
Icons are decorative support for real labels, not a replacement for them.
The complete bundled Primer Octicons catalog is available without TypeScript
edits: use `<span data-icon="rocket"></span>` in Markdown HTML or
`"icon": "server"` in a diagram node. Browse names at
https://primer.style/octicons/; use kebab-case slugs such as `git-branch`,
`copilot`, `container`, `cache`, or `workflow`.

Names select 24px artwork when available, then 16px or the smallest available
variant. Exact variants such as `copilot-48` and `feed-heart-16` also work.
The SVG retains its proportions and theme color. Old shortcut names remain
valid; `file`/`link` retain their old file-code/external-link drawings, while
`file-24`/`link-24` select the corresponding canonical library icons.

Do not import the full icon bundle, add a CDN, or copy icon files manually.
The local loader downloads only used artwork; invalid names or failed loads
must remain actionable errors, not blank success. After a package upgrade,
run `npm run icons:update` and the icon tests to refresh the generated catalog.
Keep the MIT/trademark notices and do not modify the official Aspire SVG fills
or proportions.

## Code and notes

Use fenced code with a Highlight.js supported language name or alias:

````markdown
```python
def greet(name):
    return f"Hello, {name}"
```
<!-- .element: data-caption="A small example" -->
````

All supported grammars are available through local on-demand modules, including
aliases and embedded-language dependencies. Unlabeled fences are plaintext.
Do not disguise an unknown language as successful highlighting. Copy must
preserve the exact code passed to the clipboard; visual wrapping adds no text.
For a preserved layout, add native `data-wrap="false"` to the code block.
Only the code body scrolls under its fixed caption/copy control.

Add `Note:` or `Notes:` at the start of a line for presenter notes. Notes are
hidden from the audience view but **publicly served with the Markdown** on a
public static site. They are not confidential; include no credentials or secrets.

## Check and publish

Use Node 22.12+ or 24 LTS. Run `npm ci`, then `npm run dev`. Do not use `file://`.
Before delivery run `npm test` and `npm run build`; use `npm run preview` for
the static candidate.

Check real active text/images/code, not zero-sized inactive slides. Exercise
desktop/projector light/dark and a narrow viewport, reading mode, named/vertical
links and counts, Next/Back, notes, copy, reduced motion, and full-content print.
Check that media/fonts/Markdown/language modules still load under both `/` and
a renamed project Pages path.
Walk every slide forward and backward through every reveal, including the
box/arrow boundaries and auto-animate pair. Check actual painted visibility
and in-progress/settled arrow drawing, not only fragment classes. Test rapid
input, `#/slide-id/fragment-index` reload/history restoration, narrow scroll
regions, and immediate complete static modes.
Check the actual painted glyph fonts, not only `font-family` declarations or
`document.fonts` entries: Chromium's `CSS.getPlatformFontsForNode` must report
custom Poppins faces for visible headings/prose and Fira Code faces for visible
code. The tests include this check in both development and portable builds.

The generated repository needs **Settings > Pages > Source: GitHub Actions**
once. Push to its actual default branch to validate and publish. Use the
workflow's Pages metadata for base/canonical URLs, never hardcode an owner or
repository path. No PAT or extra runtime setup is required.

Template copies are independent; self-publishing does not synchronize future
upstream template changes. Preserve LICENSE/NOTICE and relevant asset notices.
