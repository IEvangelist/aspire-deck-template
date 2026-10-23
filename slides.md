<!-- .slide: id="make-it-yours" data-kicker="Start here" -->
## Make it **yours**

One deck. No application to maintain.

<div class="card-row">
  <div class="card">
    <span data-icon="person"></span>
    <h3>Your introduction</h3>
    <p>Set it in <code>deck.config.json</code></p>
  </div>
  <div class="card">
    <span data-icon="markdown"></span>
    <h3>Your slides</h3>
    <p>Write them in <code>slides.md</code></p>
  </div>
  <div class="card">
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

<!-- .slide: id="copyable-code" data-kicker="Code" -->
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

---

<!-- .slide: id="apphost-example" data-kicker="Reference" -->
## A small **AppHost**

```typescript
import { createBuilder } from "./.aspire/modules/aspire.mjs";

const builder = await createBuilder();
const api = await builder.addNodeApp("api", "./api", "src/index.ts")
  .withHttpEndpoint({ env: "PORT" });
await builder.addViteApp("web", "./web").withReference(api).waitFor(api);

await builder.build().run();
```
<!-- .element: data-caption="apphost.mts | reference only" -->

An [official-guide](https://aspire.dev/get-started/first-app.md) reference:
the app folders and generated modules belong to a separate Aspire app.
<!-- .element: class="source-line" -->

Note:
This is a slide example, not a runnable app included with this template.
The reference models an API, a frontend, and the dependency between them.

---

<!-- .slide: id="rich-architecture" data-kicker="Diagram" -->
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
