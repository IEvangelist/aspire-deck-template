<!-- .slide: id="make-it-yours" data-kicker="Start here" -->
## Make it **yours**

One deck. No application to maintain.

<div class="card-row">
  <div class="card">
    <span data-icon="person"></span>
    <h3>Your introduction</h3>
    <p>Set it in <code>deck.config.json</code></p>
  </div>
  <div class="card" data-accent="cyan">
    <span data-icon="markdown"></span>
    <h3>Your slides</h3>
    <p>Write them in <code>slides.md</code></p>
  </div>
  <div class="card" data-accent="pink">
    <span data-icon="image"></span>
    <h3>Your media</h3>
    <p>Add files to <code>public/assets/</code></p>
  </div>
</div>

Note:
Replace these starter slides with your own story. The intro is generated from
your configuration, so you do not need to repeat it in this file.

---

<!-- .slide: id="write-in-markdown" class="layout-split" data-kicker="Author" -->
## Write in **Markdown**

<div class="layout-copy">

Put `---` on its own line to start another slide.

Headings, lists, links, images, and code all work. Add HTML only for a custom layout.

</div>

<div class="layout-visual">

```markdown
## Your next idea

A short explanation, a useful example.

- Something worth remembering
- Something worth trying
```
<!-- .element: data-caption="slides.md" -->

</div>

Note:
Keep one main idea on each slide. Ordinary Markdown is enough; HTML is optional
for advanced layouts.

---

<!-- .slide: id="copyable-code" data-kicker="Code" data-accent="cyan" data-chapter="code" -->
## Code you can **copy**

Fenced code gets real syntax highlighting. Copy keeps the original text.

```bash
npm ci
npm run dev

# Build a static presentation
npm run build
npm run preview
```
<!-- .element: data-caption="Local deck workflow" -->

Note:
These commands run the deck, not an Aspire application. No .NET SDK, Docker,
or Aspire CLI is required.
Cue: the Code chapter starts here, so slides now move sideways until the
diagrams chapter returns to the quiet fade.

---

<!-- .slide: id="apphost-example" data-kicker="Reference" data-accent="cyan" -->
## A small **AppHost**

```typescript [1|3|4-5|6|7]
import { createBuilder } from "./.aspire/modules/aspire.mjs";

const builder = await createBuilder();
const api = await builder.addNodeApp("api", "./api", "src/index.ts")
  .withHttpEndpoint({ env: "PORT" });
await builder.addViteApp("web", "./web").withReference(api).waitFor(api);
await builder.build().run();
```
<!-- .element: data-caption="apphost.mts | reference only" -->
<!-- .element: data-pkg-cyan="Aspire.Hosting.JavaScript" data-add-cyan="javascript" data-apis-cyan="addNodeApp addViteApp" data-lines-cyan="4-6" -->

Advance to walk through the highlighted lines. An [official-guide](https://aspire.dev/get-started/first-app.md) reference:
the app folders and generated modules belong to a separate Aspire app.
<!-- .element: class="source-line" -->

Note:
This is a slide example, not a runnable app included with this template.
The reference models an API, a frontend, and the dependency between them.
To step through your own code, add line steps after the language, such as
`[1|3-5|7]`. Each Next moves the highlighted lines; Back returns.
Cue: the cyan legend names the package that owns addNodeApp and addViteApp
(Aspire.Hosting.JavaScript, added with `aspire add javascript`). The uncolored
calls (createBuilder, withHttpEndpoint, withReference, waitFor, build, run) are
core Aspire.Hosting. Next goes line by line: the builder, the API, then the
frontend that waits for it.

---

<!-- .slide: id="apphost-csharp" data-kicker="Reference" data-accent="cyan" -->
## A top-level **C#** AppHost

```csharp
var builder = DistributedApplication.CreateBuilder(args);

var cache = builder.AddRedis("cache").WithRedisCommander();
var api = builder.AddGoApp("api", "./api").WithReference(cache);
builder.AddViteApp("web", "./web").WithReference(api);

builder.Build().Run();
```
<!-- .element: data-caption="AppHost.cs | top-level program" -->
<!-- .element: data-pkg-pink="Aspire.Hosting.Redis" data-apis-pink="AddRedis WithRedisCommander" -->
<!-- .element: data-pkg-teal="Aspire.Hosting.Go" data-apis-teal="AddGoApp" -->
<!-- .element: data-pkg-cyan="Aspire.Hosting.JavaScript" data-apis-cyan="AddViteApp" -->

Each package owns its APIs and takes its legend color. Uncolored calls are core Aspire.Hosting.
<!-- .element: class="source-line" -->

Note:
Cue: read the legend first, three packages and three colors. Pink is
Aspire.Hosting.Redis (AddRedis, WithRedisCommander), teal is Aspire.Hosting.Go
(AddGoApp) and cyan is Aspire.Hosting.JavaScript (AddViteApp). Add one with
`aspire add redis`, `aspire add go` or `aspire add javascript`, or with the exact
package name. The uncolored calls (CreateBuilder, WithReference, Build, Run) are
core Aspire.Hosting. This is displayed code: nothing here runs in the template.

---

<!-- .slide: id="go-workload" data-kicker="Workload" data-accent="teal" -->
## A **Go** service, run by the AppHost

```go
func main() {
    port := os.Getenv("PORT")
    http.HandleFunc("/", hello)
    log.Fatal(http.ListenAndServe(":"+port, nil))
}
```
<!-- .element: data-caption="main.go | Go workload (excerpt)" -->

```csharp
builder.AddGoApp("api", "./api")
    .WithHttpEndpoint(env: "PORT");
```
<!-- .element: data-caption="AppHost.cs | the AppHost starts it" -->
<!-- .element: data-pkg-teal="Aspire.Hosting.Go" data-add-teal="go" data-apis-teal="AddGoApp" data-lines-teal="1-2" -->

Go is a workload, not an AppHost language: AppHosts are written in C# or TypeScript.
<!-- .element: class="source-line" -->

Note:
Cue: Go is a workload here, not an AppHost language. AppHost authoring is C# or
TypeScript, and the AppHost starts the Go app. Aspire.Hosting.Go (added with
`aspire add go`, Aspire 13.4 and later) provides AddGoApp; the older Community
Toolkit Golang package is deprecated. main.go reads PORT, which
WithHttpEndpoint(env: "PORT") sets. Only the teal AddGoApp call is Aspire code;
the Go excerpt uses the standard library.

---

<!-- .slide: id="compare-code" class="layout-split" data-kicker="Compare" data-accent="cyan" -->
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

Two `layout-visual` groups share equal columns. Put a `layout-copy` group beside one for an explanation.
<!-- .element: class="source-line" -->

Note:
Each group holds an ordinary fenced code block, so syntax highlighting, Copy,
and the single scrolling body all keep working. The groups stack in reading
order on narrow screens and in reading mode.

---

<!-- .slide: id="run-and-reveal" data-kicker="Terminal" data-accent="teal" data-terminal-focus="true" -->
## Run it, then **reveal** the result

```bash
node -p "JSON.stringify({ web: 8000, api: 8001, cache: 8002 }, null, 2)"
```
<!-- .element: data-terminal="Recorded example" data-caption="Terminal" -->

```json
{
  "web": 8000,
  "api": 8001,
  "cache": 8002
}
```

Recorded with Node 22 on 2026-10-23; the output is pasted exactly as printed. Advance once to reveal it.
<!-- .element: class="source-line terminal-support" -->

Note:
Nothing runs on this page. The command was run once and its complete output
pasted here, so the label stays on screen. Replace both with your own
capture. Output labeled json must be complete, valid JSON.
This slide also opts in to terminal focus: its slide comment sets
data-terminal-focus="true" and the provenance line above is marked
terminal-support. When the output appears while presenting, the heading and
that line fold away and the window moves up to use the whole slide, which
matters most for a long output that would otherwise scroll in a short box.
Reading mode and print keep the heading and the line.

---

<!-- .slide: id="rich-architecture" data-kicker="Diagram" data-chapter="diagrams" -->
## Route a **richer** model

<div data-diagram="architecture"></div>

Edit `diagrams.json`. Advance the model, ports, connections, and return path.
<!-- .element: class="source-line" -->

Note:
This is a generic authoring example, not a running app. Reveal the AppHost,
its arrow, then the API; continue through the cache, return, and frontend branch.
Each arrow follows its source box and precedes its new destination box.
The narrow layout follows the same sequence. Back rewinds one step at a time.

---

<!-- .slide: id="model-to-observation" data-kicker="Flow" -->
## Show the **relationship**

<ol class="diagram-flow" aria-label="AppHost model to resources to observation">
  <li>
    <div class="diagram-node">
      <span data-icon="code"></span>
      <h3>Model</h3>
      <p>Describe the resources and their relationships.</p>
    </div>
  </li>
  <li>
    <span class="diagram-connector fragment" data-fragment-index="0" data-icon="arrowRight"></span>
    <div class="diagram-node fragment" data-fragment-index="1">
      <span data-icon="cloud"></span>
      <h3>Resources</h3>
      <p>Connect the services your application needs.</p>
    </div>
  </li>
  <li>
    <span class="diagram-connector fragment" data-fragment-index="2" data-icon="arrowRight"></span>
    <div class="diagram-node fragment" data-fragment-index="3">
      <span data-icon="graph"></span>
      <h3>Observation</h3>
      <p>Understand what happens when they run.</p>
    </div>
  </li>
</ol>

Advance: model, arrow, resource, arrow, observation.
<!-- .element: class="source-line" -->

Note:
This editable HTML diagram lives entirely in Markdown. The connectors use
native fragments. On narrow screens it stacks vertically without tiny labels.
Reading, reduced-motion, and print show the complete relationship immediately.

---

<!-- .slide: id="animate-a-model" data-kicker="Animate" data-auto-animate="true" data-auto-animate-id="model-example" data-auto-animate-unmatched="false" -->
## Change the **model**

<ol class="diagram-flow two-nodes" aria-label="Frontend connected to API">
  <li><div class="diagram-node" data-id="example-web">
    <span data-icon="screen"></span><h3>Frontend</h3><p>The experience people use.</p>
  </div></li>
  <li><span class="diagram-connector fragment" data-fragment-index="0" data-id="example-web-api" data-icon="arrowRight"></span>
    <div class="diagram-node fragment" data-fragment-index="1" data-id="example-api">
      <span data-icon="code"></span><h3>API</h3><p>The service behind it.</p>
    </div>
  </li>
</ol>

Build the connection first; then advance to extend the model.
<!-- .element: class="source-line" -->

Note:
Matching data-id attributes connect the same elements on consecutive slides.
There is no autoplay, custom animation controller, or animation library.

---

<!-- .slide: id="animate-add-cache" data-kicker="Animate" data-auto-animate="true" data-auto-animate-id="model-example" data-auto-animate-unmatched="false" -->
## Change the **model**

<ol class="diagram-flow" aria-label="Frontend connected to API connected to cache">
  <li><div class="diagram-node" data-id="example-web">
    <span data-icon="screen"></span><h3>Frontend</h3><p>The experience people use.</p>
  </div></li>
  <li><span class="diagram-connector" data-id="example-web-api" data-icon="arrowRight"></span>
    <div class="diagram-node" data-id="example-api">
      <span data-icon="code"></span><h3>API</h3><p>The service behind it.</p>
    </div>
  </li>
  <li><span class="diagram-connector fragment" data-fragment-index="0" data-id="example-api-cache" data-icon="arrowRight"></span>
    <div class="diagram-node fragment" data-fragment-index="1" data-id="example-cache">
      <span data-icon="database"></span><h3>Cache</h3><p>An optional dependency.</p>
    </div>
  </li>
</ol>

Keep the connected model; reveal the new arrow, then the cache.
<!-- .element: class="source-line" -->

Note:
This is an illustrative model, not proof of a running application.
Reduced-motion, reading, and print do not wait for animation.

---

<!-- .slide: id="add-media" data-kicker="Media" -->
## Give the idea **space**

![Unchanged official Aspire mark](brand/aspire-icon-256.svg)
<!-- .element: class="slide-image align-center" -->

Add your own image with `![Useful alt text](assets/your-image.webp)`.

Note:
Put your file in public/assets, then refer to it as assets/your-image.webp.
Images retain their full aspect ratio. Use a meaningful description.

---

<!-- .slide: id="reveal-the-story" data-kicker="Fragments" -->
## Reveal the **story**

- Start with the idea. <!-- .element: class="fragment" -->
- Add the evidence. <!-- .element: class="fragment" -->
- Leave a next step. <!-- .element: class="fragment" -->

<!-- .element: class="feature-list" -->

Fragments follow your advance, not a timer.

Note:
Press Space or Next to reveal each point. Reading, print, and reduced-motion
modes show every point immediately.

--

<!-- .slide: id="a-little-deeper" data-kicker="Vertical" -->
## Go a little **deeper**

Put `--` on its own line to add a vertical slide.

| Press | To |
| --- | --- |
| <kbd>Down</kbd> | Go deeper in the stack |
| <kbd>Up</kbd> | Step back up the stack |
| <kbd>Right</kbd> | Continue to the next slide |

The menu and counter include every slide, including this one.

Note:
Vertical slides are optional. Use them for a small aside or a deeper example,
not as a requirement for ordinary authoring.

---

<!-- .slide: id="statement-layout" class="layout-statement" data-kicker="Layout" -->
## One slide. <em class="accent">One idea.</em>

A clear claim gives the audience something to carry into the next example.
<!-- .element: class="layout-support" -->

Note:
This statement layout uses native slide and element classes. Keep one strong
claim and a short supporting paragraph; move the detailed evidence to another slide.

---

<!-- .slide: id="split-layout" class="layout-split" data-kicker="Layout" -->
## Keep the claim beside the **evidence**

<div class="layout-copy">
  <h3>Content and shell</h3>
  <p>Write the story in Markdown. Reuse the presentation shell.</p>
</div>

<figure class="layout-visual">
  <img src="brand/aspire-icon-256.svg" alt="Unchanged official Aspire mark">
  <figcaption class="layout-caption">The visual gets its own space, without cropping or tiny text.</figcaption>
</figure>

Note:
The two roles are explicit HTML classes inside native Markdown, not nested
section elements. They stack in reading and narrow modes in the same DOM order.
Use a full-width slide for a large graph. A graph in a narrow column uses the
same-definition node/relationship fallback, not shrunken SVG labels.

---

<!-- .slide: id="comparison-layout" class="layout-comparison" data-kicker="Layout" -->
## Choose a useful **pace**

<div class="comparison-columns">
  <div class="comparison-panel">
    <h3><span data-icon="x"></span>One dense slide</h3>
    <p>Several ideas compete for the same space.</p>
  </div>
  <div class="comparison-panel is-featured">
    <h3><span data-icon="check"></span>A focused sequence</h3>
    <p>Each idea gets a claim, an example, and a moment to land.</p>
  </div>
</div>

Note:
Compare like with like. The paired panels share a title and a reading order;
they are not a card grid to apply to every slide.

---

<!-- .slide: id="transitions" class="layout-split" data-kicker="Motion" data-transition="slide-in fade-out" -->
## Choose how slides **move**

<div class="layout-copy">

Set a default for the **deck**, adjust a **chapter**, or override one **slide**
with `data-transition`. The most specific setting wins.

A chapter begins on a slide marked with `data-chapter`. This slide arrives with
`slide-in` and leaves with `fade-out`.

</div>

<div class="layout-visual">

```json
"transition": { "style": "fade" },
"chapters": {
  "code": { "style": "slide" }
}
```
<!-- .element: data-caption="deck.config.json (excerpt)" -->

</div>

Note:
Cue: the deck fades by default, the Code chapter (copyable-code through
run-and-reveal) slides sideways, and this slide overrides both: it slides in
and fades out. Press Next, then Back, to feel the difference. Motion should keep
the story continuous, not decorate it. Reduced motion, reading, print, and the
speaker view always skip transitions.

---

<!-- .slide: id="guide-start" class="layout-split" data-kicker="Guide" -->
## Start with the **map**

Create your repository from the template, then edit two files.

<div class="layout-visual">

```
deck.config.json  intro, settings
slides.md         slides, notes
diagrams.json     optional graphs
public/assets/    your media
src/              reusable shell
```
<!-- .element: data-caption="Project map" -->

</div>

<div class="layout-visual">

```bash
npm ci
npm run dev
npm test
npm run build
npm run preview
```
<!-- .element: data-caption="Commands" -->

</div>

Needs Node.js 22.12+ or 24 LTS, but no .NET SDK, Docker, or Aspire runtime. Run `npx playwright install chromium` once; then `npm test` checks your deck and `npm run test:starter` this template's own examples. [README](https://github.com/IEvangelist/aspire-deck-template#readme) and [SKILL.md](https://github.com/IEvangelist/aspire-deck-template/blob/main/SKILL.md) explain more.
<!-- .element: class="source-line" -->

Note:
Cue: this guide chapter is the template's own manual. Every slide whose id
starts with guide- belongs to it, so delete those slides when you replace the
starter. You edit two files: deck.config.json for the introduction and deck
settings, and slides.md for every slide, with notes. diagrams.json holds
optional graph definitions, public/assets holds your images, and src is the
reusable shell that you never change to add, remove, or reorder slides.
npm ci installs, npm run dev serves the deck at the URL Vite prints and reloads
the page when you save a file (never open index.html from disk), npm test
checks your deck: authoring, accessibility, and the production builds, and it
stays valid when you replace, rename, or remove every starter slide. npm run
test:starter maintains this template's own examples and guide; the template's
CI runs it, so once the starter slides are gone you can ignore it. npm run build
writes the static site to dist, and npm run preview serves that build. On a
new machine run npx playwright install chromium once before the first npm test.

---

<!-- .slide: id="guide-config" data-kicker="Guide" -->
## Describe your **talk**

Only `title` and `presenter.name` are required. Leave out the rest and the intro stays clean.

```json [1,4|2|5|7|8]
"title": "Your talk title",
"subtitle": "A tagline under the title",
"presenter": {
  "name": "Your name",
  "avatar": { "src": "assets/you.webp", "alt": "Your photo" }
},
"event": { "name": "Your event", "date": "Your date" },
"links": [{ "label": "Blog", "url": "https://example.com/" }]
```
<!-- .element: data-caption="deck.config.json (excerpt)" -->

Also optional: `description`, `presenter.role`, `presenter.organization`, and `event.location`. Links take any labels, in any order.
<!-- .element: class="source-line" -->

Note:
Cue: the highlight starts on the two required lines, title and presenter.name.
Each Next adds one optional part: the subtitle, the avatar, the event, then the
links. An avatar needs both src and alt, and src is relative to public/, so
assets/you.webp means public/assets/you.webp. Links take any labels in any
order; use [] or leave out links, event, or avatar to remove them. The
description, role, organization, and location are optional text. Invalid
configuration stops the build and the page with the file and field named. Do
not repeat the generated introduction in slides.md.

---

<!-- .slide: id="guide-settings" data-kicker="Guide" -->
## Tune how it **behaves**

Optional settings for motion, the slide counter, and link previews.

```json [1|2|3|4|5-8]
"description": "Search and link-preview text; not shown on slides",
"transition": { "style": "fade", "speed": "fast" },
"chapters": { "code": { "style": "slide" } },
"slideNumber": { "visible": true, "position": "bottom-left" },
"social": {
  "image": "assets/social-card.png",
  "alt": "Describe the card, including its text"
}
```
<!-- .element: data-caption="deck.config.json (excerpt)" -->

The counter sits in `top-left`, `top-right`, `bottom-left` (the default), or `bottom-right`. `"visible": false` hides it. `social` also takes `title`, `description`, and `siteName`.
<!-- .element: class="source-line" -->

Note:
Cue: each Next highlights one setting. The description is search and
link-preview text only; it never appears on a slide. The transition is the deck
default, and chapters are named groups that a slide starts with data-chapter;
the most specific setting wins, deck then chapter then the slide's own
data-transition, as the previous Motion slide shows. slideNumber moves or hides
the corner counter: position is top-left, top-right, bottom-left, or
bottom-right, visible is true or false, and print and the speaker view's
previews never show it. social turns a PNG in public/assets into the Open Graph
and Twitter card: image and alt go together, and title, description, and
siteName are optional. The image tags appear once the site URL is known, which
the Pages workflow supplies. A copy of this template must replace the starter
card with its own.

---

<!-- .slide: id="guide-markdown" data-kicker="Guide" -->
## Write every **slide**

| Write | You get |
| --- | --- |
| `---` or `--` on its own line | A new slide, or a vertical one |
| `<!-- .slide: id="idea" -->` | A stable link, `#/idea` |
| `Notes:` and then your text | Speaker notes, public on the site |
| `<!-- .element: class="fragment" -->` | One step per advance |
| `layout-split`, `align-center` | Columns and alignment |
| A code fence with `data-caption` | A titled window with Copy |

Nested `<section>` elements make vertical slides, so use `layout-split` or `layout-comparison` for columns. See the [Markdown reference](https://revealjs.com/markdown/).
<!-- .element: class="source-line" -->

Note:
Cue: one row per authoring move. The official Reveal Markdown plugin renders
slides.md, so there is no custom syntax. Three dashes start a horizontal slide
and two dashes a vertical one that Down reaches; the menu and counter include
both. An id in the slide comment keeps links stable when you reorder slides:
it must be unique, start with a letter, and avoid intro and the shell's own
ids. A line that starts with Note or Notes and a colon begins the speaker notes,
which stay off the audience's screen but are published with slides.md, so never
write a secret there. A fragment class reveals one item per advance, and
reading, print, and reduced motion show everything. The layout presets are
layout-statement, layout-split, and layout-comparison, and align-left,
align-center, and align-right align an image or a whole slide. Columns go in
layout-copy and layout-visual groups: a nested section element is a vertical
slide, not a column. A fenced block takes data-caption for its window title,
and Copy always keeps the exact source.

---

<!-- .slide: id="guide-teach" data-kicker="Guide" data-accent="cyan" -->
## Teach with **patterns**

- [Step through the lines](#/apphost-example) with `[1|3-5|7]`
- [Color-code the packages](#/apphost-csharp) with `data-pkg-cyan`
- [Show files side by side](#/compare-code) with `layout-split`
- [Reveal a command's output](#/run-and-reveal) with `data-terminal`

<!-- .element: class="feature-list" -->

Package colors take `data-pkg`, `data-add`, `data-apis`, and `data-lines`. Add `data-terminal-focus="true"` and a `terminal-support` line to give a presented output the whole slide. A mistake names the slide.

Note:
Cue: four patterns, each a live slide you can open from this list. Step
through the lines puts a bracketed list after the language, such as [1|3-5|7],
where each bar is one Next. Package colors label which integration package owns
each API: data-pkg or data-add names the package, data-apis lists the
identifiers it owns, and data-lines optionally limits the rail, in purple, cyan,
pink, or teal. Side by side reuses layout-split with two layout-visual groups,
so each code panel keeps its own caption and Copy. A recorded command puts
data-terminal on the command fence and the complete, real output in the next
fence; one Next reveals it, and the label stays on screen because nothing runs
on the page. A long output gets more room with terminal focus: put
data-terminal-focus="true" in the slide's attribute comment and give the
provenance line the class terminal-support. When the output appears while
presenting, the heading and that line fold away and the window moves up to take
the whole slide, with the output scrolling on its own. Reading mode and print
keep every line, reduced motion shows the finished layout at once, and the
speaker view's previews follow the audience. A step list outside the block, an
unknown color, an API that is not in the code, a missing output, or a focus
value other than true stops the load with the slide named.

---

<!-- .slide: id="guide-media" data-kicker="Guide" data-accent="pink" -->
## Diagrams and **media**

Name a graph in `diagrams.json`, then place it, or an image, in Markdown.

```markdown
<div data-diagram="architecture"></div>

![Team photo](assets/team.webp)
```
<!-- .element: data-caption="slides.md" -->

- `stage` numbers in `diagrams.json` reveal boxes and arrows in order. Narrow screens get an ordered flow from the same definition.
- Files live in `public/assets/`. Write `assets/team.webp`, not `public/assets/` or a repository URL, so the deck works under any base path. Always add alt text.

Note:
Cue: diagrams.json holds named definitions, and a div with data-diagram puts
one into a slide. Each node and edge can carry a stage number: stage 0 is
visible at first and each higher stage is one Next, so an arrow arrives before
the box it points to. Narrow screens and reading mode derive an ordered
node-and-arrow flow from the same definition, so nothing shrinks. Media lives
in public/assets and is referenced as assets/team.webp, which stays correct on
the root site and under a renamed project Pages path; do not prefix public/ or
hard-code a repository URL. Images keep their aspect ratio, and alt text should
describe what the image shows. Icon names in slides and diagrams come from the
bundled Octicons catalog.

---

<!-- .slide: id="guide-present" data-kicker="Guide" -->
## Present **your way**

<div class="card-row">
  <div class="card">
    <span data-icon="screen"></span>
    <h3>Navigate</h3>
    <p>Back, Next, and Menu, or <kbd>Space</kbd> and the arrows. <kbd>Esc</kbd> shows every slide.</p>
  </div>
  <div class="card" data-accent="cyan">
    <span data-icon="note"></span>
    <h3>Speak</h3>
    <p><kbd>S</kbd> opens the speaker view with your notes. Notes are public.</p>
  </div>
  <div class="card" data-accent="pink">
    <span data-icon="book"></span>
    <h3>Read or print</h3>
    <p><kbd>R</kbd> reads, <kbd>T</kbd> switches theme. Print shows every step.</p>
  </div>
</div>

The counter follows `slideNumber`. Motion resolves deck, then chapter, then slide, and never runs in reading, print, or the speaker view's previews.
<!-- .element: class="source-line" -->

Note:
Cue: three ways you will use the deck. Navigate: Back, Next, and Menu live in
the 56px toolbar, Space and the arrow keys advance through steps and slides,
Esc shows the overview, every slide id is a link, and a link such as
#/guide-start/2 restores a reveal step after a reload. Speak: S, or Menu then
Speaker notes, opens Reveal's own speaker view with the current slide, what
Next will show, your notes, a clock, and a timer; allow pop-ups. Notes are
hidden from the audience but published with slides.md, so they are public, not
confidential. Read: R switches reading mode and T the theme, and narrow screens
start in reading mode. The counter is a badge whose corner comes from
slideNumber; presenting and reading show it, while print and the speaker view's
previews hide it. Reading, print, reduced motion, and those previews never
animate, whatever the transition settings.

---

<!-- .slide: id="guide-publish" class="layout-comparison" data-kicker="Guide" -->
## Publish and **share**

Push to your default branch and the Pages workflow checks, builds, and publishes your deck.

<div class="comparison-columns">
  <div class="comparison-panel">
    <h3><span data-icon="globe"></span>Your site's preview</h3>
    <p>Automatic. The <code>social</code> block becomes the Open Graph and Twitter card. Replace the starter card with yours.</p>
  </div>
  <div class="comparison-panel">
    <h3><span data-icon="github"></span>GitHub's preview</h3>
    <p>Manual, once. <strong>Settings &gt; Social preview &gt; Edit &gt; Upload an image</strong>, 1280 &times; 640, under 1 MB.</p>
  </div>
</div>

In a new repository, set **Settings > Pages > Source** to **GitHub Actions** once. Project paths and custom domains need no edits.
<!-- .element: class="source-line" -->

Note:
Cue: two different previews. The one in your deck is automatic: the social
block in deck.config.json becomes Open Graph and Twitter tags when the workflow
builds the site, using the URL and base path that actions/configure-pages
reports, so renamed repositories, root sites, and custom domains need no edits.
The image and text must be yours: replace public/assets/social-card.png and
every social field, or delete the block for a text-only preview. GitHub's own
repository preview is separate and manual: open Settings, then Social preview,
then Edit, then Upload an image, with a 1280 by 640 picture under 1 MB, as
GitHub's documentation describes. Committing the file does not set it. In a
repository created from this template, set Settings, Pages, Source to GitHub
Actions once, because that setting is not copied. Pull requests and other
branches validate without deploying, and copies are independent: they do not
receive template updates.

---

<!-- .slide: id="publish-on-push" data-kicker="Publish" -->
## From your repo to the **room**

1. **Use this template.** Create your repository, then edit your introduction and slides.
2. **Turn on Pages once.** In **Settings > Pages**, select **GitHub Actions**.
3. **Push your changes.** The workflow checks, builds, and publishes your deck.

Your content. Your repository. Your presentation.

Note:
The README covers setup, controls, PDF export, configuration, and licenses.
Template copies publish independently; they do not automatically sync updates
from this repository.
