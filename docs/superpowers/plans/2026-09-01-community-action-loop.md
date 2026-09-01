# Community Action Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the home page's four-step approval explanation with a five-stage community action loop: 发现 → 连接 → 共创 → 落地 → 沉淀 ↺.

**Architecture:** Keep the change inside the existing home page and global stylesheet. Render the loop as a semantic ordered list, reuse the current blue/orange node treatment, link only to capabilities that already exist, and verify the server-rendered HTML contract.

**Tech Stack:** React 19, Vinext, TypeScript, CSS, Node test runner, JSDOM

**Spec:** `docs/superpowers/specs/2026-09-01-community-action-loop-design.md`

## Global Constraints

- Do not add database tables, APIs, project-management pages, dependencies, or fictional capabilities.
- Use the exact approved copy: `从连接，到创造`, `让议题找到同行，让行动沉淀成果。`, and `发现 → 连接 → 共创 → 落地 → 沉淀 ↺`.
- Reuse the current cobalt, orange, circular nodes, white container, and responsive breakpoints.
- Desktop uses a horizontal five-stage flow; mobile uses a vertical flow with no horizontal overflow.
- Do not make color the only expression of sequence or loop state.

---

### Task 1: Replace the approval flow with the community action loop

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: existing home route `/`, map anchor `/#map`, community route `/communities`, events route `/events`, and application route `/apply`.
- Produces: a semantic `.community-loop` section containing exactly five ordered `.community-loop-step` items and a visible `.community-loop-return` label.

- [ ] **Step 1: Add a failing server-rendered HTML test**

Append this test to `tests/rendered-html.test.mjs`:

```js
test("home page presents the five-stage community action loop", async () => {
  const response = await renderHomePage({ host: "localhost" });
  assert.equal(response.status, 200);
  const dom = new JSDOM(await response.text());
  try {
    const document = dom.window.document;
    const loop = document.querySelector(".community-loop");
    assert.ok(loop);
    assert.match(loop.textContent ?? "", /从连接，到创造/);
    assert.match(loop.textContent ?? "", /让议题找到同行，让行动沉淀成果。/);
    assert.deepEqual(
      [...loop.querySelectorAll(".community-loop-step strong")].map((node) => node.textContent?.trim()),
      ["发现", "连接", "共创", "落地", "沉淀"],
    );
    assert.equal(loop.querySelectorAll(".community-loop-step").length, 5);
    assert.match(loop.querySelector(".community-loop-return")?.textContent ?? "", /进入下一轮发现/);
    assert.equal(loop.querySelector('a[href="/events"]')?.textContent?.trim(), "发现");
    assert.equal(loop.querySelector('a[href="/#map"]')?.textContent?.trim(), "连接");
    assert.equal(loop.querySelector('a[href="/apply"]')?.textContent?.trim(), "共创");
    assert.doesNotMatch(loop.textContent ?? "", /真实、本人选择、经过审核|一束光如何亮起/);
  } finally {
    dom.window.close();
  }
});
```

- [ ] **Step 2: Build and run the focused test to verify it fails**

Run:

```powershell
npm.cmd run build
node --test --test-name-pattern="five-stage community action loop" tests/rendered-html.test.mjs
```

Expected: FAIL because `.community-loop` does not exist.

- [ ] **Step 3: Replace the old JSX with the five-stage loop**

In `app/page.tsx`, define the data next to `homeChannels`:

```tsx
const communityLoop = [
  { label: "发现", marker: "见", description: "发现议题、活动与真实需求", href: "/events" },
  { label: "连接", marker: "联", description: "在共建地图找到同行者", href: "/#map" },
  { label: "共创", marker: "创", description: "加入网络，发起双向连接", href: "/apply" },
  { label: "落地", marker: "行", description: "组队协作，把想法变成行动" },
  { label: "沉淀", marker: "留", description: "让作品、经验与贡献持续可见" },
] as const;
```

Replace the existing `<section className="approval-flow" ...>` with:

```tsx
<section className="community-loop" aria-labelledby="community-loop-title">
  <div className="approval-heading">
    <p className="map-section-kicker">共创如何发生</p>
    <h2 id="community-loop-title">从连接，到创造</h2>
    <p>让议题找到同行，让行动沉淀成果。</p>
  </div>
  <ol>
    {communityLoop.map((step, index) => (
      <li className="community-loop-step" key={step.label}>
        <span>{String(index + 1).padStart(2, "0")}</span>
        <i aria-hidden="true">{step.marker}</i>
        <div>
          {"href" in step ? <a href={step.href}><strong>{step.label}</strong></a> : <strong>{step.label}</strong>}
          <p>{step.description}</p>
        </div>
      </li>
    ))}
  </ol>
  <p className="community-loop-return"><span aria-hidden="true">↺</span> 成果沉淀，进入下一轮发现</p>
</section>
```

- [ ] **Step 4: Update the existing flow styles without introducing a new visual system**

In `app/globals.css`, rename the `.approval-flow` selectors to `.community-loop`, change the ordered-list grid to five columns, and add:

```css
.community-loop { width:min(1240px,calc(100% - 3rem)); margin:0 auto 5rem; }
.community-loop ol { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); margin:0; border:1px solid #ded8ca; border-radius:26px; padding:1.4rem; background:rgba(255,255,255,.82); box-shadow:0 18px 50px rgba(16,33,61,.07); list-style:none; }
.community-loop-step a { color:inherit; text-decoration:none; }
.community-loop-step a:hover strong { color:var(--cobalt); }
.community-loop-return { display:flex; justify-content:center; gap:.5rem; margin:1rem 0 0; color:var(--ink-muted); font-size:.8rem; font-weight:750; }
.community-loop-return span { color:var(--orange); font-size:1.1rem; }
```

Keep the current node, number, arrow, 980px, and 720px rules, retargeted from `.approval-flow` to `.community-loop`. At 980px use two columns; at 720px use one column and downward arrows. Ensure the fifth item does not inherit a trailing arrow.

- [ ] **Step 5: Build and run the focused test to verify it passes**

Run:

```powershell
npm.cmd run build
node --test --test-name-pattern="five-stage community action loop" tests/rendered-html.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Run proportional regression checks**

Run:

```powershell
node --test tests/rendered-html.test.mjs
npm.cmd run lint
git diff --check
```

Expected: all rendered HTML tests pass, lint exits 0, and `git diff --check` prints no errors.

- [ ] **Step 7: Commit the implementation**

```powershell
git add -- app/page.tsx app/globals.css tests/rendered-html.test.mjs
git commit -m "feat: add community action loop"
```
