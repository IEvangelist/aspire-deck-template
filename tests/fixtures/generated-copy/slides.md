<!-- .slide: id="why-small" data-kicker="Context" -->
## Why we keep services **small**

One job per service. Each one is easy to test and easy to replace.

Note:
Open with the cost of the last big rewrite, then move on.

---

<!-- .slide: id="three-rules" data-kicker="Rules" -->
## Three rules we **follow**

- Own your data. <!-- .element: class="fragment" -->
- Version your contract. <!-- .element: class="fragment" -->
- Fail loudly. <!-- .element: class="fragment" -->

Note:
Reveal one rule at a time.

---

<!-- .slide: id="request-path" class="layout-split" data-kicker="Flow" -->
## What a request looks like

<div class="layout-copy">
  <h3>One path in, one path out</h3>
  <p>A request crosses one boundary, then returns.</p>
</div>

<figure class="layout-visual">
  <img src="assets/sketch.svg" alt="Three boxes joined by arrows: client, service, and store">
  <figcaption class="layout-caption">A client, a service, and a store.</figcaption>
</figure>

---

<!-- .slide: id="tiny-handler" data-kicker="Code" -->
## A tiny **handler**

```typescript [1|2-3|5]
export async function handler(request: Request) {
  const input = await request.json();
  const result = await process(input);

  return Response.json(result);
}
```
<!-- .element: data-caption="handler.ts" -->

Note:
Walk the highlighted lines one at a time.

---

<!-- .slide: id="try-it" data-kicker="Terminal" -->
## Try it from a **shell**

```bash
echo "hello from a recorded run"
```
<!-- .element: data-terminal="Recorded example" data-caption="Terminal" -->

```text
hello from a recorded run
```

---

<!-- .slide: id="pipeline-overview" data-kicker="Diagram" -->
## How the pieces **connect**

<div data-diagram="pipeline"></div>

--

<!-- .slide: id="pipeline-detail" data-kicker="Diagram" -->
## A closer look

The service validates each request before it writes.

---

<!-- .slide: id="before-after" data-kicker="Results" -->
## What **changed**

| Measure | Before | After |
| --- | --- | --- |
| Deploys per week | 2 | 14 |
| Median rollback | 40 min | 4 min |
| Services | 1 | 9 |

---

<!-- .slide: id="questions" class="layout-statement" data-kicker="Close" -->
## Questions? <em class="accent">Ask away.</em>

Small pieces, clear contracts.
<!-- .element: class="layout-support" -->
