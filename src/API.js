export default class API {
    constructor(host) {
        this.host = host;
    }

    request(url, options = {}) {
        if(options.single) {
            options = Object.assign({
                headers: Object.assign({
                    Accept: "application/vnd.pgrst.object+json"
                }, options.headers)
            }, options);
        }

        return fetch(`${this.host}${url}`, options).then(res => res.json());
    }

    async getBounds() {
        const bounds = await this.request(`/bounds?select=*`, { single: true });

        return _.mapKeys(bounds, (value, key) => _.camelCase(key));
    }

    getFighters(options = {}) {
        const filter = [];

        if(options.winCount) filter.push(`win_count.gte.${options.winCount}`);
        if(options.lossCount) filter.push(`loss_count.gte.${options.lossCount}`);
        if(options.fightCount) filter.push(`fight_count.gte.${options.fightCount}`);
        if(options.search) filter.push(`name.ilike.*${options.search}*`);

        return this.request(`/fighter_stats?select=name,id${filter.length ? `&and=(${filter.join(",")})` : ""}`);
    }

    getInitialSelectedFighters() {
        return this.request("/initial_selected?select=*,fights:fight(*)");
    }

    getEvents() {
        return this.request("/event?select=id,name,dateof");
    }

    getPromotions() {
        return this.request("/promotion?select=id,name");
    }
}