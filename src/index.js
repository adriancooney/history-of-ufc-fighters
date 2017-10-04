import API from "./API.js";
import FighterTable from "./FighterTable.js";

window.addEventListener("DOMContentLoaded", main);

async function main() {
    const api = new API("http://localhost:3000");

    const domain = await api.getBounds();
    const filter = {
        winCount: 5
    };

    const fighters = await api.getFighters(filter);

    const table = new FighterTable({
        domain,
        fighters,
        filter,
        container: d3.select(document.body),

        onSelectFighters(selectedFighters) {
            this.setState({
                selectedFighters: _.unionBy(this.state.selectedFighters, selectedFighters, _.property("id"))
            });
        },

        onDeselectFighters(deselectedFighters) {
            this.setState({
                selectedFighters: _.differenceBy(this.state.selectedFighters, deselectedFighters, _.property("id"))
            });
        },

        async onChangeFilter(filter) {
            const fighters = await api.getFighters(filter);

            return this.setState({ filter, fighters });
        }
    });

    table.mount();
    table.render();
}