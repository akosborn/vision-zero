import * as dotenv from 'dotenv';
import {Pool} from 'pg';
import {parse} from 'csv-parse';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {DateTime} from 'luxon';
import pLimit from 'p-limit';

import {fileURLToPath} from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

/**
 * Imports [CDOT crash data](https://www.codot.gov/safety/traffic-safety/data-analysis/crash-data).
 */
const run = async () => {
  const csvPath = path.join(__dirname, 'raw/denver/2026-preliminary.csv');
  const srcRecords = await readCsv(csvPath);

  if (srcRecords.length === 0) {
    console.log('No records found in csv.');
    return;
  }

  const pool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT as string),
    database: process.env.DB_NAME,
    max: 50, // maximum number of connections in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000,
  });

  const tableName = 'vision_zero.cdot_crashes';

  // Columns computed in JS and bound as normal parameterized values.
  const boundComputedColumns = ['vz_date'];
  // Columns computed via raw SQL expressions (not bound values).
  const sqlComputedColumns = ['geo'];

  const srcColumns = Object.keys(srcRecords[0]);
  const columns = [...srcColumns, ...boundComputedColumns, ...sqlComputedColumns];
  const columnNames = columns.join(', ');

  // Placeholders only cover srcColumns + boundComputedColumns; sqlComputedColumns are raw SQL.
  const boundColumnCount = srcColumns.length + boundComputedColumns.length;
  const placeholders = Array.from({length: boundColumnCount}, (_, i) => `$${i + 1}`).join(', ');

  let progress = 0;
  const concurrencyLimit = pLimit(50); // Limit to 50 concurrent operations

  await Promise.all(srcRecords.map(async (record) => concurrencyLimit(async () => {
    const vzDate = toDenverInstant(record.crash_date, record.crash_time);

    const sqlComputedValues = [`ST_SetSRID(ST_MakePoint(${record.longitude}, ${record.latitude}), 4326)::geography`];
    const values = [...srcColumns.map(col => record[col]), vzDate];

    const query = `INSERT INTO ${tableName} (${columnNames}) VALUES (${placeholders}, ${sqlComputedValues.join(', ')}) ON CONFLICT DO NOTHING RETURNING cuid, ${sqlComputedColumns.join(', ')};`;

    const client = await pool.connect();

    return client.query(query, values)
      .then(() => {
        progress++;
        console.log(`Upserted ${progress} of ${srcRecords.length} (${Math.round((progress / srcRecords.length * 100))}%)`);
      })
      .catch((err) => console.error(err, record))
      .finally(() => client.release());
  })));

  await pool.end();
};

/**
 * Combines a Denver-local crash_date (ISO date string, e.g. '2026-03-15') and
 * crash_time (various raw formats seen in CDOT exports) into the correct UTC
 * instant for a `timestamptz` column.
 *
 * Equivalent to: (crash_date + crash_time) AT TIME ZONE 'America/Denver'
 */
const toDenverInstant = (crashDate: string | null, crashTime: string | null): string | null => {
  if (!crashDate || !crashTime) {
    return null;
  }

  const normalizedTime = normalizeCrashTime(crashTime);
  if (normalizedTime === null) {
    console.warn(`Unrecognized crash_time format: "${crashTime}" for date ${crashDate}`);
    return null;
  }

  const dt = DateTime.fromISO(`${crashDate}T${normalizedTime}`, {zone: 'America/Denver'});

  if (!dt.isValid) {
    console.warn(`Invalid date/time: ${crashDate} ${crashTime} (${dt.invalidReason})`);
    return null;
  }

  // ISO string with offset; pg will store this correctly as a timestamptz (UTC internally).
  return dt.toISO();
};

/**
 * Normalizes crash_time into 'HH:mm' or 'HH:mm:ss'.
 * Adjust this if your CDOT export uses a different raw format
 * (e.g. confirm whether times are 'HHmm', 'H:mm', or already 'HH:mm:ss').
 */
const normalizeCrashTime = (raw: string): string | null => {
  const trimmed = raw.trim();

  // Already HH:mm or HH:mm:ss
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    const [h, m, s] = trimmed.split(':');
    return `${h.padStart(2, '0')}:${m}${s ? `:${s}` : ''}`;
  }

  // Military-style digits, e.g. '1435' or '935'
  if (/^\d{3,4}$/.test(trimmed)) {
    const padded = trimmed.padStart(4, '0');
    return `${padded.slice(0, 2)}:${padded.slice(2)}`;
  }

  return null;
};

const readCsv = async (path: string) => {
  const records = [];
  const parser = fs.createReadStream(path).pipe(
    parse({
      columns: (header) =>
        header.map((column: string) => column.trim().toLowerCase().replace(/[\s-]+/g, '_')),
      cast: (value, context) => {
        if (value === '') {
          return null;
        }

        const numericColumns = [
          'latitude', 'longitude', 'number_killed', 'number_injured', 'injury_00', 'injury_01', 'injury_02', 'injury_03',
          'injury_04', 'total_vehicles', 'tu1_speed_limit', 'tu1_estimated_speed', 'tu1_speed', 'tu1_age', 'tu2_speed_limit',
          'tu2_estimated_speed', 'tu2_speed', 'tu2_age', 'tu1_nm_age', 'tu2_nm_age'
        ];
        if (numericColumns.includes(context.column as string)) {
          return Number(value);
        }

        const booleanColumns = ['secondary_crash', 'construction_zone', 'school_zone', 'tu1_hit_and_run', 'tu2_hit_and_run'];
        if (booleanColumns.includes(context.column as string)) {
          return value === 'TRUE';
        }

        if (context.column === 'crash_date') {
          return DateTime.fromFormat(value, 'M/d/yyyy').toISODate();
        }
        return value;
      },
      skip_empty_lines: true,
    })
  );

  for await (const record of parser) {
    if (record.city !== 'DENVER') {
      continue;
    }

    records.push(record);
  }

  return records;
};

run();
