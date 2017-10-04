import Component from "./Component";

export default class FighterChart extends Component {
    constructor(props) {
        super(Object.assign({
            columns: 4
        }, props));

        this.state = {
            fighters: []
        };
    }

    displayFighters(fighters) {
        this.setState({ fighters });
    }

    selectFighters(selectedFighters) {
        this.setState({ selectedFighters });
    }

    filter(filter) {
        this.setState({ filter });
    }

    onDeselectAll() {

    }

    onReset() {

    }

    onChangeTextFilter() {

    }

    mount() {
        //         <div class="control">
        //     <button id="deselect-all">Deselect All</button>
        //     <button id="reset">Reset</button>
        //     <input id="filter-input" type="text" placeholder="Filter">
        //     <div class="range">
        //         <label for="fight-count-total">Fight Count</label>
        //         <input id="fight-count-total" type="range" name="fight-count-total" min="1" />
        //     </div>
        //     <div class="range">
        //         <label for="fight-count-win">Win Count</label>
        //         <input id="fight-count-win" type="range" name="fight-count-win" min="0" />
        //     </div>
        //     <div class="range">
        //         <label for="fight-count-loss">Loss Count</label>
        //         <input id="fight-count-loss" type="range" name="fight-count-loss" min="0" />
        //     </div>
        //     <span id="hidden-fighters">(0 hidden fighters)</span>
        // </div>
        // <div class="fighter-list"></div>
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

        container.append("div")
            .attr("class", "fighters-list");
    }

    render() {
        const component = this;
        const { props, state } = this;
        const { container } = props;
        const activeFighters = _.sortBy(state.fighters, _.property("name")).map(fighter => {
            return state.selectedFighters.find(({ id }) => fighter.id === id) ?
                Object.assign({ selected: true }, fighter) : fighter;
        });

        const columnHeight = Math.max(10, Math.floor(activeFighters.length/props.columns));
        const split = Array(props.columns).fill(0).map((_, i) => activeFighters.slice(i * columnHeight, (i + 1) * columnHeight));

        container.select(".search-input")
            .attr("value", this.state.search || "")
            .on("input", function() {
                return props.onChangeFilter.call(component, Object.assign({
                    search: d3.select(this).property("value")
                }, filter));
            });

        container.select(".hidden-fighters")
            .text(`(${domain.fighter_count - fighters.length} hidden)`);

        [
            ["total", state.totalCount],
            ["win", state.winCount],
            ["loss", state.lossCount]
        ].forEach(([ metric, value ]) => {
            container.select(`#fight-metric-${metric}`)
                .property("value", value)
                .on("change", function() {
                    return props.onChangeFilter.call(component, Object.assign({
                        [`${metric}Count`]: parseInt(d3.select(this).property("value"))
                    }, state.filter));
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
            .on("change", fighter => {
                return this.checked ? props.onSelectFighter.call(this, fighter) : props.onDeselectFighter.call(this, fighter);
            });

        row.exit().remove();
    }
}