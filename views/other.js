module.exports = {
  async get(ctx) {
    const character = ctx.getCurrentCharacter();

    return {
      id: 'other',
      title: 'Curiosities & Oddities',
      character,
      description:
        'Miscellaneous services, seasonal festivities, and mysterious merchants rotate through this corner of town.',
      offerings: [
        { name: 'Traveling Scribe', detail: 'Records your exploits for posterity.' },
        { name: 'Fortune Teller', detail: 'Peeks into possible futures.' },
        { name: 'Festival Organizer', detail: 'Plans grand events celebrating local heroes.' },
      ],
    };
  },
};
