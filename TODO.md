# Vision Zero TODO

This is the shared implementation checklist for maintainers, collaborators, and
future coding sessions. Nested boxes track incremental work. Check a parent box
only after all of its child boxes are complete; on `main`, checked boxes mean the
work has been merged.

Priority meanings:

- **P0**: security, correctness, or foundation needed before feature expansion;
- **P1**: agreed near-term product work;
- **P2**: maintainability and reproducibility improvements;
- **P3**: later enhancements that need product or data decisions.

## P0: Short Stabilization Pass

- [x] Add an automated test foundation for `nextjs/`.
  - [x] Cover pure TypeScript utilities without a database.
  - [x] Support React component tests where user interaction matters.
  - [x] Add a checked-in `test` script and document the command.
  - [x] Do not make routine tests depend on the remote database.
- [x] Add characterization tests for current location-report calculations.
  - [x] KABCO severity selection.
  - [x] Fatality and injury counts.
  - [x] Bicycle and pedestrian involvement.
  - [x] Comprehensive crash-cost calculation.
- [x] Fix bicycle and pedestrian counting in
      `LocationReport/utils/location-report.ts`.
  - [x] Recognized CDOT bicycle types must increment the bicycle count.
  - [x] Pedestrian matching must use pedestrian indicators rather than bicycle
        indicators.
  - [x] Cover DOTI, CDOT, mixed, missing, and fallback data.
- [x] Parameterize user-controlled values in every street-related SQL route.
  - [x] `street-centerlines`
  - [x] `buffered-street-centerlines`
  - [x] `incidents/buffered-street`
  - [x] `incidents/buffered-street/history`
  - [x] Validate dates, buffer distances, street names, and cross-street pairs.
- [x] Add consistent API error responses and status codes for invalid inputs and
      database failures.
- [x] Confirm and document analytical assumptions with the maintainer.
  - [x] DOTI/CDOT match requires the normalized time and a distance within 200
        meters.
  - [x] DOTI is the base result set; CDOT-only records are omitted.
  - [x] KABCO fallbacks for DOTI records.
  - [x] Comprehensive cost source and update policy.

## P1: Export Current Results to CSV

- [x] Confirm the initial export contract with the maintainer.
  - [x] Version 1: one row per crash in the last successfully applied result set.
  - [x] Do not include a second summary CSV or summary header rows in version 1.
  - [x] Exclude age, sex, demographics, and free-text notes from the public export.
- [x] Add a reusable crash-to-CSV utility.
  - [x] Use a fixed, documented column order.
  - [x] Preserve both DOTI and CDOT identifiers when present.
  - [x] Include date, address, coordinates, severity, fatalities, serious injuries,
        bicycle/pedestrian involvement, and relevant road/speed fields.
  - [x] Exclude source/request URLs until an accurate authoritative link model exists.
  - [x] Escape commas, quotes, and line breaks according to CSV conventions.
  - [x] Neutralize values beginning with `=`, `+`, `-`, or `@` to prevent spreadsheet
        formula injection.
- [x] Add an **Export CSV** action to the location report.
  - [x] Export the active result set, not stale results from another search mode.
  - [x] Disable the action while loading or when there are no crashes.
  - [x] Use a meaningful filename containing the search type and date.
  - [x] Support desktop and mobile layouts.
- [x] Add unit tests for columns, escaping, empty values, formulas, filenames, and
      mixed DOTI/CDOT records.
- [ ] Manually verify the result in Excel, Numbers, and a plain-text editor.
  - [x] Verify the version-1 adversarial fixture as UTF-8 plain text with 27
        columns per row.
  - [ ] Re-verify the current 28-column fixture after adding the authoritative
        DOTI record URL.
  - [ ] Verify the downloaded fixture in Excel.
  - [ ] Verify the downloaded fixture in Numbers.

## P1: Link Crash Rows to Authoritative Sources

- [x] Add an optional source-link model to the `Crash` interface and crash-row UI.
- [x] Implement **View DOTI source record**.
  - [x] Build the link from an official Denver Open Data/ArcGIS identifier.
  - [x] Use the semantic incident ID in a filtered Denver Open Data page.
  - [x] Do not persist direct links based on ArcGIS's system-maintained object ID.
  - [x] Verify semantic links against official ArcGIS query results rather than
        third-party sites.
  - [x] Verify links against several current and older incidents.
  - [x] Add the verified authoritative DOTI record link to the CSV export.
  - [x] Show the same authoritative action in map crash callouts.
- [x] Keep Google Maps location URLs out of crash-row source actions.
- [x] Add accessibility text and ensure external links open safely.
- [x] Add tests for DOTI-only, CDOT-enriched, CDOT-only, missing-ID, and
      missing-link cases.

Official references:

- Denver Traffic Accidents dataset:
  <https://data.colorado.gov/Community/City-of-Denver-Traffic-Accidents/cpwf-cznk>
- Denver Traffic Accidents ArcGIS layer:
  <https://services1.arcgis.com/zdB7qR0BtYrg0Xpl/ArcGIS/rest/services/ODC_CRIME_TRAFFICACCIDENTS5YR_P/FeatureServer/325>
- CDOT crash data guidance:
  <https://www.codot.gov/safety/traffic-safety/data-analysis/crash-data>

## P1: Draw a Route or Road Corridor on the Map

- [x] Confirm the first-version interaction model.
  - [x] Record whether the MVP is a user-drawn corridor buffered by the selected
        number of feet.
  - [x] Record exact Denver street-centerline snapping as included or deferred.
- [x] Add `Draw Route` as a search mode for desktop and mobile.
- [x] Implement drawing state separately from radius-search state.
  - [x] Start drawing explicitly.
  - [x] Add vertices by click or tap.
  - [x] Preview the line as it is drawn.
  - [x] Provide Undo, Clear, Cancel, and Apply.
  - [x] Prevent map clicks from launching radius searches while drawing.
  - [x] Preserve normal pan and zoom behavior where practical.
- [x] Convert the drawn line to a GeoJSON `FeatureCollection`.
- [x] Reuse `POST /api/incidents/buffered-route` rather than creating duplicate
      PostGIS query logic.
- [x] Reuse the existing date-range and buffer-distance controls.
- [x] Draw both the selected line and its search area clearly on the map.
- [x] Define what the **History** tab shows for drawn and uploaded routes.
  - [x] Confirm that the previous uploaded-route behavior provided no annual
        history.
  - [x] Add annual history for uploaded and drawn route buffers.
  - [x] Show the full annual timeline and highlight the selected report period.
- [x] Make route upload and route drawing feature flags consistent across desktop
      and mobile.
- [x] Add tests for route creation, undo, clear, apply, empty geometry, mobile
      interaction, mode switching, and API payload shape.
- [x] Verify a drawn route and an equivalent uploaded GPX/KML route return the
      same crash set for the same buffer and dates.

## P1: Bookmarkable Query URLs

- [x] Ship the version-1 bookmarkable-query contract.
  - [x] Define validated radius, street, street-segment, and manually drawn
        route query types independently of UI labels.
  - [x] Encode drawn routes as Google polylines at precision 6 behind a tested
        GeoJSON coordinate-order boundary.
  - [x] Parse complete version-1 URLs and complete legacy street URLs without
        applying partial state.
  - [x] Centralize radius, street, and drawn-route execution in `page.tsx` while
        preserving the existing API payloads.
  - [x] Update the URL only after success and retain the previous URL and report
        after a failed replacement.
  - [x] Add **Copy query link** for successful queries, including zero-result
        queries.
  - [x] Let oversized routes run without simplification while disabling link
        copying with an explanation.
  - [x] Keep GPX/KML uploads outside version 1 until a canonical multi-geometry
        route contract is defined.
  - [x] Manually verify desktop and mobile apply/copy/open/refresh/bookmark flows
        for radius, full-street, street-segment, and drawn-route queries.
  - [x] Verify browser back/forward behavior after repeated successful queries.
  - [x] Verify the deployed `/map` route accepts the 2,000-character policy and
        that the canonical-host redirect preserves the complete query string.
  - [x] Confirm in a browser network trace that polyline handling makes no
        Google request and that query restoration performs no database write.
  - Release verification recorded 2026-08-29: desktop and mobile query flows and
    history navigation passed; an exact 2,000-character canonical URL returned
    200 and survived the `www` redirect unchanged; drawn-route restoration made
    only local read requests plus expected Mapbox and analytics requests, and
    both database queries are `SELECT`-only.

## P2: Backend Maintainability

- [ ] Extract the repeated DOTI/CDOT crash projection into a shared, reviewed SQL
      or query-building boundary.
- [ ] Centralize DOTI/CDOT matching and GeoJSON construction.
- [ ] Add a separately reviewed probable-match stage for records left unmatched
      by exact DOTI/CDOT matching.
  - [ ] Start with a five-minute and 50-meter candidate boundary.
  - [ ] Require a unique mutual-nearest one-to-one pairing.
  - [ ] Preserve time difference, distance, and match method as confidence data.
  - [ ] Validate a sample before probable matches affect map results.
- [ ] Keep search-specific geometry selection separate from shared crash fields.
- [ ] Add database-mocked route tests before consolidating existing queries.
- [ ] Add request schemas or shared validators for API inputs.
- [ ] Add query timeouts, structured server logging, and safe error reporting.
- [ ] Review indexes with `EXPLAIN ANALYZE` using representative read-only queries.
- [ ] Document whether `priority_geo` or `COALESCE(cdot.geo, doti.geo)` is canonical
      for each search type.

Do not begin with a broad rewrite. Refactor one protected behavior at a time and
keep query-result parity visible in each pull request.

## P2: Reproducible Development and Operations

- [ ] Replace the generated `nextjs/README.md` with project-specific setup and
      troubleshooting instructions.
- [ ] Document how `vision_zero.incidents_denver` is created and refreshed.
- [ ] Document how `public.denver_street_centerlines` is created and refreshed.
- [ ] Replace the hard-coded CDOT source filename with an explicit import argument.
- [ ] Make the CDOT import maintain `vz_date` and recalculate
      `suspected_duplicate` deterministically.
- [ ] Add safe migration tracking rather than relying on manually ordered SQL
      files.
- [ ] Align the Dockerfile Node version with the Node 24 application requirement.
- [ ] Verify `NEXT_PUBLIC_BASE_PATH` is present at the correct Docker build stage.
- [ ] Make a clean `docker compose up` initialize every required database, role,
      schema, extension, and service—or clearly document what remains external.
- [ ] Restrict PostgreSQL network exposure and review `pg_hba.conf`.
- [ ] Add continuous integration for lint, tests, TypeScript, and production build.
- [ ] Add a repository-level license after the owner selects one.

## P3: Later Product Decisions

- [ ] Decide whether drawn lines should snap to roads, follow a routing engine, or
      remain arbitrary corridors.
- [ ] Consider selecting existing visible street segments directly on the map.
- [ ] Consider multi-segment route selection and editing.
- [ ] Consider annual history for arbitrary polygons and routes.
- [ ] Consider exporting summary metrics and chart-ready annual history separately.
- [x] Mark the bookmarkable-query URL product decision complete after the P1
      feature branch is merged and its release checks are recorded.
- [ ] Review accessibility, keyboard drawing alternatives, and non-map workflows.

## Definition of Done for Feature Pull Requests

- [ ] Work is based on current `upstream/main` and lives on a feature branch.
- [ ] The pull request is narrow and does not include `.env`, raw data, generated
      database exports, or unrelated changes.
- [ ] New behavior has automated tests; changed behavior has regression tests.
- [ ] `yarn lint`, tests, and `yarn build --webpack` pass with Node 24.
- [ ] Desktop and mobile behavior have been exercised.
- [ ] Database verification is read-only and does not require production writes.
- [ ] User-facing labels distinguish source data from legal crash reports.
- [ ] Documentation and this checklist are updated when architecture or decisions
      change.
