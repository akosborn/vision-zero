import * as dotenv from 'dotenv';
import {Client} from 'pg';
import {parse} from 'csv-parse';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {DateTime} from 'luxon';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const run = async () => {
  const csvPath = path.join(__dirname, 'raw/denver/2025.csv');
  const srcRecords = await readCsv(csvPath);

  if (srcRecords.length === 0) {
    console.log('No records found in csv.');
    return;
  }

  const client = new Client({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT as string),
    database: process.env.DB_NAME,
  });
  await client.connect();

  const tableName = 'vision_zero.cdot_crashes';
  
  const computedColumns = ['geo'];
  
  const columns = [...Object.keys(srcRecords[0]), ...computedColumns];
  const columnNames = columns.join(', ');

  // Create placeholders ($1, $2, etc.)
  const placeholders = columns.slice(0, -computedColumns.length).map((_, i) => `$${i + 1}`).join(', ');

  await Promise.all(srcRecords.map(async (record) => {
    const computedValues = [`ST_SetSRID(ST_MakePoint(${record.latitude}, ${record.longitude}), 4326)::geography`];
    const values = columns.slice(0, -computedColumns.length).map(col => record[col]);

    const query = `INSERT INTO ${tableName} (${columnNames}) VALUES (${placeholders}, ${computedValues.join(', ')}) ON CONFLICT DO NOTHING RETURNING cuid, ${computedColumns.join(', ')};`;

    return client.query(query, values)
      .catch((err) => console.error(err, record));
  }));

  await client.end();
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
