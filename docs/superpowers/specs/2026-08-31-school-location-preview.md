# School Location Preview Design

## Goal

Help administrators distinguish similarly named AMap school search results before saving one.

## Interaction

- Keep the existing search-results list.
- Clicking a result opens an interactive AMap preview centered on that place with one marker.
- The preview shows the full place name, city/district, address, and coordinates.
- “返回搜索结果” closes the preview without writing data.
- “确认使用这个学校” continues the existing campus-name prompt and save flow.
- Use the same flow in Manual Member and School Coordinates administration pages.

## Constraints

- Do not add a new API key or map provider.
- Do not save anything when merely opening or closing the preview.
- Preserve the existing pending-coordinate review requirement after save.
