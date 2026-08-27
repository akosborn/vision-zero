# Vision Zero Architecture

This is a living orientation guide for maintainers, collaborators, and future
coding sessions. It describes the system currently represented by `main`; check
the Git history before relying on it after a major refactor.

## Purpose

Vision Zero is a Denver crash-analysis application. It lets a user search for
crashes near a point, along a street, between cross streets, or near an uploaded
route. Results are shown on a Mapbox map and summarized in a location report.

The repository contains more than the custom map. It also contains database
schema and import work, a Metabase dashboard, and the Docker/Nginx configuration
used to serve the system.

## System at a Glance

```text
Denver DOTI incidents -----+
                           |
Colorado CDOT crashes -----+--> PostgreSQL + PostGIS
                           |          |
Denver street centerlines -+          v
                                  Next.js API
                                       |
                        +--------------+--------------+
                        |              |              |
                     Mapbox         Filters     Location report

Public request --> Nginx --> /map --> Next.js
                         \-> other --> Metabase
```

PostGIS performs the spatial work: measuring radius searches, buffering routes
and streets, finding crashes inside those buffers, and returning GeoJSON that
Mapbox can draw.

## Repository Map

| Path                                    | Responsibility                                                   |
| --------------------------------------- | ---------------------------------------------------------------- |
| `nextjs/`                               | Custom map, React interface, and Next.js API                     |
| `nextjs/app/page.tsx`                   | Owns filters and result state and coordinates searches           |
| `nextjs/app/components/Map.tsx`         | Draws the map, crashes, streets, buffers, and popups             |
| `nextjs/app/components/FilterPanel.tsx` | Search mode, date, radius, street, and upload controls           |
| `nextjs/app/components/LocationReport/` | Summary, crash list, crash details, and history chart            |
| `nextjs/app/lib/api-client.ts`          | Browser-side functions for calling the Next.js API               |
| `nextjs/app/lib/db.ts`                  | PostgreSQL connection pool                                       |
| `nextjs/app/api/`                       | Server endpoints and PostGIS queries                             |
| `data/`                                 | CDOT import, schema changes, indexes, joins, and street-path SQL |
| `compose.yaml`                          | PostgreSQL, Metabase, Next.js, and Nginx services                |
| `nginx.conf`                            | HTTPS and routing for the public deployment                      |
| `postgresql.conf`, `pg_hba.conf`        | PostgreSQL network configuration                                 |
| `TODO.md`                               | Prioritized maintenance and feature checklist                    |

There is no root JavaScript package. Application commands run from `nextjs/`;
data-import commands run from `data/`.

## Primary Data

### Denver DOTI incidents

`vision_zero.incidents_denver` is the base incident table used by the map. API
queries begin with this table, so a CDOT-only row is not displayed unless it has
a matching DOTI incident.

The public source is Denver's Traffic Accidents dataset:

- <https://opendata-geospatialdenver.hub.arcgis.com/datasets/db00bd99ea534d8987e0913a191ebe19_325/explore>
- ArcGIS FeatureServer layer `325` in service
  `ODC_CRIME_TRAFFICACCIDENTS5YR_P`

The database setup and refresh process for this table is not fully represented
in this repository.

### Colorado CDOT crashes

`vision_zero.cdot_crashes` contains state crash fields. `data/cdot/upsert.ts`
imports a local CSV, restricted to Denver records. The schema scripts add a
geographic point, timestamps, indexes, and a suspected-duplicate flag.

The current import script has a hard-coded source filename and is a manual data
operation. It must not be run with ordinary application credentials.

CDOT's `link` field is a roadway/link classification value, not a web URL. CDOT
does not publish direct URLs for individual legal crash reports; those reports
must be requested from the Colorado Department of Revenue or the responding
agency.

### Street centerlines

`public.denver_street_centerlines` supplies street names, cross streets, speed
limits, and line geometry. `get_street_segments_between(...)` recursively finds
the shortest connected portion of a named street between two cross streets.

The repository does not include a complete clean import for this table.

### DOTI/CDOT matching

The map API uses DOTI incidents as its base population. CDOT data can enrich a
matched DOTI incident, but an unmatched CDOT crash is omitted from map searches
and annual street history.

A CDOT row is eligible to enrich a DOTI incident when its normalized timestamp
exactly equals `doti.first_occurrence_date` and its geography is within 200
meters of the DOTI geography. Most routes calculate the timestamp as
`(crash_date + crash_time) AT TIME ZONE 'UTC' AT TIME ZONE 'America/Denver'`;
annual street history compares the stored `cdot.vz_date` value produced by the
same expression. Map API enrichment excludes suspected CDOT duplicates. When
both geometries exist, API responses generally prefer the CDOT point with
`COALESCE(cdot.geo, doti.geo)`.

The 200-meter tolerance is an analytical assumption, not a guaranteed identity
match. There is no time tolerance or nearest-match rule, so more than one CDOT
row can be eligible for a DOTI incident. Changes to these rules require data
review and regression evidence.

`data/cdot/schema/4_add_vz_date.sql` backfills `vz_date`, but the current CDOT
upsert does not maintain that derived value. Import operations must refresh it
before annual history can include newly imported CDOT rows.

## Search Flows

### Radius search

1. The user clicks the map and chooses a radius and date range.
2. `Map.tsx` or `page.tsx` calls `getIncidents(...)`.
3. `GET /api/incidents` uses `ST_DWithin` around the selected point.
4. The API returns a GeoJSON `FeatureCollection`.
5. The map draws crash points and the report summarizes the same features.

### Street search

1. `GET /api/streets` loads street names and their cross streets.
2. The user chooses a full street or a segment between two cross streets.
3. The client requests the centerline, its buffer, crashes inside the buffer,
   and annual history in parallel.
4. PostGIS selects either the whole named street or the segment returned by
   `get_street_segments_between(...)`.
5. The client draws the centerline and buffer and opens the location report.

### Uploaded route

1. `FilterPanel.tsx` parses a GPX or KML file into GeoJSON in the browser.
2. `page.tsx` removes features without geometry.
3. `POST /api/incidents/buffered-route` unions and buffers the supplied
   geometries using a parameterized query.
4. Crashes within the route buffer are returned and displayed.

Uploaded routes currently do not receive annual-history results.

### Planned drawn route

The planned drawing tool should produce the same GeoJSON contract as an uploaded
route and reuse `POST /api/incidents/buffered-route`. The first version should be
a drawn corridor, not an exact road-snapping or routing engine. See `TODO.md`.

## API Surface

| Method and path                              | Purpose                                         |
| -------------------------------------------- | ----------------------------------------------- |
| `GET /api/incidents`                         | Crashes by date, bounding box, or point radius  |
| `GET /api/streets`                           | Street names and available cross streets        |
| `GET /api/street-centerlines`                | GeoJSON for a full street or selected segment   |
| `GET /api/buffered-street-centerlines`       | Polygon around a street or segment              |
| `GET /api/incidents/buffered-street`         | Crashes inside a street buffer                  |
| `GET /api/incidents/buffered-street/history` | Annual street crash summary                     |
| `POST /api/incidents/buffered-route`         | Crashes inside uploaded or drawn route geometry |

The API is part of the Next.js application rather than a separately deployed
backend service.

## Frontend State and Reporting

`page.tsx` is the current state coordinator. It owns:

- search tool and filters;
- map viewport;
- radius-search crash GeoJSON;
- street/route crash GeoJSON;
- street centerline and buffer GeoJSON;
- annual history;
- mobile panels and loading state.

`LocationReport` chooses street/route results over radius results and derives a
summary in the browser. The summary uses the KABCO severity scale:

- `K`: fatal;
- `A`: suspected serious injury;
- `B`: suspected minor injury;
- `C`: possible injury;
- `O`: no apparent injury.

Comprehensive cost is estimated from the most severe outcome assigned to each
crash.

### Current KABCO and comprehensive-cost behavior

These rules describe the tested implementation. They remain analytical policy
choices pending maintainer confirmation:

- for a CDOT-enriched incident, the report uses CDOT injury fields `04` through
  `00` for K through O and does not fall back to DOTI when those fields are empty;
- for a DOTI-only incident, fatalities count as K and serious injuries count as
  A; the available projection does not infer B or C, and assigns one O crash
  unit when neither K nor A is present;
- the API projection supplies one fatality or serious injury when the numeric
  field is absent or zero but the DOTI offense description contains `FATAL` or
  `SBI`; and
- each crash contributes one cost at its maximum KABCO severity, even when more
  than one person is injured.

The comprehensive unit costs are the national economic-plus-quality-of-life
values in 2024 dollars from
[FHWA-SA-25-021, Table 1](https://highways.dot.gov/sites/fhwa.dot.gov/files/2025-10/CrashCostFactSheet_508_OCT2025.pdf):
K `$15,988,000`, A `$1,705,100`, B `$384,000`, C `$204,600`, and O `$18,100`.
They are analytical estimates, not legal damages estimates. The application
does not apply a Colorado per-capita-income adjustment or an independent
inflation adjustment.

The proposed update policy is to review the table annually and when FHWA
publishes a replacement, without independently applying CPI. A cost update
should change the publication identifier and URL, dollar year, constants,
tests, UI explanation, and this documentation together. This cadence and the
choice of national rather than Colorado-adjusted values require maintainer
approval before the analytical-assumption TODO can be closed.

## Deployment

`compose.yaml` defines four services:

| Service    | Role                                          |
| ---------- | --------------------------------------------- |
| `postgres` | PostgreSQL 17 with PostGIS                    |
| `nextjs`   | Standalone production build of the custom map |
| `metabase` | General analytical dashboard                  |
| `nginx`    | TLS termination and reverse proxy             |

The production Nginx configuration sends `/map` to Next.js. The root URL redirects
to a public Metabase dashboard, and other non-map paths are proxied to Metabase.
Certificates are managed with Certbot volumes.

The expected configuration variable names are:

- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `NEXT_PUBLIC_MAPBOX_PUBLIC_TOKEN`
- `NEXT_PUBLIC_BASE_PATH` in the deployed map configuration

Never add real values to documentation, examples, commits, logs, screenshots, or
pull requests. `nextjs/.env` is for local secrets and must remain ignored.

## Local Development

The intended lightweight setup runs the Next.js application locally against a
maintainer-provided read-only PostGIS account.

```bash
cd nextjs
cp .env.example .env
# Fill .env with separately supplied values.
yarn install --frozen-lockfile
yarn dev
```

Use Node 24, as declared by `nextjs/.nvmrc` and `package.json`. If Turbopack is
unresponsive in the local environment, the verified fallback is:

```bash
yarn dev --webpack
yarn build --webpack
```

Before running the app, confirm the database account cannot create schemas or
objects and has no insert, update, delete, truncate, or trigger privileges on
application tables.

## Trust Boundaries and Known Debt

- Treat the remote database as an external system. Ordinary development must use
  read-only credentials.
- Keep all user-controlled values parameterized before they reach SQL. Several
  existing street routes still interpolate names directly and are high-priority
  security debt.
- The application endpoints do not implement an authentication layer.
- PostgreSQL is published on host port `5432`, and the checked-in access rule is
  broad. Production firewall and database exposure must be reviewed separately.
- Incident projections and joins are duplicated across API routes. Consolidate
  them only after characterization tests protect existing behavior.
- There is currently no automated test suite or checked-in CI workflow.
- A clean database cannot yet be reproduced solely from this repository.
- The Node version in the production Dockerfile and the Node version required by
  the application must be aligned.

## Verification Before a Pull Request

Run checks from `nextjs/` with Node 24:

```bash
yarn lint
yarn build --webpack
```

Also run the test command once the test foundation in `TODO.md` is implemented.
Do not use production deployment, data import, or schema commands as routine
feature verification.

## Collaboration Workflow

- Use a private fork for development.
- Keep the fork as `origin` and the maintainer repository as `upstream`.
- Work on a feature branch, not `main`.
- Keep pull requests narrow and include verification evidence.
- Never commit `.env`, database exports, raw protected records, or credentials.
- Confirm assumptions about data semantics and public record links with the
  maintainer rather than inventing contracts.
