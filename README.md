# Aspire deck template

A deck-only, Markdown-first [reveal.js](https://revealjs.com/) template in the
official Aspire visual identity. Configurable introduction, self-hosted Poppins
for prose and Fira Code for code,
light/dark themes, speaker notes with a real presenter view, reading mode, code
copy, and PDF export. Slide transitions are configurable for the whole deck, a
chapter, or one slide, and link previews come from one `social` block.
Teach with step-by-step highlighted code lines, side-by-side code,
color-coded package and API legends, and a
reveal-on-click command with its recorded output, all from plain Markdown.
Editable diagram, fragment, auto-animate, and `apphost.mts`, C#, and Go reference slides
demonstrate the reusable shell. The reference is displayed code, not an app.
No demo app, .NET SDK, Docker, or Aspire runtime.
The starter deck also teaches itself: its **Guide** chapter walks through the
files, every `deck.config.json` setting, Markdown authoring, teaching patterns,
diagrams and media, presenting, and publishing.

The presentation shell takes its primary style cues from **[aspire.dev](https://aspire.dev/)**:
heavier Poppins headlines with open tracking and a single accented word, a
quiet deep-purple glow, hairline surfaces, squared actions, traffic-light code
and diagram windows, numbered Steps, mono section kickers, and the faint hero
grid behind the title slide.
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

The workflow's checks are `npm test`, which validates your deck and keeps passing
after you replace, rename, or remove every starter slide. Only this template's
own repository also runs `npm run test:starter`; see [Run locally](#run-locally).

A generated repository is an independent copy, **not an automatically
synchronized fork**. Self-publishing means your pushes publish your deck;
future changes to this template do not automatically update your copy.

## Your authoring files

| File | What to edit |
| --- | --- |
| `deck.config.json` | Talk title, subtitle/description, presenter, avatar, event, ordered links, slide transitions and chapters, the corner slide counter, and the share image |
| `slides.md` | All content slides, including notes, fragments, code, and images |
| `diagrams.json` | Optional named rich SVG graph definitions; `{}` disables unused definitions |
| `public/assets/` | Your images and other static media |

The root `src/` directory is only the reusable deck shell. You do not need to
change it to add, remove, reorder, or name slides.

The **Guide** chapter in the starter slides (ids `guide-start` through
`guide-publish`, between `transitions` and `publish-on-push`) is this document
in slide form, with presenter notes on each slide. When you replace the starter,
delete those slides. `npm test` stays green because the tests that check the
starter's own slides are run only by `npm run test:starter` (see
[Run locally](#run-locally)).

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

### Share previews

The optional `social` block controls the preview shown when someone shares your
deck's link (Open Graph and Twitter cards). The starter ships one for this
template. **Replace it for your own deck.**

```json
"social": {
  "image": "assets/social-card.png",
  "alt": "Describe the image, including any text on it.",
  "title": "Your talk title",
  "description": "One sentence for link previews.",
  "siteName": "Your event or site"
}
```

- `image` and `alt` go together. `image` is a **PNG path relative to `public/`**:
  1200 x 630 is ideal, 600 x 315 is the minimum, and the file must stay under
  5 MB. The build reads the real width and height and publishes them with the
  tags. A missing, non-PNG, or too small file stops the build with the field named.
- `title`, `description`, and `siteName` are optional. Without them the preview
  uses your top-level `title` and `description`, and no site name.
- Image tags need an absolute URL, so they appear when the site URL is known: the
  Pages workflow supplies it, and `PAGES_URL` does the same for another host.
  Without it the page keeps a text-only `summary` card.
- **A generated copy must replace the starter card.** It names this template and
  its author. Replace `public/assets/social-card.png`, edit every `social`
  field, or delete the `social` block for a text-only preview. The title slide
  and presenter never read this block.

This repository's **GitHub link preview** is a different, per-repository setting.
Upload `.github/social-preview.png` (1280 x 640, under 1 MB) once: **Settings >
Social preview > Edit > Upload an image**, as described in
[Customizing your repository's social media preview](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/customizing-your-repositorys-social-media-preview).
Committing the file does not set it. The site's own preview above is applied by
the build and needs no extra step.

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
and copy button stay fixed. To walk through lines, show two files together, or
reveal a command's output, see [Teach with code](#teach-with-code).

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

### Teach with code

Four optional patterns build on ordinary fenced code. They are native Markdown
and Reveal fragments, so Next, Back, `#/slide-id/N` links, the fragment counter,
overview, reading mode, print, and reduced motion behave as they do everywhere
else. Nothing here needs a TypeScript edit.

**Step through the lines.** Put a bracketed list right after the language, with
a space between them. Each `|` is one Next; `,` and `-` pick lines within a
step. Numbers count from the first line of the block.

````markdown
```typescript [1|3|4-5|7]
import { createBuilder } from "./.aspire/modules/aspire.mjs";

const builder = await createBuilder();
const api = await builder.addNodeApp("api", "./api", "src/index.ts")
  .withHttpEndpoint({ env: "PORT" });
await builder.build().run();
```
<!-- .element: data-caption="apphost.mts" -->
````

- The first step is highlighted when the slide opens. Each Next moves the
  highlight, and each Back returns it. `[2]` is one permanent highlight, `[]`
  shows line numbers with no highlight, and `[40: 1-2|3]` starts the displayed
  numbers at 40 while the lists still count from the first line.
- Highlighting and numbers are visual only. Selecting, **Copy**, and print keep
  the exact source; the code is never reformatted, and blank lines survive.
- A long block scrolls inside its own body to keep the highlighted lines in
  view while the caption and Copy stay fixed.
- Reading mode, print, and reduced motion show the complete code without the
  step highlight.
- Steps are fragments, so they advance in document order with the other
  fragments on the slide. A list outside the block (`[1-9]` on five lines) or
  with a stray character stops the load with the slide id and the problem.

**Put code side by side.** Reuse `layout-split`. Two `layout-visual` groups
share equal columns. One `layout-copy` beside one `layout-visual` puts an
explanation next to code. Leave a blank line after the opening `<div>` and
before the closing `</div>` so the Markdown inside renders. Do not use nested
`<section>` elements for columns.

````markdown
<!-- .slide: id="before-after" class="layout-split" -->
## Two files, **side by side**

<div class="layout-visual">

```typescript
const port = 5000;
app.listen(port);
```
<!-- .element: data-caption="before.ts" -->

</div>

<div class="layout-visual">

```typescript
const port = env.PORT;
app.listen(port);
```
<!-- .element: data-caption="after.ts" -->

</div>
````

Keep each excerpt short. Long lines wrap inside the panel rather than shrinking
the type, and each panel keeps its fixed caption, Copy, and single scrolling
body. Visual order follows document order. The columns stack in the same order
on narrow screens and in reading mode.

**Reveal a command, then its output.** Put the command and its complete output
in two adjacent fences. Mark the command with `data-terminal` and a value.

````markdown
```bash
node -p "JSON.stringify({ web: 8000 }, null, 2)"
```
<!-- .element: data-terminal="Recorded example" data-caption="Terminal" -->

```json
{
  "web": 8000
}
```
````

- The slide opens with the command alone. One Next expands the complete output
  in a short, bounded motion; the next Next moves on, and Back collapses it.
  The output is a native fragment, so `#/slide-id/0` shows it and rapid input,
  theme changes, resizing, and jumps always settle to the real state.
- The value of `data-terminal` is the visible label. Use short, true text such
  as `Recorded example` or `Recorded with Node 22 on 2026-10-23`. It is always
  shown, so a static page never claims the command just ran. `data-caption`
  names the window (default `Terminal`).
- **Copy** copies the command without its `$` prompt. The output is exact,
  selectable text. Only the output body scrolls, up to a capped height; the
  header and command stay fixed. Reading mode and print show the whole output.
- Paste the real, complete output of the command and do not edit it. Output
  labeled `json` must be valid, complete JSON. A command that asks for JSON
  (`--json`, `--format json`, `--output json`, `--output=json`, `-o json`, in any
  letter case) needs a `json` output.
  A missing, empty, or incomplete output stops the load with the slide id.
- There is no autoplay, typing animation, or live shell. Nothing runs on the
  page: the starter's example is a real Node 22 capture, labeled as recorded.

**Give a long output the whole slide (optional).** An output scrolls in a short
box beneath the heading. On a slide where the output is the point, opt in with
`data-terminal-focus="true"` in the slide comment, and mark the provenance line
that can step aside with the class `terminal-support`:

````markdown
<!-- .slide: id="run-and-reveal" data-terminal-focus="true" -->
## Run it, then **reveal** the result

(the command fence and its output fence, as above)

Recorded with Node 22 on 2026-10-23; the output is pasted exactly as printed.
<!-- .element: class="source-line terminal-support" -->
````

- **Presenting.** When the output appears (Next, a deep link such as
  `#/run-and-reveal/0`, Forward, or the speaker view), the kicker and heading fold
  away, every `terminal-support` line is hidden and leaves the Tab order, and
  the window moves up into the freed space. The output flexes to the remaining
  height, above the slide counter and the copy message, and scrolls on its own;
  the header, command, and Copy stay put. A short output keeps its natural
  height. Back restores the standard slide, heading, line, and links included.
- **Everything else keeps every line.** Reading mode and print show the heading,
  the support lines, and the complete output, as before. With reduced motion
  there is no stepping, so the finished layout shows at once and nothing
  animates; otherwise one short ease moves the heading away. The speaker view's
  current and upcoming previews follow the audience's output.
- **Only what you mark is hidden.** Nothing else on the slide is inferred. The
  only accepted value is `"true"`; an empty or other value, the attribute on an
  element instead of the slide comment, a slide without exactly one recorded
  terminal, or a terminal inside a layout column or card stops the load with
  the slide id. Leave the attribute out for the standard layout.

**Color-code the packages behind the APIs.** Show which integration package
owns each call: a legend above the code, bold colored API names, and a colored
rail beside each statement. It is optional, visual only, and set with native
attribute comments on the code block, one group of four attributes per color.

````markdown
```csharp
var cache = builder.AddRedis("cache");
var web = builder.AddViteApp("web", "./web")
    .WithReference(cache);
```
<!-- .element: data-caption="AppHost.cs" -->
<!-- .element: data-pkg-pink="Aspire.Hosting.Redis" data-add-pink="redis" data-apis-pink="AddRedis" -->
<!-- .element: data-pkg-cyan="Aspire.Hosting.JavaScript" data-add-cyan="javascript" data-apis-cyan="AddViteApp" -->
````

| Attribute | Meaning |
| --- | --- |
| `data-pkg-<color>` | The package name shown in the legend, such as `Aspire.Hosting.Redis`. |
| `data-add-<color>` | What follows `aspire add`, shown in the legend as `aspire add redis`. Give this, `data-pkg-<color>`, or both. |
| `data-apis-<color>` | **Required.** The exact identifiers this package owns, separated by spaces. Only these are colored. |
| `data-lines-<color>` | Optional rail lines such as `4-6` or `1,3-4`. By default the rail covers every line that uses one of the APIs. |

The colors are `purple`, `cyan`, `pink`, and `teal`. The starter pairs each with
one package (cyan `Aspire.Hosting.JavaScript`, pink `Aspire.Hosting.Redis`,
teal `Aspire.Hosting.Go`) and keeps purple for any other, so a color means one
package across the deck. Calls that belong to the AppHost itself or to the
language stay neutral, which is what makes the colored ones stand out.

- Names inside strings and comments are never colored. Selecting and **Copy**
  keep the exact source: the legend, colors, and rails add no characters.
- It combines with line steps (`[1|3|4-5]`), starting line numbers, and
  side-by-side layouts. A band of highlighted lines rounds only its two ends.
- Contrast stays at least 4.5:1 on the code window in both themes. Print uses
  deeper tones on its light code surface.
- A mistake stops the load with the slide and block: an unknown color, a color
  with no `data-apis`, a missing package label, an API that is not in the code,
  one API claimed by two packages, overlapping lines, or lines outside the block.
- Go is a workload, not an AppHost language. The starter shows `main.go` as the
  service, and `AppHost.cs` with `AddGoApp` from `Aspire.Hosting.Go`
  (`aspire add go`), which is the only part tinted teal.

### Hold long detail in a disclosure

Use a native `<details>` with a `<summary>` for supporting material you want at
hand but not on the slide, such as a long history or a full listing. There is no
attribute to add: every `<details>` on a slide is enhanced automatically, so a
generated deck cannot expand a slide past the screen.

````markdown
<!-- .slide: id="history" -->
## The history

<details>
<summary>Show the full history</summary>

- Entry one
- Entry two

```bash
aspire logs api --follow
```
</details>
````

Leave a blank line after `</summary>` so the Markdown inside renders.

- **Presenting.** The summary opens its content in one modal dialog with its
  own scroll, instead of expanding the slide. The slide, the address, the
  counter, and every scroll position stay exactly as they were, so the audience
  never loses its place. Escape or Close returns you to the summary, and Next
  and Back work as before. Deck keys do nothing while the dialog is open, and a
  slide change, the overview, a mode switch, or printing closes it.
- **Reading mode** expands it inline, as a plain `<details>`. A disclosure
  written `<details open>` starts open there and starts closed while presenting.
- **Print** includes the content: every disclosure is printed open.
- The speaker view's previews and the overview keep it closed and ignore a
  click. Without script it is a plain `<details>`, so it also works when the
  Markdown is read in the repository.
- Links, code windows, and Copy inside the dialog work as on a slide. A
  disclosure nested inside another opens inside the dialog. Put long content
  here rather than shrinking the type.

### Design components

The shell ships a few reusable parts in the aspire.dev style. They are plain
Markdown, Reveal's native attribute comments, or small HTML snippets: no new
syntax and nothing to change in TypeScript. Copy working examples from
`slides.md`.

| Part | How to author it |
| --- | --- |
| Accent word | Bold one word in a heading: `## Write in **Markdown**`. It takes the accent color at the heading's own weight. |
| Section kicker | Add `data-kicker="Author"` to the slide comment: `<!-- .slide: id="author" data-kicker="Author" -->`. Omit it for no label. |
| Steps | Any numbered list becomes a Steps rail. Lead each item with `**A short title.**`, then one sentence. |
| Cards | `<div class="card-row">` containing `<div class="card">` groups of `<span data-icon="rocket"></span>`, an `<h3>`, and one `<p>`. Use them for a few genuine peers, not on every slide. |
| Feature rows | After a bullet list, add `<!-- .element: class="feature-list" -->` on its own line for large numbered rows. Fragment items still reveal in order. |
| Windows | Fenced code and `data-diagram` graphs share one window chrome. Name a code window with `data-caption`; a diagram uses its JSON `title`, or `data-caption` on the `div`. |
| Tables, quotes, keys | Standard Markdown tables become a rounded panel, `> a quote` becomes a quote panel with an accent mark, and `<kbd>Down</kbd>` renders a key cap. |
| Centered slide | Reveal's native `<!-- .slide: class="center" -->` vertically centers a sparse slide. Content slides otherwise keep one top anchor. |
| Disclosure | A native `<details>` with a `<summary>` holds long detail. While presenting it opens in a dialog, so the slide never grows. See [Hold long detail in a disclosure](#hold-long-detail-in-a-disclosure). |
| Accent color | `data-accent="cyan"` (or `pink`, `teal`) in a slide comment retargets that slide's kicker, accent word, and bullets; on a `.card` it retargets just that card. Without it a slide keeps the Aspire purple. The starter uses cyan for code and reference slides and teal for running it. Use it for a few chapter labels, not on every slide. |

The title slide adds the aspire.dev hero grid (1px lines on a 72px cell that
fade toward the edges) behind its intro. It appears only there, fades out as you
move on, and is not printed. The ambient glow behind every slide is decorative
and also disappears for print. Light and dark keep the same structure.

Keep large rich diagrams full-width when possible. The graph fallback now
responds to its **container width**, including a narrow split column on a wide
screen. All same-data nodes/relationships remain present. In desktop split
presentation, a tall fallback has one labeled, keyboard-scrollable region;
reading, compact, and print expand it fully. Focus that region to scroll it
without advancing the deck.

### Choose how slides move

Moving from one slide to the next uses Reveal's own transition system, which you
can set at three levels. The most specific one wins: **deck < chapter < slide**.

**The whole deck.** `transition` in `deck.config.json` is the default for every
slide. Omit it for the quiet fade shown here.

```json
"transition": { "style": "fade", "speed": "fast", "background": "none" }
```

**A chapter.** A chapter is a named set of transition settings. Define it in
`deck.config.json`, then start it on a slide with `data-chapter`. It covers that
slide and every slide after it until a slide starts another chapter, and it
fills in each value those slides have not set themselves. A chapter that sets
nothing (`{}`) returns to the deck default.

```json
"chapters": {
  "code": { "style": "slide" },
  "diagrams": {}
}
```

```markdown
<!-- .slide: id="copyable-code" data-chapter="code" -->
```

A chapter can begin again later, so one definition can cover several runs of
slides. A definition that no slide uses does nothing, so replacing the starter
slides never breaks the deck.

**One slide.** Reveal's native attributes in the slide comment always win:

```markdown
<!-- .slide: id="big-idea" data-transition="slide-in fade-out" data-transition-speed="slow" -->
```

| Setting | In `deck.config.json` | On a slide | Values |
| --- | --- | --- | --- |
| Style | `style` | `data-transition` | `none`, `fade`, `slide`, `convex`, `concave`, `zoom` |
| Speed | `speed` | `data-transition-speed` | `default`, `fast`, `slow` |
| Background | `background` | `data-background-transition` | the six styles; it matters only for slides with a `data-background-*` |

- A chapter or slide style may split entering from leaving, as in
  `"slide-in fade-out"`: one `-in` and one `-out` style from `fade`, `slide`,
  `convex`, `concave`, or `zoom` (never `none`), in either order. The deck
  default and backgrounds take a single style.
- Each setting resolves on its own. A slide that sets only
  `data-transition-speed` still receives its chapter's style.
- A chapter applies to slides, including slides in a vertical stack. Reveal moves
  into and out of a whole stack with the stack's own motion, so that one move
  follows the deck default; moves between the slides inside it follow the chapter.
- Reveal's `fade` is a fixed half-second dissolve, so speed changes the other
  styles. Reveal also cannot return one slide to `default` speed while the whole
  deck is `fast` or `slow`.
- Use motion for continuity: a quiet default, one chapter that moves differently,
  and the occasional explicit slide, as the starter does. Its **Choose how slides
  move** slide arrives with `slide-in` and leaves with `fade-out`.
- Reading mode, print, reduced motion, and the speaker view's previews never
  animate, whatever the settings. The authored attributes stay in place and apply
  again when you present.
- A mistake stops the load and names it: an unsupported style or speed, an
  incomplete in/out pair, or a slide whose `data-chapter` is not defined (the
  message lists the chapters that are).

The browser's View Transitions API is deliberately not used. Reveal's native
transitions already cover moving between slides, and a second layer would have to
intercept every way a slide changes (keys, toolbar, history, deep links, the
speaker view) while staying out of previews, reading, print, and reduced motion.

### Slide counter

A small badge shows the current slide and the total, such as `3 / 29`. It sits in
a corner of the screen rather than in the toolbar, on its own solid surface, so no
slide can make it hard to read. Move or hide it with the optional `slideNumber`
block in `deck.config.json`:

```json
"slideNumber": { "visible": true, "position": "bottom-left" }
```

- `position` is `top-left`, `top-right`, `bottom-left` (the default), or
  `bottom-right`. The top corners sit just below the toolbar.
- `visible` is `true` (the default) or `false`. `"visible": false` hides the badge
  completely, including from screen readers.
- Leave `slideNumber` out, or either field, and you get the default: visible, at the
  bottom left. Any other field, a `visible` that is not `true` or `false`, or a
  position that is not one of the four corners stops the build and the page with
  `deck.config.json: slideNumber...` and the field named.
- The count follows every slide, including vertical ones. A code step or fragment
  does not change it. Screen readers hear a polite "Slide N of M". The badge takes
  no clicks and no focus, and it never animates.
- Presenting and reading mode show it. Print and the speaker view's two previews
  never do, whatever you configure.
- Copy and error messages also appear at the bottom left. Beside a visible
  bottom-left badge a message stacks just above it; with any other setting it stays
  where it is, and beside a bottom-right badge it leaves the badge room.

The counter is the deck's own. Reveal's built-in slide number stays off.

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

Flow connectors are bare accent arrows (`<span class="diagram-connector" data-icon="arrowRight">`)
centred in the gap, with no circle or badge around them. The shell positions
them with insets and margins, not `transform`, because Reveal's auto-animate
rewrites `transform` on matched elements and would knock a transformed arrow
off-centre once the move ends. Keep any restyling of a connector off `transform`.

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
npm run test:starter
npm run build
npm run preview
```

On a new machine, install the test browser once with
`npx playwright install chromium` (Linux may need `--with-deps`).

`npm test` validates **your deck**. It checks authoring, optional and invalid
config, keyboard/menu navigation, notes, fragments, copying, code steps and
terminal output (including terminal focus), the slide counter, accessibility, geometry, and root/renamed-path
production builds. None of its tests depends on a starter slide id or copy, so it
keeps passing after you replace, rename, remove, or reorder every starter and
guide slide. No app or infrastructure is started.

`npm run test:starter` maintains **this template's own shipped examples**: the
starter slides, their code walkthroughs, diagrams and motion, the speaker notes,
and the Guide chapter. It then builds and tests a throw-away copy of this project
with every slide, the config, the diagrams, and the assets replaced by
`tests/fixtures/generated-copy`, which proves a generated repository stays green
(`scripts/generated-copy.mjs`). This template's CI runs it; a repository generated
from the template does not, because its workflow runs `npm test` only. A test that
asserts a starter id, copy, diagram, or note is passed the `starter` tag from
`tests/starter.ts`, and `npm test` leaves every tagged test out. Keep the starter
slides if you like, and run `npm run test:starter` yourself to guard them.

For a non-Pages static host, set `PAGES_BASE_PATH` at build time to its path
(default `/`). Optionally set `PAGES_URL` to the site's full URL for canonical
metadata. These are build environment variables, not secrets.

## Present, read, print

The 56px header provides Back, Next, and Menu. The slide counter is a separate
badge in a corner of the screen; see **Slide counter** above for its position and
how to hide it.
**Start presentation** advances to the actual next slide. The menu is a fixed
panel: the heading and the theme, reading, overview, notes, and print controls
stay visible while only the slide list scrolls.

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

Clicking **Copy** hands the arrow keys back to the deck, and so does clicking a
short code block. A code block that scrolls keeps its own arrow and Page keys
while it has focus, so you can read it without leaving the slide; click the slide
or Tab away to give the keys back.

### Speaker notes

Everything after `Note:` on a slide is a presenter note, and the starter's
slides carry short `Cue:` lines you can replace. Press **S**, or choose Menu >
**Speaker notes**, to open Reveal's own speaker view in a second window. It shows
the current slide, what Next will reveal, your notes, the time of day, and a timer.

1. Allow pop-ups for the site. If the browser blocks the window the deck says so;
   allow it and press S again.
2. Put the deck window on the projector and drag the speaker window to your own
   screen. Both stay in step with every code step, Next, Back, and slide change,
   and keys pressed in the speaker window drive the audience window.
3. The two previews are the real slides at the audience's proportions, without
   the toolbar, and they skip transitions so each step lands at once. Opening the
   speaker view mid-slide never moves the audience, and a reloaded preview
   returns to the audience's step by itself.

**Notes are public, not confidential.** They live in `slides.md`, which the
published site serves to every visitor, and they are hidden from the audience's
screen, not secret. Never put anything in a note that you would not publish.

## License and assets

Code is [MIT](LICENSE). The official Aspire artwork is unchanged and CC0,
but **trademark rights are not licensed** and no endorsement is implied.
Poppins and Fira Code are SIL OFL; Reveal and Octicons are MIT; Highlight.js is BSD-3-Clause.
See [NOTICE.md](NOTICE.md) and `public/licenses/` for relevant original notices.
Use appropriately licensed media for your own talk.
