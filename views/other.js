module.exports = {
  async get() {
    return {
      igms: [
        { id: 'forest', name: 'Forest', desc: 'Venture forth to battle creatures of the wild.' },
        { id: 'fields', name: 'Fields', desc: 'Seek foes in the fields for PvP glory.' },
        { id: 'clan', name: 'Clan Halls', desc: 'Meet and manage your clan.' },
      ],
    };
  },
};
