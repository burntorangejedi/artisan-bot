

// DEBUG_LEVEL: 'none', 'debug', or 'verbose'
const settings = require('../settings');
const DEBUG_LEVEL = settings.DEBUG_LEVEL;

function log(...args) {
  if (DEBUG_LEVEL === 'debug' || DEBUG_LEVEL === 'verbose') {
    const formatted = args.map(arg =>
      typeof arg === 'object'
        ? JSON.stringify(arg, null, 2)
        : arg
    );
    console.log('[DEBUG]', ...formatted);
  }
}

function verbose(...args) {
  if (DEBUG_LEVEL === 'verbose') {
    const formatted = args.map(arg =>
      typeof arg === 'object'
        ? JSON.stringify(arg, null, 2)
        : arg
    );
    console.log('[VERBOSE]', ...formatted);
  }
}

module.exports = {
  isDebug: () => DEBUG_LEVEL === 'debug' || DEBUG_LEVEL === 'verbose',
  isVerbose: () => DEBUG_LEVEL === 'verbose',
  log: log,
  verbose: verbose
};