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

function stageDrivenLocations(stage) {
    if (stage >= 3) {
        return [locations[1], locations[3], locations[4]];
    }
    if (stage >= 1) {
        return [locations[0], locations[2], locations[3], locations[4]];
    }
    return locations;
}

function buildIntro(stage) {
    if (stage >= 3) {
        return [
            'You find another dead bird clutching the same blood-stained scroll.',
            'Now the rescue note is clear: "Where the lake whispers loudest, the chained woman waits."'
        ];
    }
    if (stage >= 1) {
        return [
            'You find a dead bird clutching a scroll and half a map.',
            'Your earlier clues make some trails stand out. One path clearly smells wrong.'
        ];
    }
    return [
        'You find a dead bird clutching a scroll.',
        'The scroll begs you to rescue a trapped woman, but the directions are maddeningly vague.'
    ];
}

function pickCorrectOption(stage, shownLocations, rng) {
    if (stage >= 3) {
        return shownLocations.indexOf('Near the lake') + 1;
    }
    const forced = shownLocations.indexOf('Near the lake');
    if (stage >= 1 && forced >= 0 && rng() < 0.5) {
        return forced + 1;
    }
    return randInt(1, shownLocations.length, rng);
}

export const deadBirdRescueEvent = {
    id: 'dead_bird_rescue',
    weight: 12,
    execute(player, session, rng = Math.random) {
        const choice = session.choice;
        const stage = Number(player.olivia_clue_stage ?? 0);
        const shownLocations = session.payload?.shownLocations ?? stageDrivenLocations(stage);
        const correct = Number(session.payload?.correctLocation ?? pickCorrectOption(stage, shownLocations, rng));

        if (!choice) {
            return {
                text: buildIntro(stage),
                choices: shownLocations.map((label, idx) => ({ key: String(idx + 1), label })),
                payload: { correctLocation: correct, shownLocations }
            };
        }

        if (Number(choice) === correct) {
            const gems = randInt(12, 30, rng) + stage * 2;
            const exp = player.level * (450 + stage * 80);
            const gold = 250 + player.level * 90 + stage * 100;
            const bonusTurn = stage >= 3 ? 1 : 0;
            return {
                text: [
                    'You cut through old chains and free the trapped woman. She kisses your forehead and laughs like thunder.',
                    `(+${gems} gems, +${gold} gold, +${exp} exp${bonusTurn ? ', +1 forest fight' : ''})`
                ],
                effects: {
                    gems: player.gems + gems,
                    exp: player.exp + exp,
                    gold_on_hand: player.gold_on_hand + gold,
                    turns_forest_left: player.turns_forest_left + bonusTurn,
                    olivia_clue_stage: 0
                },
                globalNews: `${player.display_name} solved the dead bird rescue and returned with wild treasure.`
            };
        }

        const damage = randInt(10, 22, rng) + Math.max(0, 2 - stage);
        const clueSetback = stage > 0 && rng() < 0.35 ? 1 : 0;
        return {
            text: [
                'A hidden trap snaps shut around you.',
                `You barely escape alive. (-${damage} HP${clueSetback ? ', rescue clues shaken' : ''})`
            ],
            effects: {
                hp: Math.max(1, player.hp - damage),
                olivia_clue_stage: Math.max(0, stage - clueSetback)
            }
        };
    }
};
