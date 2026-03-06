let nextSessionId = 1;
export function createSession() {
    return {
        id: `s-${Date.now()}-${nextSessionId++}`,
        cols: 80,
        rows: 25,
        state: 'WELCOME',
        mode: 'MENU',
        inputBuffer: '',
        prompt: null,
        notice: '',
        draft: {},
        dailyNews: [],
        dailyNewsOffset: 0,
        dailyNewsHasMore: false,
        bankState: 'MENU',
        healerState: 'MENU'
    };
}
export function setScreen(session, state) {
    if (session.state !== state) {
        session.previousScreenId = session.state;
    }
    session.state = state;
    if (state !== 'OTHER_PLACES_MODULE') {
        session.otherPlacesModuleId = undefined;
    }
    session.mode = 'MENU';
    session.inputBuffer = '';
    session.prompt = null;
    session.bankState = 'MENU';
    session.healerState = 'MENU';
}
export function startPrompt(session, field, hidden = false) {
    session.mode = 'TEXT_ENTRY';
    session.prompt = { field, hidden };
    session.inputBuffer = '';
}
export function commitPrompt(session) {
    const value = session.inputBuffer.trim();
    session.inputBuffer = '';
    session.mode = 'MENU';
    session.prompt = null;
    session.bankState = 'MENU';
    session.healerState = 'MENU';
    return value;
}
export function resetDraft(session) {
    session.draft = {};
}
