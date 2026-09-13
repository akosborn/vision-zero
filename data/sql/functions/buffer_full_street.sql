-- for the full-street endpoint (no cross streets)
CREATE OR REPLACE FUNCTION vision_zero.buffer_full_street(
    street_full_name varchar,
    buffer_meters double precision
) RETURNS geometry AS $$
SELECT ST_Buffer(ST_Union(geom)::geography, buffer_meters)::geometry
FROM public.denver_street_centerlines
WHERE fullname = street_full_name;
$$ LANGUAGE sql STABLE;
