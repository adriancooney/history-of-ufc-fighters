import Component from "./Component.js";
import API from "./API.js";
import FighterChart from "./FighterChart.js";
import FighterTable from "./FighterTable.js";
import FightView from "./FightView.js";

export default class App extends Component {
    constructor(props) {
        super(props);

        this.api = new API("http://api.localhost:8888");
    }

    async mount() {
        const api = this.api;
        this.domain = await api.getBounds();

        const filter = {
            winCount: 5,
            totalCount: 5
        };

        const app = this;
        const initialSelected = await api.getInitialSelectedFighters();
        const fighters = await api.getBriefFighters(filter);
        const promotions = await api.getPromotions();

        const banner = this.props.container.append("div")
            .attr("class", "banner");

        this.fight = new FightView({
            container: banner
        });

        this.chart = new FighterChart({
            domain: this.domain,
            fighters: initialSelected,
            container: banner,
            width: 960,
            height: 500,
            padding: {
                t: 50, r: 20, b: 20, l: 50
            },

            async onInspectFight(fight) {
                const fighter = await api.getOpponent(fight);

                this.setState({
                    inspectedFights: _.unionBy(
                        this.state.inspectedFights,
                        [{
                            fight: fight.fight,
                            fighter
                        }],
                        _.property("fight.id")
                    )
                });

                app.fight.setState({
                    fight: await api.getFight(fight.fight.id)
                });
            },

            async onUninspectFight({ fight }) {
                this.setState({
                    inspectedFights: this.state.inspectedFights.filter(ins => ins.fight.id !== fight.id)
                });

                let fightView = null;

                if(app.chart.state.selectedFights.length) {
                    fightView = await api.getFight(app.chart.state.selectedFights[0].fight.id)
                }

                app.fight.setState({ fight: fightView });
            },

            async onSelectFight(fight) {
                const fighter = await api.getOpponent(fight);

                this.setState({
                    selectedFights: [{
                        fight: fight.fight,
                        fighter
                    }]
                });

                app.fight.setState({
                    fight: await api.getFight(fight.fight.id)
                });
            },

            async onDeselectAllFights() {
                this.setState({
                    selectedFights: [],
                    inspectedFights: []
                });

                app.fight.setState({
                    fight: null
                });
            }
        });

        this.table = new FighterTable({
            domain: this.domain,
            fighters,
            promotions,
            initialSelected,
            filter,
            container: this.props.container,

            async onSelectFighters(selectedFighters) {
                this.setState({
                    selectedFighters: _.unionBy(this.state.selectedFighters, selectedFighters, _.property("id"))
                });

                const fighters = await api.getFighters(selectedFighters.map(({ id }) => id));

                app.chart.setState({
                    fighters: _.unionBy(app.chart.state.fighters, fighters, _.property("id"))
                });
            },

            onDeselectFighters(deselectedFighters) {
                this.setState({
                    selectedFighters: _.differenceBy(this.state.selectedFighters, deselectedFighters, _.property("id"))
                });

                app.chart.setState({
                    fighters: _.differenceBy(app.chart.state.fighters, deselectedFighters, _.property("id")),
                    selectedFights: [],
                    inspectedFights: []
                });
            },

            async onChangeFilter(filter) {
                const fighters = await api.getBriefFighters(filter);

                return this.setState({ filter, fighters });
            }
        });

        await this.chart.mount();
        await this.fight.mount();
        await this.table.mount();
    }

    render() {
        this.chart.render();
        this.table.render();
        this.fight.render();
    }
}