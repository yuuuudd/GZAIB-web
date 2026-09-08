# National School Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist each school's province and drive the public map's country, province, and city layers from that data.

**Architecture:** Add `province` to the existing school record and carry it through AMap/manual entry, server validation, and the public directory DTO. Build province summaries over the existing city summaries, then make the map and fallback UI select and filter by an explicit active province.

**Tech Stack:** TypeScript, React 19, Drizzle ORM/SQLite, AMap JS API, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-09-national-school-map-design.md`

## Global Constraints

- Do not add dependencies.
- Province is mandatory at write boundaries; never silently assign Guangdong in application code.
- Preserve the existing selected-school marker behavior and public-page navigation.

---

### Task 1: Province data contract and migration

**Files:**
- Modify: `db/schema.ts`
- Create: `drizzle/0012_school_provinces.sql`
- Modify: `db/demo-seed.ts`
- Modify: `features/admin/schools.ts`
- Modify: `app/api/schools/route.ts`
- Modify: `app/apply/page.tsx`
- Modify: `app/admin/members/new/page.tsx`
- Modify: `components/forms/ApplicationForm.tsx`
- Modify: `components/admin/ManualMemberForm.tsx`
- Modify: `components/admin/SchoolCoordinatePanel.tsx`
- Test: `tests/admin/schools.test.ts`
- Test: `tests/applications/school-selection-route.test.ts`

**Interfaces:**
- Produces: required `province: string` on school persistence and selection payloads.

- [x] Write tests that reject a missing province and preserve `province: "湖北"` on a Wuhan selection.
- [x] Run `npx tsx --test tests/admin/schools.test.ts tests/applications/school-selection-route.test.ts` and confirm failure.
- [x] Add the schema column, migration/backfill, and thread province through every school write and query.
- [x] Run the two tests and confirm they pass.

### Task 2: Nationwide AMap province parsing

**Files:**
- Modify: `components/map/AmapLoader.tsx`
- Test: `tests/amap-loader-contract.test.ts`

**Interfaces:**
- Produces: `AmapLocation.province` normalized by `normalizeProvince(value: string): string`.

- [x] Add a Wuhan University parsing case using `pname: "湖北省"`, plus an adcode fallback case.
- [x] Run `npx tsx --test tests/amap-loader-contract.test.ts` and confirm failure.
- [x] Parse `pname`, fall back to the province portion of the AMap adcode, and normalize administrative suffixes.
- [x] Run the test and confirm it passes.

### Task 3: Province-aware map domain

**Files:**
- Modify: `features/directory/service.ts`
- Modify: `features/map/semantic-map.ts`
- Test: `tests/directory/service.test.ts`
- Test: `tests/map/semantic-map.test.ts`

**Interfaces:**
- Produces: `DirectorySchool.province`, `MapProvinceSummary`, `groupSchoolsByProvince`, `citiesForProvince`, and province/city lookup helpers.

- [x] Add Guangdong and Hubei fixtures asserting two province summaries and Wuhan only under Hubei.
- [x] Run the two tests and confirm failure.
- [x] Propagate province in the directory and implement the minimum province grouping helpers over city summaries.
- [x] Run the tests and confirm they pass.

### Task 4: Country/province/city interaction

**Files:**
- Modify: `components/map/BuilderMap.tsx`
- Modify: `components/map/SemanticMapCanvas.tsx`
- Modify: `components/map/map-overlays.ts`
- Modify: `components/map/CityDirectoryFallback.tsx`
- Test: `tests/map/semantic-map-canvas-mounted.test.ts`
- Test: `tests/map/map-overlays.test.ts`
- Test: `tests/map/city-directory-fallback.test.ts`

**Interfaces:**
- Consumes: province summaries and active province from Task 3.
- Produces: country province selection, province-filtered city selection, and matching text fallback navigation.

- [x] Add rendered tests for separate Guangdong/Hubei country markers and Hubei → Wuhan navigation.
- [x] Run the three map tests and confirm failure.
- [x] Add active-province state, generic province marker presentation, filtered layers/outlines/routes, and province-aware labels.
- [x] Run the map tests and confirm they pass.

### Task 5: Regression verification

**Files:**
- Verify: all modified files.

- [x] Run targeted TypeScript tests for AMap, admin school writes, directory, and map.
- [x] Run ESLint on modified TypeScript/TSX files.
- [x] Run `npm run build`.
- [x] Review `git diff --check` and the final diff, preserving unrelated existing changes.
