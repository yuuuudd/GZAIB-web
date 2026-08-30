# Semantic Builder Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan.

**Goal:** Replace the native-looking AMap directory with a two-level semantic Guangdong/Guangzhou collaboration map whose school pins show member counts inside and full school names outside.

**Architecture:** Keep the existing `/api/directory` payload and derive city aggregates in a pure `features/map` module. A client map controller translates the derived model into AMap district outlines and custom HTML markers, while a matching two-level directory remains available as both navigation and runtime fallback. `BuilderMap` owns filters, data fetching, semantic level, selection, and the existing detail drawer.

**Tech Stack:** Next.js, React, TypeScript, AMap JS API 2.0, Vitest, Testing Library, Sites hosting.

---

### Task 1: Add the semantic map domain model

**Files:**
- Create: `features/map/semantic-map.ts`
- Create: `tests/map/semantic-map.test.ts`

**Step 1: Write the failing tests**

Cover city normalization, aggregation of member and school counts, Guangzhou default selection, coordinate-center calculation, province/city zoom thresholds, and preservation of a selected city with zero filtered schools.

**Step 2: Run the focused test and confirm failure**

Run: `npm.cmd test -- tests/map/semantic-map.test.ts`

Expected: FAIL because `features/map/semantic-map.ts` does not exist.

**Step 3: Implement the minimum pure model**

Export `MapLevel`, `MapCitySummary`, `groupSchoolsByCity`, `semanticLevelForZoom`, `DEFAULT_CITY`, `GUANGDONG_CENTER`, city center fallbacks, and helpers for selecting visible schools. Keep all functions deterministic and independent of AMap.

**Step 4: Run the focused test and confirm success**

Run: `npm.cmd test -- tests/map/semantic-map.test.ts`

Expected: PASS.

**Step 5: Commit**

Commit message: `feat: add semantic map aggregation model`

### Task 2: Extend the AMap loader contract for semantic layers

**Files:**
- Modify: `components/map/AmapLoader.tsx`
- Modify: `tests/amap-loader-contract.test.ts`

**Step 1: Write the failing contract assertions**

Require the loader to request `AMap.DistrictSearch` and expose typed capabilities needed for map events, zoom control, polygon drawing, markers, and district boundaries.

**Step 2: Run the focused test and confirm failure**

Run: `npm.cmd test -- tests/amap-loader-contract.test.ts`

Expected: FAIL because the district plugin and contract are absent.

**Step 3: Extend the loader**

Add `AMap.DistrictSearch` to the plugin list and extend the local namespace types without leaking keys or security codes. Retain the existing single-flight script loading and security configuration.

**Step 4: Run the focused test and confirm success**

Run: `npm.cmd test -- tests/amap-loader-contract.test.ts`

Expected: PASS.

**Step 5: Commit**

Commit message: `feat: support amap district boundaries`

### Task 3: Build the two-level directory fallback

**Files:**
- Create: `components/map/CityDirectoryFallback.tsx`
- Modify: `components/map/SchoolDirectoryFallback.tsx`
- Create: `tests/map/city-directory-fallback.test.ts`

**Step 1: Write the failing component tests**

Render city cards with member/school totals, select a city, render that city’s schools, and verify an empty city still offers navigation back to Guangdong.

**Step 2: Run the focused test and confirm failure**

Run: `npm.cmd test -- tests/map/city-directory-fallback.test.ts`

Expected: FAIL because the city fallback component does not exist.

**Step 3: Implement the accessible fallback**

Use real buttons for city and school selection. Keep copy concise and reuse the existing school drawer callback. Support `map-unavailable` and `empty-result` presentation without a blocking error wall.

**Step 4: Run the focused test and confirm success**

Run: `npm.cmd test -- tests/map/city-directory-fallback.test.ts`

Expected: PASS.

**Step 5: Commit**

Commit message: `feat: add two-level map fallback`

### Task 4: Implement the semantic AMap canvas

**Files:**
- Create: `components/map/SemanticMapCanvas.tsx`
- Create: `components/map/map-overlays.ts`
- Create: `tests/map/map-overlays.test.ts`
- Modify: `app/globals.css`

**Step 1: Write failing overlay presentation tests**

Test HTML-safe school labels, member-count pin content, selected pin state, city summary labels, and marker anchor assumptions.

**Step 2: Run the focused test and confirm failure**

Run: `npm.cmd test -- tests/map/map-overlays.test.ts`

Expected: FAIL because the overlay helpers do not exist.

**Step 3: Implement presentation helpers**

Create escaped custom marker HTML and city summary HTML. Keep full school name outside the pin and count inside. Provide CSS class names for selected and unselected markers.

**Step 4: Implement the canvas**

Initialize AMap centered on Guangzhou with background-only features and labels disabled. Fetch and draw the current city’s outer boundary at city level; fetch Guangdong and city boundaries at province level. Render city summary markers at province level and school pins at city level. Handle zoom-end semantic switching, city clicks, school clicks, map failures, stale async boundary responses, and cleanup.

**Step 5: Add responsive visual styles**

Create the lightweight blue-gray boundary treatment, brand teardrop pin, external full-name label, orange selected state, compact city marker, level navigation, mobile full-width map, and bottom-drawer-compatible spacing.

**Step 6: Run the focused tests and confirm success**

Run: `npm.cmd test -- tests/map/map-overlays.test.ts tests/amap-loader-contract.test.ts`

Expected: PASS.

**Step 7: Commit**

Commit message: `feat: render semantic guangdong map layers`

### Task 5: Integrate semantic navigation into the directory

**Files:**
- Modify: `components/map/BuilderMap.tsx`
- Modify: `tests/directory/school-drawer.test.ts`
- Modify: `tests/rendered-html.test.mjs`

**Step 1: Add failing integration assertions**

Assert that the directory renders Guangdong/current-city navigation, passes filtered city aggregates to the canvas and fallback, keeps school selection wired to `SchoolDrawer`, and includes the semantic map copy in rendered HTML.

**Step 2: Run the integration tests and confirm failure**

Run: `npm.cmd test -- tests/directory/school-drawer.test.ts tests/rendered-html.test.mjs`

Expected: FAIL for the missing semantic navigation and copy.

**Step 3: Replace the old map orchestration**

Derive city summaries from fetched schools, default to Guangzhou, synchronize explicit city/province controls with semantic zoom, show the canvas when AMap is ready, and render the two-level fallback on errors. Preserve filters, collaboration links, member previews, and school drawer behavior.

**Step 4: Run the integration tests and confirm success**

Run: `npm.cmd test -- tests/directory/school-drawer.test.ts tests/rendered-html.test.mjs`

Expected: PASS.

**Step 5: Commit**

Commit message: `feat: integrate semantic map directory`

### Task 6: Verify the full product and publish

**Files:**
- Modify only if verification exposes a defect in the files above.

**Step 1: Run the complete automated suite**

Run: `npm.cmd test`

Expected: all tests pass, including the production build invoked by the project test command.

**Step 2: Run a production build explicitly**

Run: `npm.cmd run build`

Expected: exit code 0 with no TypeScript or route errors.

**Step 3: Perform browser verification**

Verify desktop and mobile layouts on the deployed site: Guangzhou first view, school pin count/name treatment, school drawer, Guangdong zoomed-out summaries, city drill-down, filtering, empty data, and fallback behavior. Capture a screenshot of the successful map state.

**Step 4: Publish with Sites**

Package the committed source, save a new source version, deploy it privately to the existing Sites project, and wait until the deployment reports success.

**Step 5: Commit any verification fixes**

Commit message: `fix: polish semantic map verification issues`

Skip this commit if no fixes are needed.
