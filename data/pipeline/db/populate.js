const path = require("path");
const { Client } = require("pg");
const {
    groupBy,
    property,
    map,
    merge
} = require("lodash");
const {
    mapSeries
} = require("bluebird");
const { readFile, csvRead } = require("../util");

const SQL_FILE = path.resolve(__dirname, "../../../db/mma.sql");
const DATA_FILE = path.resolve(__dirname, "../../fights.csv");

initializeDatabase(SQL_FILE).then(client => {
    return populateDatabase(client, DATA_FILE).then(() => {
        client.end();
    }).catch(err => {
        client.end();

        throw err;
    });
}).catch(err => console.error(err.stack));

async function initializeDatabase(sqlFile) {
    const rootClient = new Client({
        database: "postgres"
    });

    // Create (or drop) the database first
    await rootClient.connect();
    await rootClient.query("DROP DATABASE IF EXISTS mma");
    await rootClient.query("CREATE DATABASE mma");
    await rootClient.end();

    const client = new Client({
        database: "mma"
    });

    await client.connect();

    const sql = await readFile(sqlFile);
    const statements = sql.toString().split(";");

    for(let i = 0; i < statements.length; i++) {
        const statement = statements[i];

        console.log(statement.split("\n").map(s => `> ${s}`).join("\n"));
        await client.query(statement);
    }

    return client;
}

async function populateDatabase(client, filepath) {
    const data = await csvRead(filepath, { columns: true });

    const promotionResult = await client.query(
        "INSERT INTO promotions(name, nickname) VALUES('Ultimate Fighting Championship', 'UFC') RETURNING id, name, nickname"
    );

    const ufc = promotionResult.rows[0];

    const events = await mapSeries(map(groupBy(data, property("eid")), ([ event ]) => {
        const [month, date, year] = event.event_date.split("/");

        return {
            name: event.event_name,
            location: event.event_place,
            date: new Date(year, month - 1, date),
            sherdog_id: parseInt(event.eid),
            sherdog_url: event.pageurl,
            promotion: ufc.id
        };
    }), async event => {
        const result = await client.query(
            "INSERT INTO events(name, location, dateof, sherdog_id, sherdog_url) VALUES($1, $2, $3, $4, $5) RETURNING id",
            [event.name, event.location, event.date, event.sherdog_id, event.sherdog_url]
        );

        return Object.assign(event, {
            id: result.rows[0].id
        });
    });

    const fighters = await mapSeries(map(data.reduce((fighters, fight) => {
        if(!fighters[fight.f1fid]) {
            fighters[fight.f1fid] = pickFighter(1, fight);
        }

        if(!fighters[fight.f2fid]) {
            fighters[fight.f2fid] = pickFighter(2, fight);
        }

        return fighters;
    }, {}), fighter => fighter), async fighter => {
        const result = await client.query(
            "INSERT INTO fighters(name, sherdog_id, sherdog_url) VALUES($1, $2, $3) RETURNING id",
            [fighter.name, fighter.sherdog_id, fighter.sherdog_url]
        );

        return Object.assign(fighter, {
            id: result.rows[0].id
        });
    });

    await mapSeries(data, async rawFight => {
        const event = events.find(event => event.sherdog_id === parseInt(rawFight.eid));

        const fightTime = rawFight.time === "N/A" ? null :
            rawFight.time.length === 5 ? `00:${rawFight.time}` :
            rawFight.time;

        let fight = {
            event,
            card_index: parseInt(rawFight.mid),
            method: rawFight.method || null,
            method_detail: rawFight.method_d || null,
            round: parseInt(rawFight.round) || null,
            round_time: fightTime,
            referee: rawFight.ref === "N/A" ? null : rawFight.ref
        };

        const result = await client.query(
            "INSERT INTO fights(event, card_index, method, method_detail, round, round_time, referee) VALUES($1, $2, $3, $4, $5, $6, $7) RETURNING id",
            [fight.event.id, fight.card_index, fight.method, fight.method_detail, fight.round, fight.round_time, fight.referee]
        );

        fight = Object.assign(fight, {
            id: result.rows[0].id
        });

        await mapSeries([1, 2], async idx => {
            const fid = parseInt(rawFight[`f${idx}fid`]);
            const fighter = fighters.find(fighter => fighter.sherdog_id === fid);

            await client.query(
                "INSERT INTO fight_fighters(fight, fighter, result) VALUES($1, $2, $3)",
                [fight.id, fighter.id, rawFight[`f${idx}result`]]
            );
        });
    });
}

function pickFighter(idx, fight) {
    return {
        name: fight[`f${idx}name`],
        sherdog_id: parseInt(fight[`f${idx}fid`]),
        sherdog_url: fight[`f${idx}pageurl`]
    };
}