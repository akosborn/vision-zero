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
    STABLE
AS $$
-- Shortest path (by length) over the street's segments, from those touching the
-- first crossing street to the first one reached touching the second. Each
-- segment is settled at most once, so the cost is polynomial in the number of
-- segments on the street. (Enumerating every path instead is exponential on
-- divided roads, whose parallel carriageways form many cycles, and can fill
-- the disk with temp files.)
--
-- On divided roads the two carriageways (oneway 1 and 2) share a node at every
-- intersection and are near-equal in length, so stepping between them is
-- penalized to keep the path on one side of the street.
DECLARE
    c_side_switch_penalty CONSTANT DOUBLE PRECISION := 1000;

    v_ids       INTEGER[];
    v_fnodes    INTEGER[];
    v_tnodes    INTEGER[];
    v_oneways   INTEGER[];
    v_lengths   DOUBLE PRECISION[];
    v_is_target BOOLEAN[];
    v_dist      DOUBLE PRECISION[];
    v_parent    INTEGER[];
    v_settled   BOOLEAN[];
    v_n         INTEGER;
    v_current   INTEGER;
    v_found     INTEGER;
    v_cost      DOUBLE PRECISION;
    v_path      INTEGER[] := '{}';
BEGIN
    SELECT
        array_agg(sc.id ORDER BY sc.id),
        array_agg(sc.fnode ORDER BY sc.id),
        array_agg(sc.tnode ORDER BY sc.id),
        array_agg(sc.oneway ORDER BY sc.id),
        array_agg(ST_Length(sc.geom::geography) ORDER BY sc.id),
        array_agg(p_crossing_street_2 IN (sc.fromname, sc.toname) ORDER BY sc.id),
        array_agg(
            CASE WHEN p_crossing_street_1 IN (sc.fromname, sc.toname)
                THEN ST_Length(sc.geom::geography)
                ELSE 'Infinity'
            END
            ORDER BY sc.id
        )
    INTO v_ids, v_fnodes, v_tnodes, v_oneways, v_lengths, v_is_target, v_dist
    FROM denver_street_centerlines sc
    WHERE sc.fullname = p_street_name;

    v_n := coalesce(cardinality(v_ids), 0);
    v_parent := array_fill(NULL::INTEGER, ARRAY[v_n]);
    v_settled := array_fill(FALSE, ARRAY[v_n]);

    LOOP
        v_current := NULL;
        FOR i IN 1..v_n LOOP
            IF NOT v_settled[i] AND v_dist[i] < 'Infinity'
                AND (v_current IS NULL OR v_dist[i] < v_dist[v_current]) THEN
                v_current := i;
            END IF;
        END LOOP;

        EXIT WHEN v_current IS NULL;

        IF v_is_target[v_current] THEN
            v_found := v_current;
            EXIT;
        END IF;

        v_settled[v_current] := TRUE;

        FOR i IN 1..v_n LOOP
            CONTINUE WHEN v_settled[i]
                OR NOT (v_fnodes[i] IN (v_fnodes[v_current], v_tnodes[v_current])
                    OR v_tnodes[i] IN (v_fnodes[v_current], v_tnodes[v_current]));

            v_cost := v_dist[v_current] + v_lengths[i]
                + CASE WHEN v_oneways[i] + v_oneways[v_current] = 3
                    THEN c_side_switch_penalty ELSE 0 END;

            IF v_cost < v_dist[i] THEN
                v_dist[i] := v_cost;
                v_parent[i] := v_current;
            END IF;
        END LOOP;
    END LOOP;

    WHILE v_found IS NOT NULL LOOP
        v_path := v_path || v_ids[v_found];
        v_found := v_parent[v_found];
    END LOOP;

    RETURN QUERY
        SELECT sc.id, sc.fullname, sc.fromname, sc.toname, sc.geom
        FROM denver_street_centerlines sc
        WHERE sc.id = ANY(v_path)
        ORDER BY sc.id;
END;
$$;
