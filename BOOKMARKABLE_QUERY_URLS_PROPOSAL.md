# Bookmarkable Query URLs: Implementation Proposal

Status: Proposed

## Summary

Allow users to preserve and share a crash query by bookmarking or copying its
URL. The application will not create accounts or store saved queries. Instead,
the URL will contain a versioned, validated description of the last query that
completed successfully.

Version 1 will support:

- radius searches;
- street and street-segment searches; and
- manually drawn route searches.

Drawn routes will use the Google encoded polyline format at precision 6. The
application will use the standalone `@googlemaps/polyline-codec` package rather
than loading the Google Maps JavaScript API. Uploaded GPX/KML routes are outside
the first version because the current parser can return multiple features and
geometry types that cannot always be represented by one polyline without
changing the query.

The existing crash APIs remain authoritative. Opening a bookmarked URL restores
the query definition and reruns it; the URL never contains crash results.

## Product Behavior

### Successful queries own the URL

The canonical URL represents the last successfully applied query, not the
current contents of the filter controls.

For example:

1. A user runs a radius search and receives a report.
2. The application replaces the browser URL with that radius query.
3. The user changes the date or radius control but has not successfully run the
   changed query yet.
4. The URL continues to represent the visible report.
5. When the changed query succeeds, the application replaces the URL.

This prevents a bookmark from describing draft controls while the visible
results still belong to an older query. A successful query with zero crashes is
still bookmarkable.

### Opening a bookmarked query

On initial page load, the application will:

1. Parse and validate the complete URL without applying partial state.
2. Populate the search mode, date, distance, and location or route controls.
3. Reconstruct any drawn-route GeoJSON.
4. Execute the query through the same API path used by an interactive search.
5. Show the report and zoom to the restored search area.
6. Replace a valid legacy URL with its canonical version-1 representation after
   the query succeeds.

An invalid or unsupported URL will not issue an API request. The application
will show a concise error and retain its normal default controls so the user can
start a new search.

### User actions

Add a **Copy query link** action near the existing report actions. It will be
enabled after a query succeeds, including a zero-result query. Because the
browser URL is already canonical at that point, the action copies the current
URL. Users can also use the browser's ordinary bookmark command.

The action should not be labeled **Save query** because the application is not
storing anything and cannot manage or recover bookmarks.

## Version 1 URL Contract

The schema uses stable machine tokens rather than UI labels such as
`Radius Search`. Parameters are created with `URLSearchParams`; callers must not
concatenate or pre-escape values manually.

### Common parameters

| Parameter | Required | Meaning |
| --- | --- | --- |
| `v` | yes | Schema version. Version 1 is `1`. |
| `tool` | yes | `radius`, `street`, or `draw`. |
| `from` | yes | Inclusive start date in `YYYY-MM-DD` form. |
| `to` | yes | Inclusive end date in `YYYY-MM-DD` form. |

Version 1 stores fixed dates. A future rolling-date contract, such as
`period=12m`, must use a later schema version or an explicitly discriminated
date mode; it must not reinterpret version-1 dates.

### Radius search

Additional parameters:

| Parameter | Required | Meaning |
| --- | --- | --- |
| `lat` | yes | Center latitude. |
| `lng` | yes | Center longitude. |
| `radiusFeet` | yes | Radius in feet. |

Example:

```text
/map?v=1&tool=radius&from=2025-01-01&to=2025-12-31&lat=39.7392&lng=-104.9903&radiusFeet=500
```

### Street search

Additional parameters:

| Parameter | Required | Meaning |
| --- | --- | --- |
| `street` | yes | Full street name as accepted by the street API. |
| `bufferFeet` | yes | Buffer distance in feet. |
| `crossFrom` | paired | First cross street. |
| `crossTo` | paired | Second cross street. |

Both cross-street parameters must be present or both must be absent.

Example:

```text
/map?v=1&tool=street&from=2025-01-01&to=2025-12-31&street=E%20COLFAX%20AVE&crossFrom=N%20BROADWAY&crossTo=N%20LINCOLN%20ST&bufferFeet=100
```

### Drawn route search

Additional parameters:

| Parameter | Required | Meaning |
| --- | --- | --- |
| `polyline` | yes | URL-encoded Google encoded polyline. |
| `precision` | yes | Must be `6` in version 1. |
| `bufferFeet` | yes | Buffer distance in feet. |

Example:

```text
/map?v=1&tool=draw&from=2025-01-01&to=2025-12-31&bufferFeet=100&precision=6&polyline=...
```

Parameter ordering is canonicalized by the serializer so generated links are
stable, but the parser must not depend on incoming order.

## Drawn-Route Encoding

The Google encoded polyline algorithm is a good match for a manually drawn
route because the drawing workflow produces one ordered GeoJSON `LineString`.
It delta-encodes coordinates into a compact string and is broadly interoperable.
It is lossy, so the precision is part of the public URL contract.

Version 1 uses precision 6 rather than the common precision 5. Precision 6
rounds to one millionth of a degree, keeping the restored line within roughly a
decimeter of its source while remaining substantially smaller than GeoJSON. The
decoded line, not the pre-encoding line, is the bookmarked query. PostGIS will
buffer that decoded line and remain authoritative for crash inclusion.

The codec and GeoJSON use opposite tuple conventions:

- GeoJSON: `[longitude, latitude]`;
- `@googlemaps/polyline-codec`: `[latitude, longitude]`.

All conversion must live behind a small tested boundary rather than being
repeated at call sites:

```ts
encodeDrawnRoute(lineString): string
decodeDrawnRoute(encoded): FeatureCollection<LineString>
```

The encoder will:

- require one `LineString` with at least two distinct coordinates;
- validate every longitude and latitude before conversion;
- swap each tuple to latitude/longitude;
- encode with precision 6; and
- use `URLSearchParams` to perform URL escaping.

The decoder will:

- reject an empty or oversized value before decoding;
- decode only with precision 6;
- swap tuples back to longitude/latitude;
- validate the decoded coordinates and distinct-point requirement; and
- construct the same one-feature `FeatureCollection` shape produced by the
  drawing reducer.

The package is an implementation dependency only. Encoding and decoding do not
call Google services, load a Google map, or require an API key.

References:

- <https://developers.google.com/maps/documentation/utilities/polylinealgorithm>
- <https://developers.google.com/maps/documentation/utilities/polylineutility>
- <https://github.com/googlemaps/js-polyline-codec>

## URL Size Policy

Encoded polylines are compact but not unbounded. The complete final URL must be
measured after `URLSearchParams` performs percent encoding. Version 1 will have
a conservative maximum URL length defined in one exported constant and verified
against the deployed Nginx/Next.js path before release.

If a manually drawn route exceeds that limit:

- the query can still run normally;
- the application does not silently simplify or truncate the route;
- **Copy query link** is disabled for that result; and
- the UI explains that the route has too many points to fit safely in a link.

Silent simplification is out of scope because it can move the buffered boundary
and change which crashes are returned. A later, explicit simplify-for-sharing
workflow could preview that change before accepting it.

## Query Types and State Ownership

Introduce a versioned discriminated union independent of UI labels:

```ts
type QueryDefinitionV1 =
  | {
      version: 1;
      tool: "radius";
      dateRange: { from: string; to: string };
      center: { lat: number; lng: number };
      radiusFeet: number;
    }
  | {
      version: 1;
      tool: "street";
      dateRange: { from: string; to: string };
      street: string;
      crossStreets?: { from: string; to: string };
      bufferFeet: number;
    }
  | {
      version: 1;
      tool: "draw";
      dateRange: { from: string; to: string };
      route: FeatureCollection<LineString>;
      bufferFeet: number;
    };
```

`page.tsx` will own three related concepts:

- `draftQuery`: values being edited or drawn;
- `activeQuery`: the query whose request most recently succeeded; and
- `activeResults`: the results and report metadata returned for that query.

The existing `ActiveCrashResults` model should be extended or replaced so the
active query and results cannot drift apart. Selected crash, open drawers,
viewport, report tab, and client-side crash-list filters are presentation state
and will not be serialized in version 1.

## Central Query Execution

Restoration cannot safely reproduce a query while execution remains divided
between `page.tsx`, `FilterPanel.tsx`, and the map click handler. Introduce one
page-owned execution boundary:

```ts
runQuery(query: QueryDefinitionV1, options?): Promise<void>
```

It will dispatch to the existing API clients:

- radius queries use `getIncidents` and radius history;
- street queries use the existing centerline, buffer, incident, and history
  requests; and
- drawn-route queries use the existing buffered-route and route-history
  requests through `prepareRouteSearch`.

No new crash API or database write is required.

The map will stop fetching radius results directly. A blank map click will emit
the selected point to a page callback, and the page will construct and run a
radius `QueryDefinitionV1`. This gives interactive and restored radius queries
the same behavior.

Execution rules:

- validate before setting loading state or issuing requests;
- retain the previous successful results and URL until the replacement query
  succeeds;
- atomically update `activeQuery`, results, relevant geometry, and the canonical
  URL after success;
- do not write a failed query into the URL; and
- use `router.replace(..., { scroll: false })` so repeated map searches do not
  create a long browser-history trail.

## Parsing, Validation, and Compatibility

Create pure parsing and serialization utilities, backed by explicit schemas
(Zod is already an application dependency):

```ts
parseQueryUrl(searchParams): ParseQueryResult
serializeQueryUrl(query): URLSearchParams
```

Validation includes:

- exactly one supported schema version and tool token;
- real calendar dates in canonical format with `from <= to`;
- the same coordinate and distance bounds enforced by the corresponding API;
- paired street cross streets;
- rejection of duplicate singleton parameters;
- decoded route coordinate, vertex-count, and URL-size limits; and
- feature-flag availability for the requested tool.

Do not repair malformed values by silently applying defaults. Defaults are for
a new search, not for interpreting a bookmark.

### Existing unversioned URLs

The current interface writes parameters including `tool`, `fromDate`, `toDate`,
`r`, `street`, `crossStreet1`, and `crossStreet2`. It restores only part of that
state and can automatically execute only a street query.

A narrow legacy adapter will accept a complete, valid unversioned street URL
using those names. It will also restore `r`, which the current reader omits. A
legacy radius URL cannot be executed unless it contains coordinates, and no
legacy route geometry exists to restore. After a legacy street query succeeds,
the app replaces it with the version-1 URL.

Unknown future versions remain untouched and produce an unsupported-link error;
version-1 code must never guess how to interpret them.

## Proposed Code Changes

Add:

- `nextjs/app/lib/query-definition.ts`
  - discriminated query types and validation schemas;
- `nextjs/app/lib/query-url.ts`
  - version-1 parsing, canonical serialization, legacy adaptation, and URL-size
    policy;
- `nextjs/app/lib/query-url.test.ts`
  - pure schema and round-trip coverage;
- `nextjs/app/lib/drawn-route-codec.ts`
  - GeoJSON/polyline conversion;
- `nextjs/app/lib/drawn-route-codec.test.ts`
  - precision, order, validation, and known-vector coverage; and
- a small **Copy query link** component or report-header action with focused
  interaction tests.

Modify:

- `nextjs/app/page.tsx`
  - own `activeQuery`, restore on initial load, centralize query execution, and
    update the URL only after success;
- `nextjs/app/components/Map.tsx`
  - report radius-search points upward instead of calling crash APIs directly;
- `nextjs/app/components/FilterPanel.tsx`
  - stop writing draft values directly into the URL;
- the related page, map, filter-panel, and report tests;
- `nextjs/package.json` and `yarn.lock`
  - add and lock `@googlemaps/polyline-codec`; and
- `ARCHITECTURE.md` and `TODO.md`
  - document the shipped URL contract and mark the product decision complete
    only after merge.

## Uploaded Routes

GPX/KML bookmarking is deliberately deferred from version 1. The current file
parser returns a general GeoJSON `FeatureCollection`; depending on the file, it
may contain multiple lines, multi-lines, points, or null geometry. Flattening
that collection into one polyline could connect unrelated segments or discard
geometry and change the PostGIS buffer.

A later version should first define a canonical linear-route model. Reasonable
options are:

1. normalize and validate uploads as one `LineString`, then reuse the version-1
   polyline representation;
2. encode multiple independent lines as a structured list of polylines; or
3. use compressed, base64url-encoded canonical GeoJSON with a strict size limit.

That decision should be protected by parity tests showing that the original and
restored upload produce the same authoritative buffered-route request.

## Verification Plan

### Pure utility tests

- Google published known-vector compatibility.
- Denver coordinate round trips at precision 6.
- Explicit GeoJSON longitude/latitude swapping.
- Minimum two-distinct-point enforcement.
- Radius, street, full-street, street-segment, and drawn-route URL round trips.
- Unicode, spaces, punctuation, and reserved characters in street names.
- Fixed canonical parameter ordering.
- Invalid version, tool, date, coordinate, distance, cross-street pair,
  precision, polyline, duplicate parameter, and oversized URL cases.
- Maximum coordinate error remains within the precision-6 contract.

### Page and component tests

- Successful interactive queries update the URL.
- Draft control changes do not update the URL.
- Failed replacement queries retain the prior URL and results.
- Directly opening each supported URL populates controls and sends the same API
  payload as the equivalent interactive query.
- Restored drawn routes render the line and display buffer.
- A zero-result successful query can be copied.
- An oversized route can run but cannot be copied.
- Invalid and unsupported links issue no crash request and show an error.
- Switching tools cannot leave geometry or results from the previous query.
- Initial restoration runs once and does not loop when canonicalizing the URL.

### Manual verification

- Desktop and mobile: apply, copy, open in a new tab, refresh, and bookmark each
  supported query type.
- Confirm the public `/map` base path is retained.
- Confirm the `www` to canonical-host redirect preserves the complete query.
- Exercise browser back/forward behavior after several searches.
- Verify the deployed Nginx/Next.js route accepts the chosen maximum URL size.
- Compare drawn-route API payloads before encoding and after restoration.
- Confirm no database writes and no Google network requests are introduced.

Run the established Node 24 verification sequence from `nextjs/`: full Vitest,
TypeScript, ESLint, `next build --webpack`, and `git diff --check`.

## Implementation Sequence

1. **Contract and codec**
   - Add query types, schemas, URL utilities, polyline codec, and pure tests.
2. **Shared execution**
   - Move radius execution to the page and introduce the single query runner.
   - Preserve current street, radius, and drawn-route API payloads with
     regression tests.
3. **Canonical URL lifecycle**
   - Restore version-1 and supported legacy URLs.
   - Write the URL only after successful execution.
4. **Copy-link UI**
   - Add the action, oversized-route state, and desktop/mobile coverage.
5. **Documentation and full verification**
   - Update architecture/TODO documentation and complete automated, build, and
     browser checks.

These are suitable as separate reviewable commits in one focused feature
branch. No deployment, database migration, authentication, or storage service is
part of this proposal.

## Acceptance Criteria

- A radius, street, street-segment, or manually drawn route query can be copied,
  bookmarked, refreshed, and opened in a new browser without application
  storage.
- The restored query sends the same semantic API request as the original,
  subject only to the documented precision-6 route-coordinate rounding.
- The URL and visible report always refer to the same last successful query.
- Invalid URLs do not issue partial or unintended queries.
- Route decoding cannot exceed validated coordinate or URL-size limits.
- The existing PostGIS APIs remain authoritative and require no database writes.
- Uploaded routes are not presented as bookmarkable until their multi-geometry
  contract is explicitly implemented.
