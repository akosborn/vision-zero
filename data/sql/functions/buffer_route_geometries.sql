-- for the custom-route endpoint
CREATE OR REPLACE FUNCTION vision_zero.buffer_route_geometries(
    route_geometries jsonb,
    buffer_meters double precision
) RETURNS geometry AS $$
SELECT ST_Buffer(
   ST_Union(
           ST_SetSRID(ST_Force2D(ST_GeomFromGeoJSON(g)), 4326)
   )::geography,
   buffer_meters
)::geometry
FROM jsonb_array_elements(route_geometries) AS g;
$$ LANGUAGE sql IMMUTABLE;
