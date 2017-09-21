const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const cheerio = require("cheerio");
const csv = require("csv");
const {
    sortBy,
    property,
    last
} = require("lodash");

const SHERDOG_URL = "http://www.sherdog.com"

// Read what we already got
csvParse(path.resolve(__dirname, "../data/fights.csv"), {
    columns: true,
    auto_parse: true
}).then(data => {
    return sortBy(data.map(record => ({
        ...record,
        event_date: new Date(record.event_date)
    })), property("event_date"));
}).then(async data => {
    // This is the latest fight
    const latestFight = last(data);

    let page = 1;
    let events = [];

    while(!events.some(({ event_date }) => event_date <= latestFight.event_date)) {
        events = events.concat(await getRecentEventsByPage(page++));
    }

    // Only pick events after the latestFight
    events = events.filter(({ event_date }) => event_date >= latestFight.event_date);

    let allFights = [];

    for(let i = 0; i < events.length; i++) {
        const event = events[i];
        const fights = await getFightsForEvent(event.pageurl);

        allFights = allFights.concat(fights.map(fight => Object.assign(fight, event)));
    }

    return csvFormat(data.concat(allFights), {
        columns: "pageurl,eid,mid,event_name,event_org,event_date,event_place,f1pageurl,f2pageurl,f1name,f2name,f1result,f2result,f1fid,f2fid,method,method_d,ref,round,time".split(","),
        header: true,
        formatters: {
            date: formatDate
        }
    });
}).then(fights => {
    fs.writeFileSync(path.resolve(__dirname, "../data/fights.csv"), fights);
});

function getRecentEventsByPage(page) {
    const url = `${SHERDOG_URL}/organizations/Ultimate-Fighting-Championship-2/recent-events/${page}`;
    console.log(`> GET ${url}`);

    return fetch(url).then(res => {
        return res.text();
    }).then(html => {
        const index = cheerio.load(html);
        const event_org = index("h2[itemprop='name']").text();

        return index("#recent_tab").find("tr:not(.table_head)").map((i, el) => {
            const row = index(el);
            const pageurl = row.find("a[itemprop='url']").attr("href");
            const [a, eid] = pageurl.match(/\-(\d+)$/);
            const [b, date] = row.find("meta[itemprop='startDate']").attr("content").match(/^(.+)-\d\d:\d\d$/);

            return {
                pageurl,
                event_org,
                eid: parseInt(eid),
                event_date: new Date(date),
                event_name: row.find("span[itemprop='name']").text(),
                event_place: row.find("td[itemprop='location']").text().trim()
            };
        }).get();
    });
}

function getFightsForEvent(event) {
    const url = `${SHERDOG_URL}${event}`;
    console.log(`> ${url}`);

    return fetch(url).then(res => {
        return res.text();
    }).then(html => {
        const fight = cheerio.load(html);

        // Get the main event
        const mainEvent = fight(".fight_card");
        const f1 = mainEvent.find(".left_side");
        const f2 = mainEvent.find(".right_side");
        const f1pageurl = f1.find("a[itemprop='url']").attr("href");
        const f2pageurl = f2.find("a[itemprop='url']").attr("href");
        const [a, f1fid] = f1pageurl.match(/-(\d+)$/);
        const [b, f2fid] = f2pageurl.match(/-(\d+)$/);
        const mainEventFooter = mainEvent.find(".footer tr td");
        const [c, method, method_d] = mainEventFooter.eq(1).text().match(/^\s*(.+)\((.+)\)\s*$/);
        const mid = mainEventFooter.eq(0).text().replace(/Match/, "").trim()

        const mainEventData = {
            f1pageurl,
            f1fid: parseInt(f1fid),
            f1name: f1.find("span[itemprop='name']").text(),
            f1result: f1.find(".final_result").text(),
            f2pageurl,
            f2fid: parseInt(f2fid),
            f2name: f2.find("span[itemprop='name']").text(),
            f2result: f2.find(".final_result").text(),
            mid: parseInt(mid),
            method: method.trim(),
            method_d: method_d.trim(),
            ref: mainEventFooter.eq(2).text().trim(),
            round: parseInt(mainEventFooter.eq(3).text().replace(/Round/, "")),
            time: mainEventFooter.eq(4).text().replace(/Time/, "").trim()
        };

        const matches = fight(".event_match tr:not(.table_head)").map((i, el) => {
            const row = fight(el);
            const columns = row.find("td");

            const f1 = row.find(".text_right");
            const f2 = row.find(".text_left");
            const f1pageurl = f1.find("a[itemprop='url']").attr("href");
            const [a, f1fid] = f1pageurl.match(/-(\d+)$/);
            const f2pageurl = f2.find("a[itemprop='url']").attr("href");
            const [b, f2fid] = f2pageurl.match(/-(\d+)$/);

            const c4 = columns.eq(4);
            const ref = c4.find(".sub_line").text().trim();
            const [c, method, method_d] = c4.text().replace(ref, "").trim().match(/^\s*(.+)\((.+)\)\s*$/);

            return {
                mid: parseInt(columns.eq(0).text().trim()),
                f1fid: parseInt(f1fid),
                f1pageurl,
                f1name: f1.find("span[itemprop='name']").text(),
                f1result: f1.find(".final_result").text().trim(),
                f2fid: parseInt(f2fid),
                f2name: f2.find("span[itemprop='name']").text(),
                f2pageurl,
                f2result: f2.find(".final_result").text().trim(),
                ref,
                method: method.trim(),
                method_d: method_d.trim(),
                round: parseInt(columns.eq(5).text()),
                time: columns.eq(6).text().trim()
            };
        }).get();

        return [mainEventData, ...matches];
    });
}

function csvParse(file, options) {
    return new Promise((resolve, reject) => {
        csv.parse(fs.readFileSync(file), options, (err, data) => {
            if(err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

function csvFormat(data, options) {
    return new Promise((resolve, reject) => {
        csv.stringify(data, options, (err, output) => {
            if(err) {
                reject(err);
            } else {
                resolve(output);
            }
        });
    });
}

function formatDate(date) {
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}