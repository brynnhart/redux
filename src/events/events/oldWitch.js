function randInt(min, max, rng) {
    return Math.floor(rng() * (max - min + 1)) + min;
}
export const oldWitchEvent = {
    id: 'old_witch',
    weight: 20,
    execute(player, session, rng = Math.random) {
        const choice = session.choice?.toUpperCase();
        if (!choice) {
            return {
                text: ['A crooked old witch blocks your path.', '"Give me a gem and I will make you stronger."'],
                choices: [
                    { key: 'G', label: 'Give gem' },
                    { key: 'N', label: 'Refuse' }
                ]
            };
        }
        if (choice === 'G' && player.gems > 0) {
            return {
                text: ['The witch cackles and taps your forehead with a bone wand. You feel tougher.'],
                effects: { gems: player.gems - 1, hp_max: player.hp_max + 1, hp: player.hp + 1 },
                globalNews: `${player.display_name} helped a mysterious witch and grew stronger.`
            };
        }
        if (choice === 'G') {
            return {
                text: ['You fumble for a gem, but your pockets are empty. The witch spits and vanishes.']
            };
        }
        const hpLoss = randInt(2, 6, rng);
        return {
            text: ['"Then be cursed," she hisses.', `You feel weaker. (-${hpLoss} HP)`],
            effects: { hp: Math.max(1, player.hp - hpLoss) }
        };
    }
};
