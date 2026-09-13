-- for cross streets
CREATE OR REPLACE FUNCTION vision_zero.buffer_street_segment(
    full_street_name varchar,
    cross_street_1 varchar,
    cross_street_2 varchar,
    buffer_meters double precision
) RETURNS geometry AS $$
SELECT ST_Buffer(ST_Union(geom)::geography, buffer_meters)::geometry
FROM get_street_segments_between(full_street_name, cross_street_1, cross_street_2);
$$ LANGUAGE sql STABLE;
