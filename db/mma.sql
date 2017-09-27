CREATE TYPE FIGHT_RESULT AS ENUM (
    'win',
    'loss',
    'draw',
    'NC'
);

CREATE TABLE promotions(
    id       SERIAL PRIMARY KEY,
    name     VARCHAR(200),
    nickname VARCHAR(100)
);

CREATE TABLE fighters(
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100),
    nickname    VARCHAR(100),
    sherdog_id  INT UNIQUE,
    sherdog_url VARCHAR(100)
);

CREATE TABLE events(
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(250),
    location    VARCHAR(250),
    dateof      DATE,
    sherdog_id  INT UNIQUE,
    sherdog_url VARCHAR(100),
    promotion   INT REFERENCES promotions(id)
);

CREATE TABLE fights(
    id              SERIAL PRIMARY KEY,
    event           INT REFERENCES events(id),
    card_index      INT,
    method          VARCHAR(300),
    method_detail   VARCHAR(300),
    round           INT,
    round_time      INTERVAL,
    referee         VARCHAR(40)
);

CREATE TABLE fight_fighters(
    fight       INT REFERENCES fights(id),
    fighter     INT REFERENCES fighters(id),
    result      FIGHT_RESULT
);

CREATE VIEW all_fights AS
    SELECT DISTINCT ON (CASE WHEN ff1.fighter < ff2.fighter THEN (f.id, ff1.fighter, ff2.fighter) ELSE (f.id, ff2.fighter, ff1.fighter) END)
        f.id as id,
        ff1.fighter as f1_id,
        ff2.fighter as f2_id,
        ff1.result as f1_result,
        ff2.result as f2_result
    FROM
        fights f
    JOIN fight_fighters ff1 ON ff1.fight = f.id
    JOIN fight_fighters ff2 ON ff2.fight = f.id AND ff2.fighter != ff1.fighter
    JOIN fighters f1 ON f1.id = ff1.fighter
    JOIN fighters f2 ON f2.id = ff2.fighter;