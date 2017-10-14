import Component from "./Component.js";

export default class FighterChart extends Component {
    constructor(props) {
        super(Object.assign({
            columns: 4
        }, props));

        this.state = {
            fighters: props.fighters || [],
            promotions: props.promotions || [],
            filter: Object.assign({
                winCount: 0,
                lossCount: 0,
                totalCount: 1,
                search: null
            }, props.filter),
            selectedFighters: props.initialSelected || []
        };
    }

    onDeselectAll() {
        this.props.onDeselectFighters.call(this, this.state.selectedFighters);
    }

    onReset() {
        const filter = {
            lossCount: 0,
            winCount: 0,
            totalCount: 1,
            search: ""
        };

        this.props.onChangeFilter.call(this, filter);
    }

    mount() {
        const self = this;
        const domain = this.props.domain;
        const container = this.props.container
            .append("div")
            .attr("class", "fighter-table");

        const controls = container.append("div")
            .attr("class", "control");

        controls.append("button")
            .attr("class", "deselect-all")
            .text("Deselect All")
            .on("click", this.onDeselectAll.bind(this));

        controls.append("button")
            .attr("class", "reset")
            .text("Reset")
            .on("click", this.onReset.bind(this));

        controls.append("select")
            .attr("class", "promotion-select")
            .selectAll("option")
            .data([{
                id: "all",
                name: "All Promotions"
            }].concat(this.props.promotions))
                .enter()
                .append("option")
                .text(({ name, nickname }) => `${name}${nickname ? ` (${nickname})` : ""}`)
                .attr("value", ({ id }) => id);

        controls.append("select")
            .attr("class", "class-select")
            .selectAll("option")
            .data([
                "All Weight Classes",
                "Heavyweight",
                "Featherweight",
                "Light Heavyweight",
                "Lightweight",
                "Strawweight",
                "Flyweight",
                "Middleweight",
                "Super Heavyweight",
                "Welterweight",
                "Bantamweight"
            ])
            .enter()
            .append("option")
            .property("value", d => d)
            .text(d => d);

        controls.append("input")
            .attr("type", "text")
            .attr("placeholder", "Filter")
            .attr("class", "search-input");

        [
            ["total", domain.maxFightCount - 1],
            ["win", domain.maxWinCount - 1],
            ["loss", domain.maxLossCount - 1]
        ].forEach(([metric, max]) => {
            const range = controls.append("div")
                .attr("class", "range");

            const target = `fight-metric-${metric}`;

            range.append("label")
                .attr("for", target)
                .text(`${metric} count`);

            range.append("input")
                .attr("id", target)
                .attr("type", "range")
                .attr("min", metric === "total" ? 1 : 0)
                .attr("max", max);
        });

        controls.append("span")
            .attr("class", "hidden-fighters");

        container.append("div")
            .attr("class", "fighter-list");
    }

    render() {
        const component = this;
        const { props, state } = this;
        const { container } = props;

        const activeFighters = _.unionBy(state.fighters, state.selectedFighters, _.property("id")).map(fighter => {
            return _.find(state.selectedFighters, { id: fighter.id }) ?
                Object.assign({ selected: true }, fighter) : fighter;
        }).sort((a, b) => {
            if(a.selected && !b.selected) return -1;
            if(b.selected && !a.selected) return 1;

            return a.name >= b.name ? 1 : -1
        });

        const columnHeight = Math.max(10, Math.floor(activeFighters.length/props.columns));
        const split = Array(props.columns).fill(0).map((_, i) => activeFighters.slice(i * columnHeight, (i + 1) * columnHeight));

        container.select(".promotion-select")
            .on("change", function() {
                return props.onChangeFilter.call(component, Object.assign({}, state.filter, {
                    promotion: this.value === "all" ? undefined : this.value,
                    winCount: 0,
                    lossCount: 0,
                    totalCount: 1
                }));
            });

        container.select(".class-select")
            .on("change", function() {
                return props.onChangeFilter.call(component, Object.assign({}, state.filter, {
                    weightClass: this.value.match(/all/i) ? undefined : this.value,
                    winCount: 0,
                    lossCount: 0,
                    totalCount: 1
                }));
            });

        container.select(".search-input")
            .attr("value", this.state.search || "")
            .on("input", function() {
                return props.onChangeFilter.call(component, {
                    search: d3.select(this).property("value"),
                    winCount: 0,
                    lossCount: 0,
                    totalCount: 1,
                    promotion: state.filter.promotion
                });
            });

        container.select(".hidden-fighters")
            .text(`(${props.domain.fighterCount - state.fighters.length} hidden)`);

        [
            ["total", state.filter.totalCount],
            ["win", state.filter.winCount],
            ["loss", state.filter.lossCount]
        ].forEach(([ metric, value ]) => {
            container.select(`#fight-metric-${metric}`)
                .property("value", value)
                .on("change", function() {
                    const value = parseInt(this.value);
                    const wrapper = d3.select(this.parentNode.parentNode);
                    const totalCount = parseInt(wrapper.select("#fight-metric-total").property("value"));
                    const winCount = parseInt(wrapper.select("#fight-metric-win").property("value"));
                    const lossCount = parseInt(wrapper.select("#fight-metric-loss").property("value"));
                    const max = Math.max(winCount, Math.max(lossCount, totalCount));

                    return props.onChangeFilter.call(component, Object.assign({}, state.filter, {
                        totalCount: max,
                        [`${metric}Count`]: value
                    }));
                });
        });

        const table = props.container
            .select(".fighter-list")
            .selectAll("table")
            .data(split)

        const enterTable = table.enter()
            .append("table");

        const row = table.merge(enterTable)
            .selectAll("tr:not(.header)")
            .data(fighters => fighters)

        const enterRow = row.enter().append("tr");
        enterRow.append("td")
            .append("input")
            .attr("type", "checkbox");

        enterRow.append("td")
            .append("label");

        const enterUpdateRow = row.merge(enterRow);

        enterUpdateRow
            .select("input")
            .attr("id", ({ id }) => `selected-${id}`)
            .property("checked", ({ selected }) => selected === true)
            .on("change", function(fighter) {
                return this.checked ?
                    props.onSelectFighters.call(component, [fighter]) :
                    props.onDeselectFighters.call(component, [fighter]);
            });

        enterUpdateRow
            .select("label")
            .attr("for", ({ id }) => `selected-${id}`)
            .text(({ name, nickname }) => `${name}${nickname ? ` "${nickname}"` : ""}`);


        row.exit().remove();
    }
}