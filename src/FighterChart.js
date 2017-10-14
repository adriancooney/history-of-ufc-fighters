import Component from "./Component.js";

const fittedFightLocal = d3.local();

export default class FighterChart extends Component {
    constructor(props) {
        super(props);

        this.state = {
            fighters: props.fighters,
            inspectedFights: [],
            selectedFights: []
        };

        const { domain, padding, width, height } = props;

        this.netWinsScale = d3.scaleLinear()
            .domain([ domain.maxLine, domain.minLine ])
            .range([ 0, height - (padding.t + padding.b) ]);

        this.timeTicks = d3.scaleTime()
            .domain([ domain.minDate, domain.maxDate ]);

        this.timeScale = d3.scalePow()
            .exponent(4)
            .domain([ domain.minDate.valueOf(), domain.maxDate.valueOf() ])
            .range([ 0, width - (padding.l + padding.r) ]);

        this.selectedFighterColorScale = d3.scaleOrdinal(d3.schemeCategory20)

        this.fightLine = d3.line()
            .x(d => this.timeScale(d.date))
            .y(d => this.netWinsScale(d.line))
            .curve(d3.curveMonotoneX);
    }

    mount() {
        const self = this;
        const { container, domain, padding, width, height } = this.props;

        this.svg = container
            .append("div")
            .attr("class", "fighter-chart")
            .append("svg")
            .attr("viewBox", `0 0 ${width} ${height}`);

        this.svg.append("text")
            .text("Net Wins")
            .attr("text-anchor", "middle")
            .attr("transform", `translate(${padding.l / 2}, ${height / 2}), rotate(-90)`)
            .style("color", "#000");

        this.svg.append("g")
            .attr("id", "fighter-lines")
            .attr("transform", `translate(${padding.t}, ${padding.l})`);

        const netWinsAxis = d3.axisLeft(this.netWinsScale);

        this.svg.append("g")
            .attr("id", "net-wins-axis")
            .attr("transform", `translate(${padding.t}, ${padding.l})`)
            .call(netWinsAxis);

        const timeAxis = d3.axisBottom(this.timeScale)
            .tickFormat(tick => tick ? typeof tick === "string" ? tick : tick.getFullYear() : undefined)
            .tickValues(_.drop(this.timeTicks.ticks(14), 1).concat(domain.maxDate));

        this.svg.append("g")
            .attr("transform", `translate(${padding.l}, ${padding.t + this.netWinsScale(0)})`)
            .call(timeAxis);

        this.svg.append("g")
            .attr("id", "labels");
    }

    render() {
        const chart = this;
        const { padding, width, height } = this.props;
        const { inspectedFights, selectedFights } = this.state;
        const svg = this.svg;

        const activeFights = _.unionBy(
            selectedFights.map(({ fight }) => fight),
            inspectedFights.map(({ fight }) => fight),
            _.property("id")
        );

        const activeFighters = _.unionBy(
            selectedFights.map(({ fighter }) => fighter),
            inspectedFights.map(({ fighter }) => fighter),
            _.property("id")
        );

        const fighters = _.unionBy(this.state.fighters, activeFighters, _.property("id")).map(fighter => {
            let highlighted = false;

            const fights = _.sortBy(fighter.fights, _.property("fight.event.dateof")).reduce((fights, fight, i) => {
                const isActiveFight = !!activeFights.find(({ id }) => fight.fight.id === id);

                highlighted = highlighted || isActiveFight;

                fights.push(Object.assign({
                    line: (i === 0 ? 0 : fights[fights.length - 1].line) + FighterChart.getFighterResult(fight.result),
                    highlighted: isActiveFight
                }, fight));

                return fights;
            }, []);

            return Object.assign({ highlighted }, fighter, { fights })
        })

        svg.on("click", function() {
            if(d3.select(d3.event.target).attr("class") !== "fighter-disc") {
                return chart.props.onDeselectAllFights.call(chart);
            }
        });

        const fighterGroup = svg.select("#fighter-lines")
            .selectAll("g")
            .data(fighters, _.property("id"));

        const newFighter = fighterGroup.enter().append("g");

        newFighter.attr("id", ({ name }) => name)
            .append("path")
            .style("fill", "none")
            .style("stroke", ({ name }) => this.selectedFighterColorScale(name))
            .style("stroke-width", 2)
            .attr("d", fighter => {
                return this.fightLine(
                    [{
                        date: new Date(fighter.fights[0].fight.event.dateof - (1000 * 60 * 60 * 24 * 7 * 4 * 3)),
                        line: 0
                    }].concat(
                        fighter.fights.map(fight => ({
                            date: fight.fight.event.dateof,
                            line: fight.line
                        }))
                    )
                );
            });

        const newUpdatedFighters = fighterGroup.merge(newFighter)
            .style("opacity", fighter => activeFights.length ? fighter.highlighted ? 1 : 0.1 : 1)
            .style("pointer-events", fighter => activeFights.length ? fighter.highlighted ? "auto" : "none" : "auto");

        fighterGroup.exit().remove();

        const fighterDisc = newUpdatedFighters.selectAll("circle")
            .data(({ fights }) => fights, f => f.fight.id);

        const enterFighterDisc = fighterDisc.enter()
            .append("circle")
            .attr("class", "fighter-disc")
            .attr("cx", fight => this.timeScale(fight.fight.event.dateof.valueOf()))
            .attr("cy", fight => this.netWinsScale(fight.line))
            .each(function(fight) {
                const fighter = d3.select(this.parentNode).datum();
                const circle = d3.select(this).style("fill", chart.selectedFighterColorScale(fighter.name));
            });

        fighterDisc.merge(enterFighterDisc)
            .on("mouseover", this.props.onInspectFight.bind(this))
            .on("click", this.props.onSelectFight.bind(this))
            .on("mouseout", this.props.onUninspectFight.bind(this))
            .attr("r", ({ highlighted }) => highlighted ? 5 : 3)
            .style("stroke-width", ({ highlighted }) => highlighted ? "2px" : 0)
            .style("stroke", fight => {
                if(fight.highlighted) {
                    return fight.result === "draw" ? "slategray" : fight.result === "win" ? "lime" : "crimson";
                } else {
                    return "none";
                }
            });

        const label = svg.select("#labels")
            .selectAll("g")
            .data(fighters, _.property("id"));

        const newLabel = label.enter()
            .append("g")
            .attr("class", "fighter-label")
            .attr("id", ({ name }) => name);

        newLabel.append("rect")
            .style("fill", ({ name }) => this.selectedFighterColorScale(name));

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
                x: Math.max(0, Math.min(width - padding.r - w, padding.l + chart.timeScale(fight.fight.event.dateof) - w / 2)),
                y: padding.t + chart.netWinsScale(fight.line) - h / 2,
                w, h
            });

            let { fight, box } = _.shuffle(fights).reduce((result, fight) => {
                if(result) {
                    return result;
                }

                const box = getBox(fight);

                if(!fittedFights.some(fitted => FighterChart.intersect(fitted.box, box))) {
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

        label.merge(newLabel)
            .style("opacity", fighter => activeFights.length ? fighter.selectedFight ? undefined : 0.1 : undefined);

        label.exit().remove();

        const eventGroup = svg.selectAll(".event-label")
            .data(activeFights, _.property("id"));

        const newEventGroup = eventGroup.enter()
            .append("g")
            .attr("class", "event-label");

        newEventGroup.append("line")
            .attr("x1", fight => padding.l + this.timeScale(fight.event.dateof))
            .attr("x2", fight => padding.l + this.timeScale(fight.event.dateof))
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
            .text(d => d.event.name)
            .each(function(fight) {
                const group = d3.select(this.parentNode);

                const rect = group.select("rect")
                const bbox = this.getBBox();

                group.attr("transform", fight => `translate(${Math.min(width - padding.r - bbox.width - 6, chart.timeScale(fight.event.dateof) + padding.l)}, ${height - padding.b - 5})`);

                rect.attr("transform", `translate(0, -${bbox.height/2 + 8})`)
                    .attr("width", bbox.width + 6)
                    .attr("height", bbox.height + 6)
                    .style("fill", "#aaa");
            });

        eventGroup.exit().remove();
    }

    static getFighterResult(result) {
        return result === "win" ? 1 : result === "loss" ? -1 : 0;
    }

    static intersect(box1, box2) {
        return Math.abs(box1.x - box2.x) < box1.w && Math.abs(box1.y - box2.y) < box1.h;
    }
}