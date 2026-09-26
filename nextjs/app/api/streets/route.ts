import dbClient from "@/app/lib/db";
import { databaseFailureResponse } from "@/app/lib/api-responses";

export async function GET() {
  try {
    const results = await dbClient.query<Street>(query);
    return Response.json(results.rows);
  } catch {
    return databaseFailureResponse();
  }
}

const query = `
  select distinct
    fullname as "fullName",
    (select array_agg(distinct x order by x) from unnest(array_agg(fromname) || array_agg(toname)) t(x)) as "crossingStreets"
  from public.denver_street_centerlines cl
  group by 1
  order by 1
`;

export type Street = {
  fullName: string;
  crossingStreets: string[];
};
