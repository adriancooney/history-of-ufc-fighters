const initialSelected = [
    "Conor McGregor",
    "Ronda Rousey",
    "Nate Diaz",
    "Max Holloway",
    "Jon Jones",
    "Chuck Liddell",
    "Chris Weidman",
    "Anderson Silva",
    "Robbie Lawler",
    "Michael Bisping",
    "Vitor Belfort",
    "Jose Aldo",
    "Royce Gracie",
    "Chris Lytle",
    "Holly Holm",
    "Tito Ortiz",
    "Donald Cerrone",
    "Georges St. Pierre",
    "Frankie Edgar",
    "Chad Mendes"
];

const fittedFightLocal = d3.local();
const columns = 6;
const width = 960;
const height = 500;
const padding = {
    t: 50, r: 20, b: 20, l: 50
};

function main() {
    d3.csv("data/fights.csv", drawFights);
}

function drawFights(rawData) {
    let { domain, fighters, events } = transformFightData(rawData);

    const svg = d3.select(".svg-container")
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`);

    const tableContainer = d3.select(".fighter-list");

    const selected = initialSelected.map(fighter => fighters.find(({ name }) => name === fighter));
    const updateChart = drawChart.bind(null, svg, domain, events, fighters);
    const updateTable = drawTable.bind(null, tableContainer, domain, events, fighters);

    const chartOptions = {
        onInspectFight(state, fight) {
            updateChart(chartOptions, Object.assign({}, state, {
                inspectedFights: _.uniqBy(state.inspectedFights.concat(fight), _.property("id"))
            }));

            drawFight(fight);
        },

        onUninspectFight(state, fight) {
            updateChart(chartOptions, Object.assign({}, state, {
                inspectedFights: state.inspectedFights.filter(({ id }) => fight.id !== id)
            }));

            drawFight(state.selectedFights.length ? state.selectedFights[0] : undefined);
        },

        onSelectFight(state, fight) {
            updateChart(chartOptions, Object.assign({}, state, {
                selectedFights: _.uniqBy(state.inspectedFights.concat(fight), _.property("id"))
            }));

            drawFight(fight);
        },

        onDeselectAllFights(state, fight) {
            updateChart(chartOptions, Object.assign({}, state, {
                selectedFights: []
            }));

            drawFight();
        }
    };

    const tableOptions = {
        onSelectFighter(state, fighter) {
            const selectedFighters = _.uniqBy(state.selectedFighters.concat(fighter), _.property("id"));

            updateChart(chartOptions, {
                selectedFighters,
                inspectedFights: [],
                selectedFights: []
            });

            updateTable(tableOptions, Object.assign({}, state, { selectedFighters }));
        },

        onDeselectFighter(state, fighter) {
            const selectedFighters = state.selectedFighters.filter(({ id }) => fighter.id !== id);

            updateChart(chartOptions, {
                selectedFighters,
                inspectedFights: [],
                selectedFights: []
            });

            updateTable(tableOptions, Object.assign({}, state, { selectedFighters }));
        },

        onReset(state) {
            updateTable(tableOptions, Object.assign({}, state, {
                winCount: 0,
                lossCount: 0,
                totalCount: 1,
                filter: null
            }));
        },

        onDeselectAll(state) {
            updateChart(chartOptions, {
                selectedFighters: [],
                inspectedFights: [],
                selectedFights: []
            });

            updateTable(tableOptions, Object.assign({}, state, { selectedFighters: [] }));
        },

        onChangeFilter(state, value) {
            updateTable(tableOptions, Object.assign({}, state, {
                winCount: 0,
                lossCount: 0,
                totalCount: 1,
                filter: value ? new RegExp(value, "i") : null
            }));
        },

        onChangeFightCount(state, value) {
            updateTable(tableOptions, Object.assign({}, state, {
                totalCount: Math.max(Math.max(value, state.winCount), state.lossCount)
            }));
        },

        onChangeWinCount(state, value) {
            updateTable(tableOptions, Object.assign({}, state, {
                winCount: value,
                totalCount: Math.max(state.totalCount, value)
            }));
        },

        onChangeLossCount(state, value) {
            updateTable(tableOptions, Object.assign({}, state, {
                lossCount: value,
                totalCount: Math.max(state.totalCount, value)
            }));
        }
    };

    updateChart(chartOptions, {
        selectedFighters: selected,
        inspectedFights: [],
        selectedFights: []
    });

    updateTable(tableOptions, {
        winCount: 1,
        lossCount: 0,
        totalCount: 5,
        selectedFighters: selected,
        filter: null
    });

    drawFight();
}

function drawChart(svg, domain, events, fighters, options, state) {
    const netWinsScale = d3.scaleLinear()
        .domain([ domain.upper, domain.lower ])
        .range([ 0, height - (padding.t + padding.b) ]);

    const timeTicks = d3.scaleTime()
        .domain([ domain.minDate, domain.maxDate ]);

    const timeScale = d3.scalePow()
        .exponent(4)
        .domain([ domain.minDate.valueOf(), domain.maxDate.valueOf() ])
        .range([ 0, width - (padding.l + padding.r) ]);

    const selectedFighterColorScale = d3.scaleOrdinal(d3.schemeCategory20)
        .domain(fighters.map(({ name }) => name));

    const fightLine = d3.line()
        .x(d => timeScale(d.date))
        .y(d => netWinsScale(d.line))
        .curve(d3.curveMonotoneX);

    if(svg.select("#fighter-lines").empty()) {
        svg.append("text")
            .text("Net Wins")
            .attr("text-anchor", "middle")
            .attr("transform", `translate(${padding.l / 2}, ${height / 2}), rotate(-90)`)
            .style("color", "#000");

        svg.append("g")
            .attr("id", "fighter-lines")
            .attr("transform", `translate(${padding.t}, ${padding.l})`);

        const netWinsAxis = d3.axisLeft(netWinsScale);

        svg.append("g")
            .attr("id", "net-wins-axis")
            .attr("transform", `translate(${padding.t}, ${padding.l})`)
            .call(netWinsAxis);

        const timeAxis = d3.axisBottom(timeScale)
            .tickFormat(tick => tick ? typeof tick === "string" ? tick : tick.getFullYear() : undefined)
            .tickValues(_.drop(timeTicks.ticks(14), 1).concat(domain.maxDate));

        svg.append("g")
            .attr("transform", `translate(${padding.l}, ${padding.t + netWinsScale(0)})`)
            .call(timeAxis);

        svg.append("g")
            .attr("id", "labels");
    }

    svg.on("click", function() {
        if(d3.select(d3.event.target).attr("class") !== "fighter-disc") {
            return options.onDeselectAllFights(state);
        }
    });

    const activeFights = state.selectedFights.concat(state.inspectedFights);
    const activeFighters = fighters.map(fighter => {
        // Check to see if this fight is a participant of a highlighted fight
        const selectedFight = activeFights.find(({ id }) => fighter.fights.find(fight => fight.id === id));

        if(selectedFight) {
            return Object.assign({ selectedFight }, fighter);
        }

        if(state.selectedFighters.find(({ id }) => fighter.id === id)) {
            return fighter;
        }
    }).filter(a => a);

    const fighterGroup = svg.select("#fighter-lines")
        .selectAll("g")
        .data(activeFighters, _.property("id"));

    const newFighter = fighterGroup.enter().append("g");

    newFighter.attr("id", ({ name }) => name)
        .append("path")
        .style("fill", "none")
        .style("stroke", ({ name }) => selectedFighterColorScale(name))
        .style("stroke-width", 2)
        .attr("d", fighter => fightLine([{
            date: new Date(fighter.fights[0].date - (1000 * 60 * 60 * 24 * 7 * 4 * 3)),
            line: 0
        }].concat(fighter.fights)))

    newFighter.selectAll("circle")
        .data(({ fights }) => fights, _.property("id"))
            .enter()
            .append("circle")
            .attr("class", "fighter-disc")
            .attr("cx", fight => timeScale(fight.date.valueOf()))
            .attr("cy", fight => netWinsScale(fight.line))
            .each(function(fight) {
                const fighter = d3.select(this.parentNode).datum();
                const circle = d3.select(this).style("fill", selectedFighterColorScale(fighter.name));
            });

    fighterGroup.merge(newFighter)
        .style("opacity", fighter => activeFights.length ? fighter.selectedFight ? 1 : 0.1 : 1)
        .selectAll("circle")
        .on("mouseover", options.onInspectFight.bind(null, state))
        .on("click", options.onSelectFight.bind(null, state))
        .on("mouseout", options.onUninspectFight.bind(null, state))
        .data(({ selectedFight, fights }) => {
            if(selectedFight) {
                return fights.map(fight => fight.id === selectedFight.id ? Object.assign({ highlighted: true }, fight) : fight);
            } else {
                return fights;
            }
        }, _.property("id"))
        .attr("r", ({ highlighted }) => highlighted ? 5 : 3)
        .style("stroke-width", ({ highlighted }) => highlighted ? "2px" : 0)
        .style("stroke", function(fight) {
            if(fight.highlighted) {
                const fighter = d3.select(this.parentNode).datum();
                const result = getFighterResult(fighter, fight);

                return result === "draw" ? "slategray" : result === "win" ? "lime" : "crimson";
            } else {
                return "none";
            }
        });

    fighterGroup.exit().remove();

    const label = svg.select("#labels")
        .selectAll("g")
        .data(activeFighters, _.property("id"));

    const newLabel = label.enter()
        .append("g")
        .attr("class", "fighter-label")
        .attr("id", ({ name }) => name);

    newLabel.append("rect")
        .style("fill", ({ name }) => selectedFighterColorScale(name));

    const fittedFights = label.nodes().map(node => fittedFightLocal.get(node));

    newLabel.append("text")
        .attr("text-anchor", "right")
        .attr("alignment-baseline", "hanging")
        .text(({ name }) => name)

    newLabel.each(function({ name, fights }) {
        const bbox = this.getBBox();
        const p = 3, m = 5;
        const w = bbox.width + p * 2;
        const h = bbox.height + p * 2;
        const getBox = fight => ({
            x: Math.max(0, Math.min(width - padding.r - w, padding.l + timeScale(fight.date) - w / 2)),
            y: padding.t + netWinsScale(fight.line) - h / 2,
            w, h
        });

        let { fight, box } = _.shuffle(fights).reduce((result, fight) => {
            if(result) {
                return result;
            }

            const box = getBox(fight);

            if(!fittedFights.some(fitted => intersect(fitted.box, box))) {
                return { fight, box };
            }
        }, null) || {};

        if(!fight) {
            fight = fights[0];
            box = getBox(fight);
        }

        const fit = { fight, box };

        fittedFights.push(fit);
        fittedFightLocal.set(this, fit);

        const group = d3.select(this)
            .attr("transform", `translate(${box.x}, ${box.y + m + h / 2})`);

        group.select("text")
            .attr("transform", `translate(${p}, ${p + 2})`)

        group.select("rect")
            .attr("width", w)
            .attr("height", h);
    });

    label.merge(newLabel).style("opacity", fighter => activeFights.length ? fighter.selectedFight ? undefined : 0.1 : undefined);
    label.exit().remove();

    const eventGroup = svg.selectAll(".event-label")
        .data(activeFights, _.property("id"));

    const newEventGroup = eventGroup.enter()
        .append("g")
        .attr("class", "event-label");

    newEventGroup.append("line")
        .attr("x1", ({ date }) => padding.l + timeScale(date))
        .attr("x2", ({ date }) => padding.l + timeScale(date))
        .attr("y1", padding.t)
        .attr("y2", height - padding.b)
        .attr("stroke", "#aaa")
        .attr("stroke-width", 1)
        .style("pointer-events", "none")

    const newEventLabelGroup = newEventGroup.append("g");

    newEventLabelGroup.append("rect");
    newEventLabelGroup.append("text")
        .style("font-size", "90%")
        .attr("text-anchor", "right")
        .attr("transform", "translate(3, 0)")
        .text(d => d.event_name)
        .each(function(fight) {
            const group = d3.select(this.parentNode);

            const rect = group.select("rect")
            const bbox = this.getBBox();

            group.attr("transform", fight => `translate(${Math.min(width - padding.r - bbox.width - 6, timeScale(fight.date) + padding.l)}, ${height - padding.b - 5})`);

            rect.attr("transform", `translate(0, -${bbox.height/2 + 8})`)
                .attr("width", bbox.width + 6)
                .attr("height", bbox.height + 6)
                .style("fill", "#aaa");
        });

    eventGroup.exit().remove();
}

function drawTable(container, domain, events, fighters, options, state) {
    const filteredFighters = fighters.filter(fighter => {
        if(fighter.fights.length < state.totalCount) {
            return false;
        }

        if(fighter.wins < state.winCount) {
            return false;
        }

        if(fighter.losses < state.lossCount) {
            return false;
        }

        if(state.filter && !fighter.name.match(state.filter)) {
            return false;
        }

        return true;
    });

    const activeFighters = _.sortBy(filteredFighters, _.property("name")).map(fighter => {
        return state.selectedFighters.find(({ id }) => fighter.id === id) ? Object.assign({ selected: true }, fighter) : fighter;
    });

    const columnHeight = Math.max(10, Math.floor(activeFighters.length/columns));
    const split = Array(columns).fill(0).map((_, i) => activeFighters.slice(i * columnHeight, (i + 1) * columnHeight));

    d3.select("#deselect-all")
        .on("click", options.onDeselectAll.bind(null, state));

    d3.select("#filter-input")
        .attr("value", state.filter || "")
        .on("input", function() {
            return options.onChangeFilter(state, d3.select(this).property("value"));
        });

    d3.select("#hidden-fighters")
        .text(`(${fighters.length - filteredFighters.length} hidden)`);

    d3.select("#reset")
        .on("click", options.onReset.bind(null, state));

    [
        ["total", domain.maxFightCount - 1, state.totalCount, options.onChangeFightCount],
        ["win", domain.maxWinCount - 1, state.winCount, options.onChangeWinCount],
        ["loss", domain.maxLossCount - 1, state.lossCount, options.onChangeLossCount]
    ].forEach(([ id, max, value, handler ]) => {
        d3.select(`#fight-count-${id}`)
            .attr("max", max)
            .property("value", value)
            .on("change", function() {
                return handler.call(this, state, parseInt(d3.select(this).property("value")));
            });
    });

    const table = container.selectAll("table").data(split)

    const enterTable = table.enter()
        .append("table")
        .style("flex", 1)
        .style("display", "block")

    const row = table.merge(enterTable)
        .selectAll("tr:not(.header)")
        .data(fighters => fighters, _.property("id"))

    const enterRow = row.enter().append("tr");

    enterRow.append("td")
        .append("input")
        .attr("id", ({ id }) => `selected-${id}`)
        .attr("type", "checkbox");

    enterRow.append("td")
        .append("label")
        .attr("for", ({ id }) => `selected-${id}`)
        .text(({ name }) => name);

    row.merge(enterRow)
        .select("input")
        .property("checked", ({ selected }) => selected === true)
        .on("change", function(fighter) {
            return this.checked ? options.onSelectFighter(state, fighter) : options.onDeselectFighter(state, fighter);
        });

    row.exit().remove();
}

function drawFight(fight = {}) {
    d3.select("#fight-f1-name")
        .attr("href", formatSherdogURL(fight.f1pageurl))
        .text(fight.f1name);

    d3.select("#fight-f2-name")
        .attr("href", formatSherdogURL(fight.f2pageurl))
        .text(fight.f2name);

    d3.select("#fight-detail-event")
        .attr("href", formatSherdogURL(fight.pageurl))
        .text(fight.event_name || "-");

    d3.select(".fighter.f1")
        .classed("win", fight.f1result === "win")
        .classed("loss", fight.f1result === "loss");

    d3.select(".fighter.f2")
        .classed("win", fight.f2result === "win")
        .classed("loss", fight.f2result === "loss")

    d3.select("#fight-detail-submission").text(fight.method || "-");
    d3.select("#fight-detail-move").text(fight.method_d || "-");
    d3.select("#fight-detail-ref").text(fight.ref || "-");
    d3.select("#fight-detail-round").text(fight.round || "-");
    d3.select("#fight-detail-time").text(fight.time || "-");
    d3.select("#fight-detail-date").text(fight.event_date || "-");
    d3.select("#fight-detail-location").text(fight.event_place || "-");
}

function transformFightData(data) {
    const domain = {
        upper: 0,
        lower: 0,
        width: 0,
        minSlope: 0,
        maxSlope: 0,
        minDate: new Date(),
        maxDate: new Date("1/12/2016"),
        maxFightCount: 0,
        maxWinCount: 0,
        maxLossCount: 0
    };

    let events = _.groupBy(data, fight => fight.eid);

    // Add the fight weight
    let fighters = data.map(fight => {
        fight = Object.assign({}, fight, {
            weight: fight.mid / events[fight.eid].length,
            date: new Date(fight.event_date)
        });

        domain.minDate = fight.date < domain.minDate ? fight.date : domain.minDate;
        domain.maxDate = fight.date > domain.maxDate ? fight.date : domain.maxDate;

        return fight;
    });

    // Take in fighter data and convert it to a map of fighter: fights
    fighters = fighters.reduce((fighters, fight) => {
        if(!fighters[fight.f1name]) fighters[fight.f1name] = [];
        if(!fighters[fight.f2name]) fighters[fight.f2name] = [];

        fighters[fight.f1name].push(fight);
        fighters[fight.f2name].push(fight);

        return fighters;
    }, {});

    // Transform the fights
    fighters = _.toPairs(fighters).map(([fighter, fights]) => {
        fights = _.sortBy(fights, _.property("date"));
        const results = fights.map(fight => transformResult(fight[`${fighterIndex(fight, fighter)}result`]));
        const wins = results.filter(result => result === 1).length;
        const losses = results.filter(result => result === -1).length;

        const line = [0].concat(results.map((result, i) => _.sum(results.slice(0, i + 1))));
        const weights = fights.map(fight => fight.weight);
        const slope = line[line.length - 1] / (line.length - 1);
        const max = _.max(line);
        const min = _.min(line);
        const fi = fights[0].f1name === fighter ? 1 : 2;

        domain.width = Math.max(domain.width, fights.length);
        domain.upper = Math.max(domain.upper, max);
        domain.lower = Math.min(domain.lower, min);
        domain.minSlope = Math.min(domain.minSlope, slope);
        domain.maxSlope = Math.max(domain.maxSlope, slope);
        domain.maxFightCount = Math.max(domain.maxFightCount, fights.length);
        domain.maxWinCount = Math.max(domain.maxWinCount, wins);
        domain.maxLossCount = Math.max(domain.maxLossCount, losses);

        return {
            fights: fights.map((fight, i) => Object.assign({
                id: fightId(fight),
                result: results[i],
                line: line[i + 1],
                weight: weights[i],
                date: fights[i].date
            }, fight)),
            name: fighter,
            id: fights[0][`f${fi}fid`],
            slope,
            max,
            min,
            wins,
            losses
        };
    });

    events = _.toPairs(events).map(([ event, fights ]) => {
        return {
            name: fights[0].event_name,
            org: fights[0].event_org,
            date: new Date(fights[0].event_date),
            place: fights[0].event_place,
            id: fights[0].eid
        }
    });

    return { domain, fighters, events };
}

function formatSherdogURL(path) {
    return `http://sherdog.com${path}`;
}

function fightId(fight) {
    return fight.eid + fight.f1fid + fight.f2fid;
}

function fighterIndex(fight, fighter) {
    return `f${fight.f1name === fighter ? 1 : 2}`;
}

function transformResult(result) {
    return result === "win" ? 1 : result === "loss" ? -1 : 0;
}

function intersect(box1, box2) {
    return Math.abs(box1.x - box2.x) < box1.w && Math.abs(box1.y - box2.y) < box1.h;
}

function getFighterResult(fighter, fight) {
    return fight.f1result === "draw" ? "draw" : fighter.name === (fight.f1result === "win" ? fight.f1name : fight.f2name) ? "win" : "loss";
}

window.addEventListener("DOMContentLoaded", main);