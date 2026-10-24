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

<!-- .slide: id="run-and-reveal" data-kicker="Terminal" data-accent="teal" -->
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
<!-- .element: class="source-line" -->

Note:
Nothing runs on this page. The command was run once and its complete output
pasted here, so the label stays on screen. Replace both with your own
capture. Output labeled json must be complete, valid JSON.

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
