function randInt(min, max, rng) {
    return Math.floor(rng() * (max - min + 1)) + min;
}
const locations = [
    'Under the bridge',
    'In the cave',
    'Inside the ruins',
    'Near the lake',
    'In the hollow tree'
];
export const deadBirdRescueEvent = {
    id: 'dead_bird_rescue',
    weight: 15,
    execute(player, session, rng = Math.random) {
        const choice = session.choice;
        const correct = Number(session.payload?.correctLocation ?? randInt(1, 5, rng));
        if (!choice) {
            return {
                text: ['You find a dead bird clutching a scroll.', 'The scroll begs you to rescue a trapped woman.'],
                choices: locations.map((label, idx) => ({ key: String(idx + 1), label })),
                payload: { correctLocation: correct }
            };
        }
        if (Number(choice) === correct) {
            const gems = randInt(10, 30, rng);
            const exp = player.level * 500;
            return {
                text: [`You chose correctly and free the trapped woman. She rewards you with ${gems} gems and ancient knowledge.`],
                effects: { gems: player.gems + gems, exp: player.exp + exp },
                globalNews: `${player.display_name} solved the dead bird rescue and found treasure.`
            };
        }
        const damage = randInt(10, 20, rng);
        return {
            text: ['A hidden trap snaps shut around you.', `You barely escape alive. (-${damage} HP)`],
            effects: { hp: Math.max(1, player.hp - damage) }
        };
    }
};
