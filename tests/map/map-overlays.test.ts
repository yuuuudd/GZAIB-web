import assert from "node:assert/strict";
import test from "node:test";
import type { DirectorySchool } from "../../features/directory/service";
import type { MapCitySummary } from "../../features/map/semantic-map";
import {
  campusHighlightPresentation,
  cityMarkerPresentation,
  collaborationRoutePresentations,
  cityBasemapPresentation,
  districtPolygonPresentation,
  schoolMarkerPresentation,
} from "../../components/map/map-overlays";

const school: DirectorySchool = {
  id: "sysu",
  name: "中山大学 <南校园>",
  campus: "广州校区南校园",
  province: "广东",
  city: "广州",
  lng: 113.298,
  lat: 23.096,
  memberCount: 12,
  previewMembers: [],
};

test("school marker pins the exact coordinate with the count inside and escaped full name outside", () => {
  const presentation = schoolMarkerPresentation(school, false);

  assert.deepEqual(presentation.position, [113.298, 23.096]);
  assert.equal(presentation.anchor, "bottom-center");
  assert.match(presentation.content, /<img class="semantic-pin-art" src="\/map-art\/school-pin-blue-v1\.png" alt=""/);
  assert.match(presentation.content, /semantic-pin-count[^>]*>12位</);
  assert.match(presentation.content, /semantic-pin-label[^>]*>中山大学 &lt;南校园&gt;</);
  assert.doesNotMatch(presentation.content, /semantic-pin-tip/);
  assert.doesNotMatch(presentation.content, /<南校园>/);
});

test("selected school marker exposes one warm highlighted state", () => {
  const presentation = schoolMarkerPresentation(school, true);

  assert.match(presentation.content, /semantic-school-marker is-selected/);
  assert.match(presentation.content, /<img class="semantic-pin-art" src="\/map-art\/school-pin-orange-v1\.png" alt=""/);
  assert.equal(presentation.title, "中山大学 <南校园>，12 位共建者");
});

test("school highlight is centered on the exact campus point", () => {
  const highlight = campusHighlightPresentation(school, false);

  assert.deepEqual(highlight.center, [113.298, 23.096]);
  assert.equal(highlight.radius, 420);
  assert.ok(highlight.fillOpacity > 0);
});

test("city marker uses the map pin visual and summarizes the lit city", () => {
  const city: MapCitySummary = {
    province: "广东",
    city: "广州",
    memberCount: 18,
    schoolCount: 4,
    center: { lng: 113.2644, lat: 23.1291 },
    schools: [school],
  };

  const presentation = cityMarkerPresentation(city, true);

  assert.deepEqual(presentation.position, [113.2644, 23.1291]);
  assert.match(presentation.content, /semantic-city-pin/);
  assert.match(presentation.content, /school-pin-orange-v1\.png/);
  assert.match(presentation.content, /semantic-pin-count[^>]*>18位</);
  assert.match(presentation.content, /semantic-pin-label[^>]*>广州 · 4所</);
  assert.doesNotMatch(presentation.content, /中山大学/);
});

test("city exploration routes connect the live city center to each school coordinate", () => {
  const routes = collaborationRoutePresentations(
    "city",
    [{
      province: "广东",
      city: "广州",
      memberCount: 12,
      schoolCount: 2,
      center: { lng: 113.2644, lat: 23.1291 },
      schools: [
        school,
        { ...school, id: "scut", name: "华南理工大学", lng: 113.344, lat: 23.157, memberCount: 8 },
      ],
    }],
    "广州",
  );

  assert.deepEqual(routes.map((route) => route.path), [
    [[113.2644, 23.1291], [113.298, 23.096]],
    [[113.2644, 23.1291], [113.344, 23.157]],
  ]);
  assert.ok(routes.every((route) => route.strokeStyle === "dashed"));
});

test("standard map keeps AMap roads, buildings, labels, and points visible", () => {
  const map = cityBasemapPresentation();
  const district = districtPolygonPresentation(true, false);

  assert.equal(map.mapStyle, "amap://styles/normal");
  assert.equal(map.showLabel, true);
  assert.deepEqual(map.features, ["bg", "road", "building", "point"]);
  assert.equal(district.fillOpacity, 0.08);
  assert.equal(district.strokeColor, "#46a3a5");
});
