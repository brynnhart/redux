export const jennieEvent = {
    id: 'jennie',
    weight: 4,
    canTrigger(player) {
        return player.spirits === 'HIGH';
    },
    execute(player, session) {
        const choice = session.choice?.toUpperCase();
        const textInput = session.textInput?.trim().toUpperCase();
        if (!choice && !textInput) {
            return {
                text: ['A beautiful woman appears before you.', '"My name is Jennie. Tell me what you think of me."'],
                choices: [
                    { key: 'T', label: 'Tell Jennie' },
                    { key: 'L', label: 'Leave' }
                ]
            };
        }
        if (choice === 'L') {
            return { text: ['You nod politely and back away before fate gets ideas.'] };
        }
        if (choice === 'T' && !textInput) {
            return {
                text: ['Jennie leans close. "One word. Make it count."'],
                keepOpen: true,
                promptField: 'jennie_word'
            };
        }
        switch (textInput) {
            case 'FOXY':
                return { text: ['Jennie smiles. "Charming." (+1 gem)'], effects: { gems: player.gems + 1 }, globalNews: `${player.display_name} impressed Jennie in the forest.` };
            case 'BABE':
                return { text: ['She laughs and gives you fresh courage. (+1 forest fight)'], effects: { turns_forest_left: player.turns_forest_left + 1 }, globalNews: `${player.display_name} caught Jennie\'s favor and gained a forest fight.` };
            case 'SEXY':
                return { text: ['She blows a kiss and battlelust rises. (+1 PvP fight)'], effects: { turns_pvp_left: player.turns_pvp_left + 1 }, globalNews: `${player.display_name} charmed Jennie and gained a PvP fight.` };
            case 'LADY':
                return { text: [`She nods like a queen. (+${player.level * 1000} gold)`], effects: { gold_on_hand: player.gold_on_hand + player.level * 1000 }, globalNews: `${player.display_name} earned Jennie\'s rich reward.` };
            case 'HOTT':
                return {
                    text: ['Jennie traces a rune over your heart. (+15% max HP)'],
                    effects: { hp_max: Math.max(player.hp_max + 1, Math.floor(player.hp_max * 1.15)), hp: Math.max(player.hp, Math.floor(player.hp_max * 1.15)) },
                    globalNews: `${player.display_name} was empowered by Jennie.`
                };
            case 'DUNG':
                return { text: ['Jennie gasps. You are turned into a frog and lose your next chance to hunt.'], effects: { turns_forest_left: Math.max(0, player.turns_forest_left - 1) }, globalNews: `${player.display_name} insulted Jennie and was transformed into a frog.` };
            case 'UGLY':
                return { text: ['Her eyes flash green. Your body crumples. (HP set to 2)'], effects: { hp: 2 }, globalNews: `${player.display_name} offended Jennie and paid dearly.` };
            default:
                return { text: ['Jennie shrugs. "I expected better." Nothing happens.'] };
        }
    }
};
