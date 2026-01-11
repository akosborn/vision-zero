import * as dotenv from 'dotenv';
import {Client} from 'pg';

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


};

run();
