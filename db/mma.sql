DO
$body$
BEGIN
    IF EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'mmaweb') THEN
        DROP OWNED BY mmaweb;
        DROP ROLE mmaweb;
    END IF;
END
$body$;

ALTER DATABASE mma SET datestyle TO "ISO, DMY";

CREATE SCHEMA mma;

CREATE TYPE mma.fight_result AS ENUM (
    'win',
    'loss',
    'draw',
    'NC'
);

CREATE TYPE mma.fighter_class AS ENUM (
    'Heavyweight',
    'Featherweight',
    'Light Heavyweight',
    'Lightweight',
    'Strawweight',
    'Flyweight',
    'Middleweight',
    'Super Heavyweight',
    'Welterweight',
    'Bantamweight'
);

CREATE TABLE mma.promotion(
    id       SERIAL PRIMARY KEY,
    name     VARCHAR(200),
    nickname VARCHAR(100)
);

CREATE TABLE mma.fighter(
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100),
    nickname    VARCHAR(100),
    dob         DATE,
    nationality VARCHAR(100),
    address     VARCHAR(250),
    association VARCHAR(100),
    class       mma.fighter_class,
    height      DECIMAL,
    weight      DECIMAL,
    sherdog_id  INT UNIQUE,
    sherdog_url VARCHAR(100)
);

CREATE TABLE mma.event(
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(250),
    location    VARCHAR(250),
    dateof      DATE,
    sherdog_id  INT UNIQUE,
    sherdog_url VARCHAR(100),
    promotion   INT REFERENCES mma.promotion(id)
);

CREATE TABLE mma.fight(
    id              SERIAL PRIMARY KEY,
    event           INT REFERENCES mma.event(id),
    card_index      INT,
    method          VARCHAR(300),
    method_detail   VARCHAR(300),
    round           INT,
    round_time      INTERVAL,
    referee         VARCHAR(40)
);

CREATE TABLE mma.fight_fighters(
    fight       INT REFERENCES mma.fight(id),
    fighter     INT REFERENCES mma.fighter(id),
    result      mma.fight_result
);

CREATE OR REPLACE FUNCTION mma.fight_line(results int[])
    RETURNS int[] AS
$$
DECLARE
    fightLine int[];
    lastResult int := 0;
    i int;
BEGIN
    FOR i IN 1..array_upper(results, 1)
    LOOP
        lastResult := lastResult + results[i];
        fightLine[i] := lastResult;
    END LOOP;

    RETURN fightLine;
END;
$$
LANGUAGE 'plpgsql' IMMUTABLE;

CREATE VIEW mma.full_fights AS
    SELECT DISTINCT ON (CASE WHEN ff1.fighter < ff2.fighter THEN (f.id, ff1.fighter, ff2.fighter) ELSE (f.id, ff2.fighter, ff1.fighter) END)
        f.id as id,
        ff1.fighter as f1_id,
        ff2.fighter as f2_id,
        ff1.result as f1_result,
        ff2.result as f2_result
    FROM
        mma.fight f
    JOIN mma.fight_fighters ff1 ON ff1.fight = f.id
    JOIN mma.fight_fighters ff2 ON ff2.fight = f.id AND ff2.fighter != ff1.fighter
    JOIN mma.fighter f1 ON f1.id = ff1.fighter
    JOIN mma.fighter f2 ON f2.id = ff2.fighter;

CREATE VIEW mma.fighter_stats AS
    SELECT
        f.id,
        f.name,
        f.nickname,
        array_agg(CASE WHEN ff.result = 'win' THEN 1 WHEN ff.result = 'loss' THEN -1 ELSE 0 END) AS fight_history,
        mma.fight_line(array_agg(CASE WHEN ff.result = 'win' THEN 1 WHEN ff.result = 'loss' THEN -1 ELSE 0 END)::int[]) as fight_line,
        count(ff.fight) AS fight_count,
        count(ff.fighter) FILTER (WHERE ff.result = 'win') AS win_count,
        count(ff.fighter) FILTER (WHERE ff.result = 'loss') AS loss_count,
        count(ff.fighter) FILTER (WHERE ff.result = 'draw') AS draw_count
    FROM
        mma.fighter f,
        mma.fight_fighters ff
    WHERE
        ff.fighter = f.id
    GROUP BY
        ff.fighter, f.id;

CREATE VIEW mma.initial_selected AS
    SELECT
        *
    FROM
        mma.fighter
    WHERE
        name IN (
            'Conor McGregor',
            'Ronda Rousey',
            'Nate Diaz',
            'Max Holloway',
            'Jon Jones',
            'Chuck Liddell',
            'Chris Weidman',
            'Anderson Silva',
            'Robbie Lawler',
            'Michael Bisping',
            'Vitor Belfort',
            'Jose Aldo',
            'Royce Gracie',
            'Chris Lytle',
            'Holly Holm',
            'Tito Ortiz',
            'Donald Cerrone',
            'Georges St. Pierre',
            'Frankie Edgar',
            'Chad Mendes'
        );

CREATE VIEW mma.bounds_fights AS
    SELECT
        max(f.fights) as max_fights,
        min(f.fights) as min_fights
    FROM (
        SELECT
            count(fighter) as fights
        FROM
            mma.fight_fighters
        GROUP BY
            fighter
    ) AS f;

CREATE VIEW mma.bounds_results AS
    SELECT
        max(win_count) as max_win_count,
        max(loss_count) as max_loss_count
    FROM (
        SELECT
            count(*) FILTER (where result = 'win') as win_count,
            count(*) FILTER (where result = 'loss') as loss_count
        FROM
            mma.fight_fighters
        GROUP BY
            fighter
    ) AS counts;

CREATE VIEW mma.bounds_dates AS
    SELECT
        max(dateof) as max_date,
        min(dateof) as min_date
    FROM
        mma.event;

CREATE VIEW mma.bounds_line AS
    SELECT
        max(fl) as max_line,
        min(fl) as min_line
    FROM
        mma.fighter_stats fs,
        unnest(fs.fight_line) fl;

CREATE VIEW mma.bounds AS
    SELECT * FROM mma.bounds_results, mma.bounds_line, mma.bounds_dates, mma.bounds_fights;

CREATE ROLE mmaweb LOGIN;
GRANT CONNECT ON DATABASE mma TO mmaweb;
GRANT ALL ON SCHEMA mma TO mmaweb;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA mma TO mmaweb;
GRANT SELECT ON ALL TABLES IN SCHEMA mma TO mmaweb;