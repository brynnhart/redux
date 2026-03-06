function randInt(min, max, rng) {
    return Math.floor(rng() * (max - min + 1)) + min;
}

export const oldManEvent = {
    id: 'old_man',
    weight: 22,
    execute(player, session, rng = Math.random) {
        const choice = session.choice?.toUpperCase();

        if (!choice) {
            return {
                text: ['An old man in muddy boots stares at the trees like they keep moving when he blinks.'],
                choices: [
                    { key: 'Y', label: 'Help him find his way' },
                    { key: 'N', label: 'Ignore him' }
                ]
            };
        }

        if (choice !== 'Y') {
            return { text: ['You ignore him and keep walking. Someone behind you mutters, "Wrong turn, hero."'] };
        }

        if (player.olivia_clue_stage < 1 && rng() < 0.55) {
            return {
                text: ['He grabs your wrist. "If you seek the chained girl, trust the water and mistrust the ruins." (+rescue clue, -1 forest fight)'],
                effects: {
                    olivia_clue_stage: 1,
                    turns_forest_left: Math.max(0, player.turns_forest_left - 1)
                }
            };
        }

        const rewardRoll = rng();
        if (rewardRoll < 0.34) {
            return {
                text: ['He pats your shoulder. "Decency is rare." (+1 charm, -1 forest fight)'],
                effects: { charm: player.charm + 1, turns_forest_left: Math.max(0, player.turns_forest_left - 1) }
            };
        }
        if (rewardRoll < 0.68) {
            const gold = randInt(120, 280, rng) + player.level * 45;
            return {
                text: [`He slips you a heavy pouch and limps off. (+${gold} gold, -1 forest fight)`],
                effects: { gold_on_hand: player.gold_on_hand + gold, turns_forest_left: Math.max(0, player.turns_forest_left - 1) }
            };
        }
        const exp = 95 + player.level * 65;
        return {
            text: [`He teaches you a trail trick used by old killers. (+${exp} exp, -1 forest fight)`],
            effects: { exp: player.exp + exp, turns_forest_left: Math.max(0, player.turns_forest_left - 1) }
        };
    }
};
