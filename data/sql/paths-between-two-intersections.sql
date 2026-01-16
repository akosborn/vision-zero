with recursive
    street_path as ( select sc.id,
                            sc.fnode,
                            sc.tnode,
                            sc.fromname,
                            sc.toname,
                            sc.geom,
                            array [sc.id]                                      as path,
                            array [sc.fromname, sc.toname]                     as all_cross_streets,
                            (${CROSSING_STREET_1} in (sc.fromname, sc.toname) and
                             ${CROSSING_STREET_2} in (sc.fromname, sc.toname)) as connects_both
                     from denver_street_centerlines sc
                     where sc.fullname = ${PRIMARY_STREET}
                       and (sc.fromname in (${CROSSING_STREET_1}, ${CROSSING_STREET_2}) or
                            sc.toname in (${CROSSING_STREET_1}, ${CROSSING_STREET_2}))

                     union all

                     select sc.id,
                            sc.fnode,
                            sc.tnode,
                            sc.fromname,
                            sc.toname,
                            sc.geom,
                            sp.path || sc.id,
                            array_cat(sp.all_cross_streets, array [sc.fromname, sc.toname]),
                            sp.connects_both or (${CROSSING_STREET_1} = any
                                                 (array_cat(sp.all_cross_streets, array [sc.fromname, sc.toname])) and
                                                 ${CROSSING_STREET_2} = any
                                                 (array_cat(sp.all_cross_streets, array [sc.fromname, sc.toname])))
                     from denver_street_centerlines sc
                              inner join street_path sp
                                         on ((sc.fnode in (sp.fnode, sp.tnode) or sc.tnode in (sp.fnode, sp.tnode)) and
                                             sc.fullname = ${PRIMARY_STREET} and not sc.id = any (sp.path) and
                                             not sp.connects_both) ),
    shortest_valid_path as ( select path, all_cross_streets
                             from street_path
                             where connects_both
                             order by array_length(path, 1)
                             limit 1 ),
    all_cross_streets_in_path as ( select distinct unnest(all_cross_streets) as cross_street from shortest_valid_path )
select distinct sc.id, sc.fullname, sc.fromname, sc.toname, sc.geom
from denver_street_centerlines sc
where sc.id in ( select unnest(path) from shortest_valid_path ) -- Changed to unnest
  and sc.fromname in ( select cross_street from all_cross_streets_in_path )
  and sc.toname in ( select cross_street from all_cross_streets_in_path )
  and not ((sc.fromname in (${CROSSING_STREET_1}, ${CROSSING_STREET_2}) and
            sc.toname not in ( select cross_street from all_cross_streets_in_path )) or
           (sc.toname in (${CROSSING_STREET_1}, ${CROSSING_STREET_2}) and
            sc.fromname not in ( select cross_street from all_cross_streets_in_path )))
order by sc.id;
