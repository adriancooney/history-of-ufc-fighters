import Component from "./Component.js";

export default class FightView extends Component {
    constructor(props) {
        super(props);

        this.state = {
            fight: props.fight
        };
    }

    mount() {
        const section = this.props.container
            .append("div")
            .attr("class", "fight-view")
            .append("section");

        const f1 = section.append("div")
            .attr("class", "fighter f1 top draw");

        f1.append("h3")
            .append("a")
            .attr("class", "fight-f1-name")
            .attr("target", "_blank");

        f1.append("div")
            .attr("class", "squeeze")
            .append("div")
            .attr("class", "bar");

        const result = section.append("div")
            .attr("class", "result");

        result.append("span")
            .attr("class", "clip loss")
            .text("LOSS");

        result.append("h5")
            .attr("class", "vs")
            .text("vs");

        result.append("span")
            .attr("class", "clip win")
            .text("WIN");

        const f2 = section.append("div")
            .attr("class", "fighter f2 bottom draw");

        f2.append("div")
            .attr("class", "squeeze")
            .append("div")
            .attr("class", "bar");

        f2.append("h3")
            .append("a")
            .attr("class", "fight-f2-name")
            .attr("target", "_blank");

        const detail = section.append("div")
            .attr("class", "detail");

        const tableRow = detail.append("table")
            .selectAll("tr")
            .data(["Method", "Move", "Ref"])
            .enter()
            .append("tr");

        tableRow.append("td")
            .text(d => d);

        tableRow.append("td")
            .attr("class", d => `fight-detail-${d.toLowerCase()}`)
            .text("-");

        const fightDetail = detail.append("div")
            .attr("class", "fight")
            .selectAll("div")
            .data(["Round", "Time"])
            .enter()
            .append("div")
            .attr("class", d => d.toLowerCase())

        fightDetail.append("h5")
            .text(d => d);

        fightDetail.append("h3")
            .attr("class", d => `fight-detail-${d.toLowerCase()}`);

        const date = detail.append("div")
            .attr("class", "date");

        date.append("h5").text("Date");
        date.append("h3")
            .attr("class", "fight-detail-date")
            .text("-");

        const event = detail.append("div")
            .attr("class", "event");

        event.append("h5").text("Event");
        event.append("h3")
            .append("a")
            .attr("target", "_blank")
            .attr("class", "fight-detail-event")
            .text("-");

        const location = detail.append("div")
            .attr("class", "location");

        location.append("h5").text("Location");
        location.append("h3")
            .attr("class", "fight-detail-location")
            .text("-");
    }

    render() {
        const view = this.props.container.select(".fight-view");
        const fight = this.state.fight || {};

        view.select(".fight-f1-name")
            .text(fight.f1_name);

        view.select(".fight-f2-name")
            .text(fight.f2_name);

        view.select(".fight-detail-event")
            .text(fight.event_name || "-");

        view.select(".fighter.f1")
            .classed("win", fight.f1_result === "win")
            .classed("loss", fight.f1_result === "loss");

        view.select(".fighter.f2")
            .classed("win", fight.f2_result === "win")
            .classed("loss", fight.f2_result === "loss")

        view.select(".fight-detail-submission").text(fight.method || "-");
        view.select(".fight-detail-move").text(fight.method_detail || "-");
        view.select(".fight-detail-ref").text(fight.referee || "-");
        view.select(".fight-detail-round").text(fight.round || "-");
        view.select(".fight-detail-time").text(fight.round_time || "-");
        view.select(".fight-detail-date").text(fight.event_dateof ? fight.event_dateof.toLocaleString(undefined, {
            year: "numeric", month: "long", day: "numeric"
        }) : "-");
        view.select(".fight-detail-location").text(fight.event_location || "-");
    }

    static formatSherdogURL(path) {
        return `http://sherdog.com${path}`;
    }
}