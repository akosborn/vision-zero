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
- [ ] Confirm and document analytical assumptions with the maintainer.
  - [ ] DOTI/CDOT match requires the normalized time and a distance within 200
        meters.
  - [ ] DOTI is the base result set; CDOT-only records are omitted.
  - [ ] KABCO fallbacks for DOTI records.
  - [ ] Comprehensive cost source and update policy.

## P1: Export Current Results to CSV

- [ ] Confirm the initial export contract with the maintainer.
  - [ ] Default proposal: one row per currently filtered crash.
  - [ ] Decide whether to include a second summary CSV or summary header rows.
  - [ ] Decide whether age and sex fields belong in the public export.
- [ ] Add a reusable crash-to-CSV utility.
  - [ ] Use a fixed, documented column order.
  - [ ] Preserve both DOTI and CDOT identifiers when present.
  - [ ] Include date, address, coordinates, severity, fatalities, serious injuries,
        bicycle/pedestrian involvement, and relevant road/speed fields.
  - [ ] Include source/request URLs only when they are accurate.
  - [ ] Escape commas, quotes, and line breaks according to CSV conventions.
  - [ ] Neutralize values beginning with `=`, `+`, `-`, or `@` to prevent spreadsheet
        formula injection.
- [ ] Add an **Export CSV** action to the location report.
  - [ ] Export the active result set, not stale results from another search mode.
  - [ ] Disable the action while loading or when there are no crashes.
  - [ ] Use a meaningful filename containing the search type and date.
  - [ ] Support desktop and mobile layouts.
- [ ] Add unit tests for columns, escaping, empty values, formulas, filenames, and
      mixed DOTI/CDOT records.
- [ ] Manually verify the result in Excel, Numbers, and a plain-text editor.

## P1: Link Crash Rows to Authoritative Sources

- [ ] Add an optional source-link model to the `Crash` interface and crash-row UI.
- [ ] Implement **View DOTI source record**.
  - [ ] Build the link from an official Denver Open Data/ArcGIS identifier.
  - [ ] Prefer a human-readable filtered record view when stable.
  - [ ] Fall back to an official ArcGIS query result rather than a third-party site.
  - [ ] Verify links against several current and older incidents.
- [ ] Implement honest CDOT report guidance.
  - [ ] Keep displaying the CDOT CUID.
  - [ ] Do not treat the CDOT `link` database column as a URL; it is a roadway value.
  - [ ] Link to Colorado DMV's official crash-report request instructions.
  - [ ] Label the action **How to request the official report**, not **View report**.
- [ ] Preserve the existing Google Maps location link as a separate action.
- [ ] Add accessibility text and ensure external links open safely.
- [ ] Add tests for DOTI-only, CDOT-enriched, missing-ID, and missing-link cases.

Official references:

- Denver Traffic Accidents dataset:
  <https://data.colorado.gov/Community/City-of-Denver-Traffic-Accidents/cpwf-cznk>
- CDOT crash data guidance:
  <https://www.codot.gov/safety/traffic-safety/data-analysis/crash-data>
- Colorado DMV report requests:
  <https://dmv.colorado.gov/obtaining-crash-reports-or-ticket-information>

## P1: Draw a Route or Road Corridor on the Map

- [ ] Confirm the first-version interaction model.
  - [ ] Record whether the MVP is a user-drawn corridor buffered by the selected
        number of feet.
  - [ ] Record exact Denver street-centerline snapping as included or deferred.
- [ ] Add `Draw Route` as a search mode for desktop and mobile.
- [ ] Implement drawing state separately from radius-search state.
  - [ ] Start drawing explicitly.
  - [ ] Add vertices by click or tap.
  - [ ] Preview the line as it is drawn.
  - [ ] Provide Undo, Clear, Cancel, and Apply.
  - [ ] Prevent map clicks from launching radius searches while drawing.
  - [ ] Preserve normal pan and zoom behavior where practical.
- [ ] Convert the drawn line to a GeoJSON `FeatureCollection`.
- [ ] Reuse `POST /api/incidents/buffered-route` rather than creating duplicate
      PostGIS query logic.
- [ ] Reuse the existing date-range and buffer-distance controls.
- [ ] Draw both the selected line and its search area clearly on the map.
- [ ] Define what the **History** tab shows for drawn and uploaded routes.
  - [ ] Confirm that current uploaded-route behavior provides no annual history.
  - [ ] Either add route-history support or hide/disable the unavailable view.
- [ ] Make route upload and route drawing feature flags consistent across desktop
      and mobile.
- [ ] Add tests for route creation, undo, clear, apply, empty geometry, mobile
      interaction, mode switching, and API payload shape.
- [ ] Verify a drawn route and an equivalent uploaded GPX/KML route return the
      same crash set for the same buffer and dates.

## P2: Backend Maintainability

- [ ] Extract the repeated DOTI/CDOT crash projection into a shared, reviewed SQL
      or query-building boundary.
- [ ] Centralize DOTI/CDOT matching and GeoJSON construction.
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
- [ ] Decide whether filters and drawn geometry should be shareable through the
      URL.
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
