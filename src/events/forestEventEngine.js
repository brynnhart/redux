function randInt(min, max, rng) {
    return Math.floor(rng() * (max - min + 1)) + min;
}
export class ForestEventEngine {
    events;
    rng;
    constructor(events, rng = Math.random) {
        this.events = events;
        this.rng = rng;
    }
    pickEvent(player) {
        const pool = this.events.filter((event) => {
            if (event.minLevel !== undefined && player.level < event.minLevel)
                return false;
            if (event.maxLevel !== undefined && player.level > event.maxLevel)
                return false;
            if (event.canTrigger && !event.canTrigger(player))
                return false;
            return true;
        });
        const totalWeight = pool.reduce((sum, event) => sum + event.weight, 0);
        let roll = this.rng() * Math.max(totalWeight, 1);
        for (const event of pool) {
            roll -= event.weight;
            if (roll <= 0)
                return event;
        }
        return pool[randInt(0, Math.max(0, pool.length - 1), this.rng)] ?? this.events[0];
    }
    execute(event, player, context) {
        return event.execute(player, context, this.rng);
    }
    getEvent(id) {
        return this.events.find((event) => event.id === id);
    }
}
