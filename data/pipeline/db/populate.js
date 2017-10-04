const path = require("path");
const { exec } = require("child_process");
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
const FIGHTS_FILE = path.resolve(__dirname, "../../fights.csv");
const FIGHTERS_FILE = path.resolve(__dirname, "../../fighters.csv");
const DB_SERVER = {
    host: "localhost",
    port: 5433,
    user: "postgres"
};

main().catch(err => console.error(err.stack));

async function main() {
    if(!process.argv.includes("--no-init")) {
        console.log(await initialize(SQL_FILE));
    }

    if(!process.argv.includes("--no-data")) {
        const client = new Client({
            ...DB_SERVER,
            database: "mma"
        });

        await client.connect();

        try {
            await populateFights(client, FIGHTS_FILE)
            await populateFighters(client, FIGHTERS_FILE);
        } catch(err) {
            console.error(err);
        }

        client.end();
    }
}

async function initialize(sqlFile) {
    const rootClient = new Client({
        ...DB_SERVER,
        database: "postgres"
    });

    // Create (or drop) the database first
    await rootClient.connect();
    await rootClient.query("DROP DATABASE IF EXISTS mma");
    await rootClient.query("CREATE DATABASE mma");
    await rootClient.end();

    return await initializeDatabase(sqlFile, {
        ...DB_SERVER,
        database: "mma"
    });
}

async function initializeDatabase(sqlFile, options = {}) {
    const aliases = {
        database: "d",
        user: "U",
        host: "h",
        port: "p"
    };

    const cliOpts = Object.entries(options).map(([ alias, value ]) => `-${aliases[alias]} ${value}`).join(" ");

    return new Promise((resolve, reject) => {
        exec(`psql ${cliOpts} -f ${sqlFile}`, (err, stdout, stderr) => {
            if(err) {
                return reject(Object.assign(err, { stdout, stderr }));
            }

            if(stderr.length) {
                console.warn(stderr);
            }

            return resolve(stdout);
        });
    });
}

async function populateFights(client, filepath) {
    const data = await csvRead(filepath, { columns: true });

    const promotionResult = await client.query(
        "INSERT INTO mma.promotion(name, nickname) VALUES('Ultimate Fighting Championship', 'UFC') RETURNING id, name, nickname"
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
            "INSERT INTO mma.event(name, location, dateof, sherdog_id, sherdog_url) VALUES($1, $2, $3, $4, $5) RETURNING id",
            [event.name, event.location, event.date, event.sherdog_id, event.sherdog_url]
        ).catch(err => {
            console.error(`Error creating event: `, event);

            throw err;
        });

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
            "INSERT INTO mma.fighter(name, sherdog_id, sherdog_url) VALUES($1, $2, $3) RETURNING id",
            [fighter.name, fighter.sherdog_id, fighter.sherdog_url]
        ).catch(err => {
            console.error(`Error creating fighter: `, fighter);

            throw err;
        });

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
            "INSERT INTO mma.fight(event, card_index, method, method_detail, round, round_time, referee) VALUES($1, $2, $3, $4, $5, $6, $7) RETURNING id",
            [fight.event.id, fight.card_index, fight.method, fight.method_detail, fight.round, fight.round_time, fight.referee]
        ).catch(err => {
            console.error(`Error creating fight: `, fight);

            throw err;
        });

        fight = Object.assign(fight, {
            id: result.rows[0].id
        });

        await mapSeries([1, 2], async idx => {
            const fid = parseInt(rawFight[`f${idx}fid`]);
            const fighter = fighters.find(fighter => fighter.sherdog_id === fid);

            await client.query(
                "INSERT INTO mma.fight_fighters(fight, fighter, result) VALUES($1, $2, $3)",
                [fight.id, fighter.id, rawFight[`f${idx}result`]]
            ).catch(err => {
                console.error(`Error creating fight-to-fighter relationship: `, fighter, fight);

                throw err;
            });
        });
    });
}

async function populateFighters(client, filepath) {
    const fighters = await csvRead(filepath, { columns: true });

    for(let fighter of fighters) {
        const [_, y, m, d] = fighter.dob.match(/(\d+)-(\d+)-(\d+)/) || [];

        await client.query(
            `UPDATE mma.fighter SET
                dob = $1,
                nationality = $2,
                address = $3,
                association = $4,
                class = $5,
                height = $6,
                weight = $7
            WHERE
                sherdog_id = $8`,
            [
                d && m && y ? `${d}/${m}/${y}` : null,
                fighter.nationality || null,
                fighter.address || null,
                fighter.association || null,
                fighter["class"] && fighter["class"] !== "N/A" ? fighter["class"] : null,
                fighter.height || null,
                fighter.weight || null,
                fighter.id
            ]
        ).catch(err => {
            console.error(`Error updating fighter: `, fighter);

            throw err;
        });
    }
}

function pickFighter(idx, fight) {
    return {
        name: fight[`f${idx}name`],
        sherdog_id: parseInt(fight[`f${idx}fid`]),
        sherdog_url: fight[`f${idx}pageurl`]
    };
}