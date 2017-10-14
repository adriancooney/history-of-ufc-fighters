const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const cheerio = require("cheerio");
const {
    csvRead, csvWrite
} = require("../util");
const {
    flatten,
    uniqBy,
    differenceBy,
    property
} = require("lodash");

const SHERDOG_URL = "http://www.sherdog.com"
const DATA_DIR = path.resolve(__dirname, "../../");
const OUTPUT_FILE = path.join(DATA_DIR, "fighters.csv");

main().catch(err => console.error(err));

let interrupted = false;
process.on("SIGINT", () => interrupted = true);

async function main() {
    // Read what we already got
    const existingFighters = await csvRead(OUTPUT_FILE);
    const bareFighters = await getAllFightersFromFights();
    const fighters = differenceBy(bareFighters, existingFighters, property("id"));

    const downloadedFighters = [];
    for(let fighter of fighters) {
        if(interrupted) {
            break;
        }

        console.log(`> ${fighter.url}`);

        downloadedFighters.push(await getFighterByURL(fighter));
    }

    console.log(`writing fighters to ${OUTPUT_FILE}`);
    return csvWrite(OUTPUT_FILE, uniqBy(existingFighters.concat(downloadedFighters), property("id")), {
        header: true
    });
}

function getFighterByURL({ id, url, name }) {
    return fetch(`${SHERDOG_URL}${url}`).then(res => {
        return res.text();
    }).then(html => {
        const fighter = cheerio.load(html);
        const bio = fighter(".bio_fighter");

        const [a, height] = (bio.find(".height").text() || "").match(/(\d+\.\d+)\s+cm\s+$/i) || [];
        const [b, weight] = (bio.find(".weight").text() || "").match(/(\d+\.\d+)\s+kg\s+$/i) || [];

        return {
            id, url, name,
            nickname: bio.find(".nickname em").text() || null,
            dob: bio.find("span[itemprop='birthDate']").text() || null,
            nationality: bio.find("strong[itemprop='nationality']").text() || null,
            address: bio.find("span[itemprop='address']").text() || null,
            association: bio.find("a.association").text() || null,
            "class": bio.find(".title").text() || null,
            height: parseFloat(height) || null,
            weight: parseFloat(weight) || null
        };
    })
}

async function getAllFightersFromFights() {
    const promotions = await csvRead(path.join(DATA_DIR, `promotions.csv`), {
        columns: true
    });

    let fighters = [];

    for(let promotion of promotions) {
        console.log(promotion.slug);
        const fights = await csvRead(path.join(DATA_DIR, `fights/fights-${promotion.slug}.csv`));

        fighters = fighters.concat(
            flatten(
                fights.map(({ f1fid, f1pageurl, f2fid, f2pageurl, f1name, f2name }) => ([
                    { id: parseInt(f1fid), url: f1pageurl, name: f1name },
                    { id: parseInt(f2fid), url: f2pageurl, name: f2name }
                ]))
            )
        );
    }

    return uniqBy(fighters, property("id"));
}