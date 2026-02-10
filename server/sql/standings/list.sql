SELECT rank, team_name, points FROM standings WHERE season = $1 ORDER BY rank;
