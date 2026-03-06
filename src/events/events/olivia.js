function randInt(min, max, rng) {
    return Math.floor(rng() * (max - min + 1)) + min;
}

export const oliviaEvent = {
    id: 'olivia',
    weight: 8,
    canTrigger(player) {
        return !player.olivia_used_today;
    },
    execute(player, session, rng = Math.random) {
        const choice = session.choice?.toUpperCase();
        const intro = player.olivia_seen
            ? ['You hear soft humming between the thorns.', 'Olivia steps out of the mist, smiling like she remembers your secrets.']
            : ['Mist curls around your boots as a woman in white appears upside-down on a tree branch.', '"I am Olivia," she says. "Tell me what hurts and I might tell you where to dig."'];

        if (!choice) {
            return {
                text: intro,
                choices: [
                    { key: 'L', label: 'Listen to Olivia' },
                    { key: 'F', label: 'Follow her into the mist' },
                    { key: 'R', label: 'Refuse and leave' }
                ]
            };
        }

        const basePatch = {
            olivia_seen: 1,
            olivia_used_today: 1
        };

        if (choice === 'L') {
            if (player.olivia_clue_stage < 3) {
                const nextStage = Math.min(3, player.olivia_clue_stage + 1);
                const exp = 150 + player.level * 80;
                return {
                    text: [
                        'Olivia whispers, "The dead bird lied with its eyes. Follow where water sounds loudest, then count backwards from five."',
                        `Your thoughts sharpen. (+${exp} exp, rescue clue improved)`
                    ],
                    effects: {
                        ...basePatch,
                        olivia_clue_stage: nextStage,
                        exp: player.exp + exp
                    },
                    globalNews: `${player.display_name} listened to Olivia and returned from the forest changed.`
                };
            }
            return {
                text: ['Olivia claps softly. "You already know enough to find her. Stop stalling."'],
                effects: basePatch
            };
        }

        if (choice === 'F') {
            const roll = rng();
            if (roll < 0.45) {
                const gems = randInt(2, 5, rng);
                return {
                    text: ['You follow Olivia through brambles and moonlight. At dawn she is gone, but a velvet pouch rests in your hand.', `(+${gems} gems)`],
                    effects: {
                        ...basePatch,
                        gems: player.gems + gems,
                        olivia_clue_stage: Math.max(player.olivia_clue_stage, 2)
                    }
                };
            }
            const hpLoss = randInt(6, 14, rng);
            return {
                text: ['You chase Olivia until every tree looks the same. She laughs behind you and the thorns drink your blood.', `(-${hpLoss} HP)`],
                effects: {
                    ...basePatch,
                    hp: Math.max(1, player.hp - hpLoss)
                }
            };
        }

        return {
            text: ['Olivia sighs. "Cowardice is a kind of wisdom." She fades into the moss.'],
            effects: basePatch
        };
    }
};
