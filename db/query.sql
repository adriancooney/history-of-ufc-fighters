-- SELECT
--     fr.id as fighter_id,
--     p.id as promotion_id,
--     p.name
-- FROM
--     mma.promotion p,
--     mma.event e,
--     mma.fight f,
--     mma.fight_fighters ff,
--     mma.fighter fr
-- WHERE
--     e.promotion = p.id AND
--     f.event = e.id AND
--     ff.fight = f.id AND
--     fr.id = ff.fighter
-- GROUP BY fr.id, p.id
-- ORDER BY fighter_id;

SELECT
    fr.id as fighter,
    p.id as promotion
FROM
    mma.fighter fr
JOIN
    mma.fight_fighters ff ON ff.fighter = fr.id
JOIN
    mma.fight f ON ff.fight = f.id
JOIN
    mma.event e ON e.id = f.event
JOIN
    mma.promotion p ON p.id = e.promotion
GROUP BY fr.id, p.id
ORDER BY fighter;