import { ForestEventEngine } from '../events/forestEventEngine.js';
import { deadBirdRescueEvent } from '../events/events/deadBirdRescue.js';
import { fairiesEvent } from '../events/events/fairies.js';
import { jennieEvent } from '../events/events/jennie.js';
import { oldManEvent } from '../events/events/oldMan.js';
import { oldWitchEvent } from '../events/events/oldWitch.js';
import { mysticalGuessingEvent } from '../events/events/mysticalGuessing.js';
const engineEvents = [fairiesEvent, oldManEvent, oldWitchEvent, deadBirdRescueEvent, jennieEvent, mysticalGuessingEvent];
export class ForestEventService {
    rng;
    engine;
    constructor(rng = Math.random) {
        this.rng = rng;
        this.engine = new ForestEventEngine(engineEvents, rng);
    }
    rollEvent(player) {
        const event = this.engine.pickEvent(player);
        const result = this.engine.execute(event, player, {});
        return this.toEncounter(event.id, result);
    }
    resolveChoice(encounter, player, rawChoice, rawTextInput) {
        const event = this.engine.getEvent(encounter.key);
        if (!event) {
            return { text: 'Nothing happens.', patch: {} };
        }
        const result = this.engine.execute(event, player, {
            choice: rawChoice,
            textInput: rawTextInput,
            payload: encounter.payload
        });
        return this.toOutcome(result);
    }
    toEncounter(key, result) {
        const choiceText = result.choices?.map((choice) => `(${choice.key}) ${choice.label}`).join('  ');
        return {
            key,
            text: result.text.join(' '),
            choices: choiceText,
            payload: result.payload,
            promptField: result.promptField
        };
    }
    toOutcome(result) {
        return {
            text: result.text.join(' '),
            patch: result.effects ?? {},
            globalNews: result.globalNews,
            personalNews: result.personalNews,
            keepOpen: result.keepOpen,
            promptField: result.promptField
        };
    }
}
