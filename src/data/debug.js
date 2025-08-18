let debug = false;

function debugLog(...args) {
  if (debug) {
    const formatted = args.map(arg =>
      typeof arg === 'object'
        ? JSON.stringify(arg, null, 2)
        : arg
    );
    console.log('[DEBUG]', ...formatted);
  }
}

module.exports = {
  isDebug: () => debug,
  setDebug: (val) => { debug = val; },
  debugLog
};