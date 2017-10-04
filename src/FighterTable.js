import Component from "./Component.js";

export default class FighterChart extends Component {
    constructor(props) {
        super(Object.assign({
            columns: 4
        }, props));

        this.state = {
            fighters: props.fighters || [],
            filter: Object.assign({
                winCount: 0,
                lossCount: 0,
                totalCount: 1,
                search: null
            }, props.filter),
            selectedFighters: []
        };
    }

    onDeselectAll() {
        this.props.onDeselectFighters(this.state.selectedFighters);
    }

    onReset() {
        const filter = {
            lossCount: 0,
            winCount: 0,
            totalCount: 1,
            search: ""
        };

        this.onChangeFilter(filter);
    }

    mount() {
        const self = this;
        const container = this.props.container;
        const domain = this.props.domain;
        const controls = container.append("div")
            .attr("class", "controls");

        controls.append("button")
            .attr("class", "deselect-all")
            .text("Deselect All")
            .on("click", this.onDeselectAll.bind(this));

        controls.append("button")
            .attr("class", "reset")
            .text("Reset")
            .on("click", this.onReset.bind(this));

        controls.append("input")
            .attr("type", "text")
            .attr("placeholder", "Filter")
            .attr("class", "search-input");

        [
            ["total", domain.maxFightCount - 1],
            ["win", domain.maxWinCount - 1],
            ["loss", domain.maxLossCount - 1]
        ].forEach(([metric, max]) => {
            const range = container.append("div")
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
            .attr("class", "fighters-list");
    }

    render() {
        const component = this;
        const { props, state } = this;
        const { container } = props;

        const activeFighters = _.sortBy(state.fighters, _.property("name")).map(fighter => {
            return _.find(state.selectedFighters, { id: fighter.id }) ?
                Object.assign({ selected: true }, fighter) : fighter;
        });

        const columnHeight = Math.max(10, Math.floor(activeFighters.length/props.columns));
        const split = Array(props.columns).fill(0).map((_, i) => activeFighters.slice(i * columnHeight, (i + 1) * columnHeight));

        container.select(".search-input")
            .attr("value", this.state.search || "")
            .on("input", function() {
                return props.onChangeFilter.call(component, Object.assign({}, state.filter, {
                    search: d3.select(this).property("value")
                }));
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
                    return props.onChangeFilter.call(component, Object.assign({}, state.filter, {
                        [`${metric}Count`]: parseInt(d3.select(this).property("value"))
                    }));
                });
        });

        const table = props.container
            .select(".fighters-list")
            .selectAll("table")
            .data(split)

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
                return this.checked ?
                    props.onSelectFighters.call(component, [fighter]) :
                    props.onDeselectFighters.call(component, [fighter]);
            });

        row.exit().remove();
    }
}