const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const cheerio = require("cheerio");
const {
    csvRead, csvWrite
} = require("../util");

const SHERDOG_URL = "http://www.sherdog.com"
const OUTPUT_FILE = path.resolve(__dirname, "../data/fighters.csv");

// Read what we already got
csvRead(OUTPUT_FILE, {
    columns: true,
    auto_parse: true
}).catch(err => {
    console.log(err);
});