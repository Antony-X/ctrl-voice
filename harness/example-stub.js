// Minimal stub for the harness preload. See README.md for the full format.
module.exports = {
  invoke: {
    'settings:get': () => ({}),
    'messages:list': () => [],
  },
  onSend(channel, ...args) {},
  events: [],
};
