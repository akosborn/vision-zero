import dbClient from "@/app/lib/db";

export async function GET() {
  const results = await dbClient.query<Street>(query);
  return Response.json(results.rows);
}

const query = `
  select distinct 
    concat(name, ' ', type) as street,
    array_remove(array_agg(distinct prefix order by prefix), null) as prefixes,
    (select array_agg(distinct x order by x) from unnest(array_agg(fromname) || array_agg(toname)) t(x)) as "crossingStreets"
  from public.denver_street_centerlines cl
  group by 1
  order by 1;
`;

export type Street = {
  street: string;
  prefixes: string[];
  crossingStreets: string[];
};
