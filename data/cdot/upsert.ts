import * as dotenv from 'dotenv';
import {Client} from 'pg';
import {parse} from 'csv-parse';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {DateTime} from 'luxon';

dotenv.config();

const run = async () => {
  // const client = new Client({
  //   user: process.env.DB_USER,
  //   password: process.env.DB_PASSWORD,
  //   host: process.env.DB_HOST,
  //   port: parseInt(process.env.DB_PORT as string),
  //   database: process.env.DB_NAME,
  // });
  // await client.connect();

  const csvPath = path.join(__dirname, 'raw/denver/2025.csv');
  await readCsv(csvPath);
};

const readCsv = async (path: string) => {
  const records = [];
  const parser = fs.createReadStream(path).pipe(
    parse({
      columns: (header) =>
        header.map((column: string) => column.toLowerCase().replace(/[\s-]+/g, '_')),
      cast: (value, context) => {
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
    records.push(record);
  }

  return records;
};

run();
