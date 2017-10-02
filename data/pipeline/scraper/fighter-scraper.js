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
const FIGHTS_FILE = path.resolve(__dirname, "../../fights.csv");
const OUTPUT_FILE = path.resolve(__dirname, "../../fighters.csv");

// Read what we already got
csvRead(OUTPUT_FILE, {
    columns: true,
    auto_parse: true
}).catch(err => {
    if(err.code === "ENOENT") {
        return [];
    }

    throw err;
}).then(async existingFighters => {
    const fights = await csvRead(FIGHTS_FILE, { columns: true });
    const fighters = differenceBy(uniqBy(flatten(fights.map(({ f1fid, f1pageurl, f2fid, f2pageurl }) => ([
        { id: parseInt(f1fid), url: f1pageurl },
        { id: parseInt(f2fid), url: f2pageurl }
    ]))), property("id")), existingFighters, property("id"));

    const downloadedFighters = [];
    for(let i = 0; i < fighters.length; i++) {
        console.log(`> ${fighters[i].url}`);
        downloadedFighters.push(await getFighterByURL(fighters[i]));

        await new Promise(resolve => setTimeout(resolve, 500));
    }

    return csvWrite(OUTPUT_FILE, existingFighters.concat(downloadedFighters), {
        header: true
    });
}).catch(err => {
    console.log(err);
});

function getFighterByURL({ id, url }) {
    return fetch(`${SHERDOG_URL}${url}`).then(res => {
        return res.text();
    }).then(html => {
        const fighter = cheerio.load(html);
        const bio = fighter(".bio_fighter");

        const [a, height] = (bio.find(".height").text() || "").match(/(\d+\.\d+)\s+cm\s+$/i) || [];
        const [b, weight] = (bio.find(".weight").text() || "").match(/(\d+\.\d+)\s+kg\s+$/i) || [];

        return {
            id, url,
            nickname: bio.find(".nickname").text() || null,
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