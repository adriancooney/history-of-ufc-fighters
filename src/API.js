export default class API {
    constructor(host) {
        this.host = host;
    }

    async request(url, options = {}) {
        if(options.single) {
            options = Object.assign({
                headers: Object.assign({
                    Accept: "application/vnd.pgrst.object+json"
                }, options.headers)
            }, options);
        }

        const res = await fetch(`${this.host}${url}`, options);
        const body = await res.text();

        return JSON.parse(body, (key, value) => key.includes("date") ? new Date(value) : value);
    }

    async getBounds() {
        let bounds = await this.request(`/bounds?select=*`, { single: true });
        bounds = _.mapKeys(bounds, (value, key) => _.camelCase(key));

        return Object.assign(bounds, {
            minDate: new Date(bounds.minDate),
            maxDate: new Date(bounds.maxDate)
        });
    }

    async getOpponent({ fight, fighter }) {
        return (await this.request(`/fight_fighters?select=fighter(*,fights:fight_fighters(*, fight(*, event(*))))&and=(fight.eq.${fight.id},fighter.neq.${fighter})`, {
            single: true
        })).fighter;
    }

    getBriefFighters(options = {}) {
        const filter = [];

        if(options.winCount) filter.push(`win_count.gte.${options.winCount}`);
        if(options.lossCount) filter.push(`loss_count.gte.${options.lossCount}`);
        if(options.totalCount) filter.push(`fight_count.gte.${options.totalCount}`);
        if(options.search) filter.push(`or(name.ilike.*${options.search}*,nickname.ilike.*${options.search}*)`);
        if(options.promotion) filter.push(`promotion.eq.${options.promotion}`);
        if(options.weightClass) filter.push(`class.eq."${options.weightClass}"`);

        return this.request(`/all_fighters?select=name,id,nickname${filter.length ? `&and=(${filter.join(",")})` : ""}`);
    }

    async getFighters(fighters) {
        return (await this.request(
            `/fighter?select=*,fights:fight_fighters.fighter(*,fight:fight.id(*,event(*)))` +
            `&id=in.${fighters.join(",")}`
        ));
    }

    getFight(id) {
        return this.request(`/full_fights?id=eq.${id}`, { single: true });
    }

    getInitialSelectedFighters() {
        return this.request("/initial_selected?select=*,fights:fight_fighters.fighter(*, fight(*, event(*)))");
    }

    getEvents() {
        return this.request("/event?select=id,name,dateof");
    }

    getPromotions() {
        return this.request("/promotion?select=id,name,nickname");
    }
}