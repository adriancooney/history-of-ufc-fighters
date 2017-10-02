SELECT
    f.id,
    f.name,
    f.nickname,
    array_agg(CASE WHEN ff.result = 'win' THEN 1 WHEN ff.result = 'loss' THEN -1 ELSE 0 END) as history
FROM
    fighters f,
    fight_fighters ff
WHERE
    ff.fighter = f.id
GROUP BY
    ff.fighter, f.id;