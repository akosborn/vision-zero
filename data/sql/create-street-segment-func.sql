-- Example usage:
-- Get segments of N ALBION ST between E 23RD AVE and E 28TH AVE
SELECT * FROM get_street_segments_between('N ALBION ST', 'E 23RD AVE', 'E 28TH AVE');

-- The order of crossing streets doesn't matter (direction-agnostic)
SELECT * FROM get_street_segments_between('N ALBION ST', 'E 28TH AVE', 'E 23RD AVE');

SELECT geom FROM get_street_segments_between('N ALBION ST', 'E 23RD AVE', 'E 28TH AVE');

SELECT ST_LineMerge(ST_Union(geom)) as merged_geom
FROM get_street_segments_between('N ALBION ST', 'E 23RD AVE', 'E 28TH AVE');

CREATE OR REPLACE FUNCTION get_street_segments_between(
    p_street_name VARCHAR,
    p_crossing_street_1 VARCHAR,
    p_crossing_street_2 VARCHAR
)
    RETURNS TABLE (
                      id INTEGER,
                      fullname VARCHAR,
                      fromname VARCHAR,
                      toname VARCHAR,
                      geom GEOMETRY(LineString, 4326)
                  )
    LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
        WITH RECURSIVE street_path AS (
            SELECT
                sc.id,
                sc.fnode,
                sc.tnode,
                sc.fromname,
                sc.toname,
                sc.geom,
                ARRAY[sc.id] as path,
                ARRAY[sc.fromname, sc.toname] as all_cross_streets,
                (p_crossing_street_1 IN (sc.fromname, sc.toname) AND p_crossing_street_2 IN (sc.fromname, sc.toname)) as connects_both
            FROM denver_street_centerlines sc
            WHERE sc.fullname = p_street_name
              AND (sc.fromname IN (p_crossing_street_1, p_crossing_street_2)
                OR sc.toname IN (p_crossing_street_1, p_crossing_street_2))

            UNION ALL

            SELECT
                sc.id,
                sc.fnode,
                sc.tnode,
                sc.fromname,
                sc.toname,
                sc.geom,
                sp.path || sc.id,
                array_cat(sp.all_cross_streets, ARRAY[sc.fromname, sc.toname]),
                sp.connects_both OR
                (p_crossing_street_1 = ANY(array_cat(sp.all_cross_streets, ARRAY[sc.fromname, sc.toname]))
                    AND p_crossing_street_2 = ANY(array_cat(sp.all_cross_streets, ARRAY[sc.fromname, sc.toname])))
            FROM denver_street_centerlines sc
                     INNER JOIN street_path sp ON (
                (sc.fnode IN (sp.fnode, sp.tnode) OR sc.tnode IN (sp.fnode, sp.tnode))
                    AND sc.fullname = p_street_name
                    AND NOT sc.id = ANY(sp.path)
                    AND NOT sp.connects_both
                )
        ),
                       shortest_valid_path AS (
                           SELECT path, all_cross_streets
                           FROM street_path
                           WHERE connects_both
                           ORDER BY array_length(path, 1)
                           LIMIT 1
                       ),
                       all_cross_streets_in_path AS (
                           SELECT DISTINCT unnest(all_cross_streets) as cross_street
                           FROM shortest_valid_path
                       )
        SELECT DISTINCT
            sc.id,
            sc.fullname,
            sc.fromname,
            sc.toname,
            sc.geom
        FROM denver_street_centerlines sc
        WHERE sc.id IN (SELECT unnest(path) FROM shortest_valid_path)
          AND sc.fromname IN (SELECT cross_street FROM all_cross_streets_in_path)
          AND sc.toname IN (SELECT cross_street FROM all_cross_streets_in_path)
          AND NOT (
            (sc.fromname IN (p_crossing_street_1, p_crossing_street_2)
                AND sc.toname NOT IN (SELECT cross_street FROM all_cross_streets_in_path))
                OR
            (sc.toname IN (p_crossing_street_1, p_crossing_street_2)
                AND sc.fromname NOT IN (SELECT cross_street FROM all_cross_streets_in_path))
            )
        ORDER BY sc.id;
END;
$$;
