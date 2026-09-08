# National School Map Design

**Goal:** Make province membership explicit so every school is grouped and navigated correctly anywhere in China.

## Data contract

- `schools.province` is required and stores a normalized province-level name without administrative suffixes, for example `广东`, `湖北`, `北京`, `内蒙古`.
- AMap selections read the province from `pname`; the administrative code is the fallback when AMap omits it.
- Manual coordinate entry requires a province. The server rejects missing province data instead of silently assigning Guangdong.
- Existing rows are migrated with Guangdong as the compatibility default and Wuhan rows are explicitly corrected to Hubei.

## Map behavior

- Directory schools expose `province` alongside `city`.
- The domain groups schools into province summaries, then city summaries.
- Country view renders one marker and outline per populated province.
- Selecting a province sets the active province and shows only its cities.
- Selecting a city shows only schools from that province and city; selecting a school stays on the page and highlights its marker.
- Text fallback navigation mirrors the same country → province → city hierarchy.

## Verification

- AMap parsing returns `湖北` for Wuhan University.
- Server school writes preserve and validate province.
- Map grouping produces separate Guangdong and Hubei summaries.
- Country view renders both province markers; Hubei view renders Wuhan only.
- Existing marker-selection regression remains covered.
