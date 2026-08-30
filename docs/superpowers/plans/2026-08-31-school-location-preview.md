# School Location Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an interactive AMap preview between selecting a school search result and saving that school.

**Architecture:** Export a reusable client-side preview component from the existing AMap loader module so both administration flows use the same map lifecycle and copy. Extend search candidates with district and address fields, then hold the selected candidate in local preview state until the administrator confirms or returns.

**Tech Stack:** React 19, TypeScript, AMap JS API 2.0, Node test runner, React server rendering

**Spec:** `docs/superpowers/specs/2026-08-31-school-location-preview.md`

## Global Constraints

- Reuse the existing AMap namespace and key configuration.
- Opening and closing the preview must not write data.
- Both administration search flows must share the same preview component.
- Existing save and coordinate-confirmation behavior must remain unchanged.

---

### Task 1: Reusable school location preview

**Files:**
- Create: `tests/admin/school-location-preview.test.ts`
- Modify: `components/map/AmapLoader.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: the loaded `AmapNamespace` and a selected `AmapLocation`.
- Produces: `AmapLocationPreview({ amap, location, onConfirm, onBack, pending })`.

- [ ] **Step 1: Write the failing test**

Render `AmapLocationPreview` with a sample school and assert that its accessible map region, school details, confirm action, and back action appear.

- [ ] **Step 2: Run test to verify it fails**

Run: `node_modules\\.bin\\tsx.cmd --test tests\\admin\\school-location-preview.test.ts`

Expected: FAIL because `AmapLocationPreview` is not exported yet.

- [ ] **Step 3: Write minimal implementation**

Create a map in an effect, center it at the selected coordinates, add one marker, destroy it on cleanup, and render the approved metadata and actions around the map container.

- [ ] **Step 4: Run test to verify it passes**

Run: `node_modules\\.bin\\tsx.cmd --test tests\\admin\\school-location-preview.test.ts`

Expected: PASS.

### Task 2: Wire both school search flows

**Files:**
- Modify: `components/admin/ManualMemberForm.tsx`
- Modify: `components/admin/SchoolCoordinatePanel.tsx`

**Interfaces:**
- Consumes: `AmapLocation` search candidates and `AmapLocationPreview`.
- Produces: result-click preview state, back navigation, and confirmation that invokes each page's existing save flow.

- [ ] **Step 1: Extend search result parsing**

Copy AMap `adname` and `address` into each candidate while preserving the existing coordinate conversion.

- [ ] **Step 2: Replace immediate selection with preview state**

Set the clicked result as the preview candidate; render the shared component; clear it on back; invoke the existing chooser only on confirm.

- [ ] **Step 3: Verify the feature and regressions**

Run: `npm.cmd run test:unit`

Expected: all unit tests pass.

Run: `npm.cmd run build`

Expected: production build succeeds.

### Task 3: Publish and verify the live interaction

**Files:**
- No source changes expected.

**Interfaces:**
- Consumes: the passing production build.
- Produces: a private Sites deployment where a search result opens the real AMap preview without saving data.

- [ ] **Step 1: Commit and publish**

Commit the tested source, package the site, create a new private site version, and wait for deployment success.

- [ ] **Step 2: Verify in the live browser**

Open an administration search page, search for a known Guangzhou university, click one result, and verify the interactive map preview and both actions are visible. Do not click the confirmation action, so verification creates no school record.
