function randInt(min, max, rng) {
    return Math.floor(rng() * (max - min + 1)) + min;
}

export const oldWitchEvent = {
    id: 'old_witch',
    weight: 18,
    execute(player, session, rng = Math.random) {
        const choice = session.choice?.toUpperCase();
        if (!choice) {
            return {
                text: ['A crooked old witch blocks your path and sniffs the air around you.', '"Give me a gem and I will show you what birds fear."'],
                choices: [
                    { key: 'G', label: 'Give gem' },
                    { key: 'N', label: 'Refuse' }
                ]
            };
        }
        if (choice === 'G' && player.gems > 0) {
            const nextClueStage = player.olivia_clue_stage < 2 ? 2 : player.olivia_clue_stage;
            return {
                text: [
                    'The witch cackles and taps your forehead with a bone wand. You feel tougher.',
                    nextClueStage > player.olivia_clue_stage
                        ? 'She croaks, "Bridge lies. Lake remembers." (+rescue clue)'
                        : 'She chews the gem and nods like she approves of your fear.'
                ],
                effects: {
                    gems: player.gems - 1,
                    hp_max: player.hp_max + 1,
                    hp: Math.min(player.hp_max + 1, player.hp + 1),
                    olivia_clue_stage: nextClueStage
                },
                globalNews: `${player.display_name} bargained with a forest witch and came back altered.`
            };
        }
        if (choice === 'G') {
            return {
                text: ['You fumble for a gem, but your pockets are empty. The witch spits and vanishes.']
            };
        }
        const hpLoss = randInt(3, 8, rng);
        return {
            text: ['"Then be cursed," she hisses.', `You feel weaker. (-${hpLoss} HP)`],
            effects: { hp: Math.max(1, player.hp - hpLoss) }
        };
    }
};
