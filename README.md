# Aspire deck template

A deck-only, Markdown-first [reveal.js](https://revealjs.com/) template in the
official Aspire visual identity. Configurable introduction, self-hosted Poppins
for prose and Fira Code for code,
light/dark themes, speaker notes, reading mode, code copy, and PDF export.
Editable diagram, fragment, auto-animate, and `apphost.mts` reference slides
demonstrate the reusable shell. The reference is displayed code, not an app.
No demo app, .NET SDK, Docker, or Aspire runtime.

The presentation shell takes its primary style cues from **[aspire.dev](https://aspire.dev/)**:
heavier Poppins headlines with open tracking, flatter light/dark surfaces,
deep-purple squared actions, subtle borders, and compact code windows.
The [Aspire Design System reference](https://claude.ai/artifact/R9zRqsnYX5uKGYbWhms7r9)
is supporting guidance, not an embedded viewer or a source of runtime dependencies.

**[Use this template](https://github.com/IEvangelist/aspire-deck-template/generate)**
&middot; **[Live example](https://ievangelist.github.io/aspire-deck-template/)**

## Make your deck

1. Select **Use this template** to create your own repository.
2. Edit `deck.config.json` for your introduction and `slides.md` for your talk.
   Put your avatar and other media in `public/assets/`.
3. In your repository's **Settings > Pages > Build and deployment > Source**,
   select **GitHub Actions**. This one-time setting is **not copied** to generated
   repositories. Enable Actions if your organization has disabled them.
4. Push to your repository's default branch. The workflow checks and builds the
   deck, then publishes through the official Pages actions. You can also run
   **Check and publish deck** manually on the default branch.

No token, secret, or owner/repository search-and-replace is required. Project
Pages paths, renamed repositories, user/organization root sites, and custom
domains use the URL and base path reported by `actions/configure-pages`.
Pull requests and non-default branches validate without deploying.

A generated repository is an independent copy, **not an automatically
synchronized fork**. Self-publishing means your pushes publish your deck;
future changes to this template do not automatically update your copy.

## Your authoring files

| File | What to edit |
| --- | --- |
| `deck.config.json` | Talk title, subtitle/description, presenter, avatar, event, and ordered links |
| `slides.md` | All content slides, including notes, fragments, code, and images |
| `diagrams.json` | Optional named rich SVG graph definitions; `{}` disables unused definitions |
| `public/assets/` | Your images and other static media |

The root `src/` directory is only the reusable deck shell. You do not need to
change it to add, remove, reorder, or name slides.

For a focused guide an AI assistant can follow, see **[SKILL.md](SKILL.md)**.
It covers authoring, alignment, diagrams, motion, code, and release checks.

### Configure the introduction

```json
{
  "title": "Your talk title",
  "subtitle": "The idea you want people to remember",
  "description": "A short summary for document and social metadata.",
  "presenter": {
    "name": "Your name",
    "role": "Your role",
    "organization": "Your organization",
    "avatar": {
      "src": "assets/avatar.webp",
      "alt": "Your preferred description of the presenter image"
    }
  },
  "event": {
    "name": "Your event",
    "date": "Your date",
    "location": "Your location"
  },
  "links": [
    { "label": "Website", "url": "https://example.com/" },
    { "label": "Get in touch", "url": "mailto:hello@example.com" }
  ]
}
```

Only `title` and `presenter.name` are required. Omit `avatar` for a clean,
text-led intro; omit `event` or `links` (or use `[]`) to remove them. Other
optional text fields can be omitted or empty. Link labels are arbitrary:
add, remove, or reorder the list without an icon or code change.
The starter config includes a clearly labeled, neutral placeholder avatar.
Replace `assets/avatar-placeholder.svg` with your image, or remove `avatar`.
The audience intro shows the title and subtitle, with presenter/event/links
secondary. `description` is **metadata/SEO only** and is not repeated as another
audience paragraph; it still supplies the document and social descriptions.

Avatar paths are relative to `public/`, **not** prefixed with `public/`:
`assets/avatar.webp` refers to `public/assets/avatar.webp`. HTTP(S) image URLs
also work, but a self-hosted image avoids an external request and dependency.
Images keep their aspect ratio, without cropping. Provide meaningful alt text.
Links accept HTTP(S) or `mailto:` URLs; unsafe schemes and credential-bearing
URLs are rejected.

Invalid configuration stops the build with the filename and field. A failed
browser load shows a real error instead of a partially working deck.

### Write slides in Markdown

The **official Reveal Markdown plugin** renders `slides.md`. Use `---` alone
on a line between horizontal slides, and optionally `--` between vertical
slides. The intro is generated separately; do not repeat it in Markdown.

````markdown
<!-- .slide: id="my-idea" -->
## One clear idea

A short explanation.

- Reveal this on advance. <!-- .element: class="fragment" -->

```typescript
const message = "Hello, presentation";
console.log(message);
```
<!-- .element: data-caption="An example" -->

![Describe the image](assets/your-image.webp)

Note:
These are presenter notes. Press S to open the speaker view.
````

Use `Note:` or `Notes:` at the beginning of a line to start speaker notes.
Notes are hidden from the audience view, **not confidential**: the Markdown
and notes are publicly served on a public static site. Do not put secrets in
them. Native Reveal `.slide` and
`.element` HTML-comment attributes work, including fragments and background
images. Basic HTML is available for advanced layouts; no custom authoring DSL.
See the [official Markdown reference](https://revealjs.com/markdown/).

Slide IDs are optional. An authored ID must be unique, begin with a letter, and
contain letters, numbers, `-`, or `_`. `intro` and shell element IDs are reserved.
Link to a named slide with `[Jump to the idea](#/my-idea)`. Without an ID, a
slide gets a positional ID such as `slide-2`; authored IDs keep links stable
when you reorder content. The menu and counter derive from the rendered leaf
slides, including vertical slides. `data-title="Short menu title"` is optional.

Use any [Highlight.js supported language or alias](https://github.com/highlightjs/highlight.js/blob/main/SUPPORTED_LANGUAGES.md),
including `python`/`py`, `rust`/`rs`, `sql`, `typescript`/`ts`, `bash`/`sh`,
`csharp`/`cs`, `json`, and `xml`/`html`. Real language modules and their
embedded-language dependencies load on demand from your own site; there is
no all-language upfront bundle or external CDN. Unlabeled fences are plaintext;
an unknown label produces an actionable error. Copy preserves the original code, not its visual
wrapping. Add `data-wrap="false"` with a `.element` comment on a code block
when you need horizontal scrolling. Only the code body scrolls; its caption
and copy button stay fixed.

Use base-relative image paths like `assets/image.webp`, rather than
hardcoding a repository URL. Keep one idea on a slide; split long material
instead of reducing the type size. Separator lines inside code examples must
be indented so they are not interpreted as actual slide boundaries.

### Small native layout presets

The baseline slide frame stays the same. Opt into three compositions with
Reveal's native slide classes; all authoring stays in `slides.md`.

````markdown
<!-- .slide: id="my-claim" class="layout-statement" -->
## One strong <em class="accent">claim.</em>

One short supporting thought.
<!-- .element: class="layout-support" -->
````

For `layout-split`, keep the heading in Markdown, then explicitly group the
copy and visual. Do not use nested `<section>` elements for columns: Reveal
interprets them as vertical slides.

```markdown
<!-- .slide: id="my-evidence" class="layout-split" -->
## A claim and its evidence

<div class="layout-copy">
  <h3>The claim</h3>
  <p>A concise explanation.</p>
</div>

<figure class="layout-visual">
  <img src="assets/evidence.webp" alt="Describe the evidence">
  <figcaption class="layout-caption">A useful caption.</figcaption>
</figure>
```

For `layout-comparison`, use a shared Markdown heading followed by
`<div class="comparison-columns">` containing two
`<div class="comparison-panel">` groups, each with a heading and comparable
content. Copy the complete example from `slides.md`.

Columns stack in DOM order for reading/compact modes; typography remains
legible rather than scaling the columns down. Code stays left-aligned and
copyable, even in a centered statement. Use `accent` selectively, not on every
paragraph. `layout-caption` is secondary supporting copy, not hidden content.

Keep large rich diagrams full-width when possible. The graph fallback now
responds to its **container width**, including a narrow split column on a wide
screen. All same-data nodes/relationships remain present. In desktop split
presentation, a tall fallback has one labeled, keyboard-scrollable region;
reading, compact, and print expand it fully. Focus that region to scroll it
without advancing the deck.

### Alignment, diagrams, icons, and motion

Markdown itself has no image alignment syntax. Reveal's **native attribute
comments** can apply the small shared `align-left`, `align-center`, and
`align-right` classes:

```markdown
![Meaningful description](assets/diagram.svg)
<!-- .element: class="align-center" -->
```

Apply a class to the whole slide with `<!-- .slide: class="align-center" -->`.
Alignment never justifies or centers source code. Native `.element` comments
apply to the preceding rendered element (an image's containing paragraph).

Copy the diagram and auto-animate examples directly from `slides.md`.
`diagram-flow`/`diagram-node` are ordinary HTML/CSS, not a diagram DSL.
Labels stay readable when the layout stacks on narrow screens. Connections can
use native fragments; paired slides use `data-auto-animate` and matching
`data-id` values. Motion is presenter-driven, with complete static equivalents
for reading, reduced motion, and print.

Diagram reveals follow **box, arrow, next box**, not all boxes followed by
arrows. In native HTML, leave the first box visible, put the first connector
at `data-fragment-index="0"`, the next box at `"1"`, the next connector at
`"2"`, and so on. Keep each complete box's icon/title/detail inside its fragment.
Copy the complete `model-to-observation` example from `slides.md` so positions
remain fixed while hidden parts reserve their space.

The auto-animate pair carries forward the completed model, moves it over
350ms, then reveals the new arrow and cache on separate advances. Matching
`data-id` values preserve context; `data-auto-animate-unmatched="false"` leaves
new parts to their explicit fragments instead of fading them in prematurely.
Rapid advance completes the previous reveal rather than overlapping steps;
Back removes the last exposed part. Static prose slides do not animate every
paragraph.

### The complete icon catalog

The full bundled [Primer Octicons catalog](https://primer.style/octicons/)
is available in slides and diagrams: **399 names / 773 size variants** in the
locked package. No TypeScript imports or allowlist edits are needed.

```html
<span data-icon="rocket"></span> Launch
<span data-icon="server"></span> API
<span data-icon="copilot"></span> Copilot
<span data-icon="git-branch"></span> A branch
<span data-icon="feed-heart-16"></span> A size-specific icon
```

Use the catalog's kebab-case name. A name selects its 24px artwork when
available, otherwise 16px (or its smallest variant). Append an exact size to
select a particular drawing, such as `copilot-48` or `arrow-right-16`.
Rendered icons inherit the current theme color and preserve their SVG viewBox;
the selected size describes the source artwork, not a fixed CSS display size.

The same names work in `diagrams.json`, for example `"icon": "server"` or
`"icon": "workflow-24"`. Invalid names and failed asset loads produce a visible
error instead of an empty icon.

Existing shortcuts keep their original drawings: `arrowLeft`, `arrowRight`,
`github`, `menu`, `screen`, `close`, `file`, and `link` still work.
In particular, `file` means `file-code-24` and `link` means `link-external-24`
for compatibility; use `file-24` or `link-24` for those canonical library icons.
Existing names like `book`, `cloud`, `code`, and `database` also stay unchanged.

All variants ship as **local, on-demand modules**, not an upfront SVG bundle
or a CDN dependency. Only the shell's small icon set and the icons actually
referenced in your Markdown or mounted diagrams are downloaded. Unused diagram
definitions do not load their icon artwork.

When upgrading `@primer/octicons`, run `npm run icons:update` to regenerate
`src/icon-catalog.ts` from the installed package; tests check that the catalog
and every variant match. Do not maintain a second hand-written icon list.
Icons are decorative support for visible labels, not a replacement for them.
Keep the MIT notice and applicable brand/trademark rights; icons do not alter
the official Aspire artwork or imply endorsement.

### Rich SVG graphs

`diagrams.json` holds named definitions for the reusable graph renderer
extracted from the source deck. Insert one using ordinary HTML in Markdown:

```html
<div data-diagram="architecture"></div>
```

Copy the generic `architecture` definition, not the source talk's graphs.
Each definition has `title`, `description`, `width`, `height`, `nodes`, and
`edges`. Bounds are at most 1440 x 640; split a larger model rather than shrinking
labels. Node fields are `id`, `title`, `detail` (an array of lines), `icon`,
`x`, `y`, `w`, `h`, optional nonnegative integer `stage` (default 0), and optional
`kind` (`hub` or `gate`). Title/detail sizes remain 22px/20px with source padding;
too-long text gives an actionable error, not squeezing or ellipsis.

Edges have unique `id`, `from`, `to`, optional `stage`, `label`, and `kind`
(`return`, `telemetry`, `context`). Side choices `fromSide`/`toSide` are
`left`, `right`, `top`, or `bottom`; automatic attachments allocate distinct
ports for fan-in/fan-out. Routes use rounded elbows. For a return path, optionally
add `via: [{"x": 100, "y": 400}, ...]`. A label may have `labelAt: {"x": 100,
"y": 420}`; otherwise it is placed between attachments. Waypoints and labels
must fit the bounds. Keep routes clear of nodes and captions.

Stage 0 is initially visible; positive stages use native fragments. Give ordered
parts separate stages: **source box 0, arrow 1, destination box 2**, then arrow 3
and box 4. A connection waits for `max(edge.stage, source.stage)`, **not** its
destination: the arrow intentionally points toward the next box before that box
appears. Return routes can point back to an already visible box. All-zero
definitions remain static.

Solid arrow routes draw over 450ms; patterned routes fade in without losing
their dash pattern. The tip and caption finish together.
The next advance settles that arrow before the next box appears. Back hides the
last part without leaving guide paths or delayed arrowheads. Read/print/reduced
motion show the complete graph.
Each mounted instance has unique SVG accessibility and marker IDs.

Narrow/compact layouts derive one ordered node-and-arrow flow from **the same
definition**, retaining every relationship and caption in reveal order.
Presentation mode keeps the current step in view, including inside a split
column's scrolling region. Reading mode remains naturally scrollable.
No tiny scaled labels,
Mermaid dependency, graph-layout platform, or custom animation controller is
needed. Empty `{}` is valid when no rich graphs are used; a referenced missing
name or invalid definition fails with the file/diagram/node/edge identified.

## Run locally

Use Node.js **22.12+ or 24 LTS** and npm.

```bash
npm ci
npm run dev
```

Open the URL Vite prints. Do not open `index.html` with `file://`.

```bash
npm test
npm run build
npm run preview
```

On a new machine, install the test browser once with
`npx playwright install chromium` (Linux may need `--with-deps`).
Tests cover authoring, optional and invalid config, keyboard/menu navigation,
notes, fragments, copying, accessibility, geometry, and root/renamed-path
production builds. No app or infrastructure is started.

For a non-Pages static host, set `PAGES_BASE_PATH` at build time to its path
(default `/`). Optionally set `PAGES_URL` to the site's full URL for canonical
metadata. These are build environment variables, not secrets.

## Present, read, print

The 56px header provides Back, Next, a slide counter, and Menu.
**Start presentation** advances to the actual next slide.

Poppins is used for headings, prose, controls, and diagram labels. Fira Code is
used for fenced and inline code, code filenames, and keyboard hints. Both fonts
are self-hosted in the static build, including when deployed below a repository
path. Code ligatures affect only drawing; copying keeps the exact source text.
Headlines use aspire.dev's heavier 650/620 weight treatment and open tracking,
not an artificially condensed Poppins appearance. Font checks inspect the
browser's actual painted glyph faces as well as loading and CSS declarations.
The toolbar has a solid-surface fallback when blur is unavailable or reduced
transparency is requested. Motion stays presenter-controlled and respects
reduced-motion preferences.

| Action | Control |
| --- | --- |
| Advance / go back | Space, arrow keys, Back / Next |
| Explore a vertical stack | Up / Down |
| Slide menu and settings | Menu; Esc closes it |
| Overview | Esc outside the menu, or Menu > Overview |
| Speaker notes | S, or Menu > Speaker notes; allow popups |
| Light / dark | T, or Menu > theme |
| Reading / presentation | R, or Menu > mode |
| Print / PDF | Menu > Print / PDF, then your browser's Print > Save as PDF |

Narrow or short screens start in readable, naturally scrolling reading mode.
Use `?mode=present` or `?mode=read` to choose explicitly, and `?theme=light` or
`?theme=dark` to pin a theme. These modes keep named-slide links working.
Forced presentation on a narrow screen reflows one slide at readable sizes
instead of shrinking a desktop canvas; long content can scroll inside the
presentation viewport. Desktop/projector typography keeps its original scale.
Reading, reduced-motion, and print show every fragment immediately.
Native fragment links such as `#/rich-architecture/2` restore that exact reveal
state, including after reload or browser Back. A plain named slide link starts
at its first state. The trailing number is Reveal's zero-based fragment index;
stage 0 is the initially visible content, not fragment 0.
The print link opens Reveal's `?print-pdf` layout with all slides, not only
the currently visible one. Code expands for print without hiding its contents.

## License and assets

Code is [MIT](LICENSE). The official Aspire artwork is unchanged and CC0,
but **trademark rights are not licensed** and no endorsement is implied.
Poppins and Fira Code are SIL OFL; Reveal and Octicons are MIT; Highlight.js is BSD-3-Clause.
See [NOTICE.md](NOTICE.md) and `public/licenses/` for relevant original notices.
Use appropriately licensed media for your own talk.
