

// DEBUG_LEVEL enum: use one of DEBUG_LEVELS.NONE, DEBUG_LEVELS.LOG, DEBUG_LEVELS.VERBOSE
const settings = require('../settings');
const DEBUG_LEVELS = Object.freeze({
  NONE: 'none',
  LOG: 'log',
  VERBOSE: 'verbose'
});

// Read current debug level dynamically so changes to env or settings during development are reflected
function getDebugLevel() {
  return (settings.DEBUG_LEVEL || DEBUG_LEVELS.NONE).toLowerCase();
}

function log(...args) {
  const DEBUG_LEVEL = getDebugLevel();
  if (DEBUG_LEVEL === DEBUG_LEVELS.LOG || DEBUG_LEVEL === DEBUG_LEVELS.VERBOSE) {
    const formatted = args.map(arg =>
      typeof arg === 'object'
        ? JSON.stringify(arg, null, 2)
        : arg
    );
    console.log('[DEBUG]', ...formatted);
  }
}

function verbose(...args) {
  const DEBUG_LEVEL = getDebugLevel();
  if (DEBUG_LEVEL === DEBUG_LEVELS.VERBOSE) {
    const formatted = args.map(arg =>
      typeof arg === 'object'
        ? JSON.stringify(arg, null, 2)
        : arg
    );
    console.log('[VERBOSE]', ...formatted);
  }
}

function error(...args) {
  const DEBUG_LEVEL = getDebugLevel();
  if (DEBUG_LEVEL === DEBUG_LEVELS.LOG || DEBUG_LEVEL === DEBUG_LEVELS.VERBOSE) {
    const formatted = args.map(arg =>
      typeof arg === 'object'
        ? JSON.stringify(arg, null, 2)
        : arg
    );
    console.error('[ERROR]', ...formatted);
  }
}

function warn(...args) {
  const formatted = args.map(arg =>
    typeof arg === 'object'
      ? JSON.stringify(arg, null, 2)
      : arg
  );
  console.warn('[WARN]', ...formatted);
}

module.exports = {
  DEBUG_LEVELS,
  // helpers that read the current level dynamically
  isDebug: () => {
    const level = getDebugLevel();
    return level === DEBUG_LEVELS.LOG || level === DEBUG_LEVELS.VERBOSE;
  },
  isVerbose: () => getDebugLevel() === DEBUG_LEVELS.VERBOSE,
  getDebugLevel,
  log: log,
  verbose: verbose,
  error: error,
  warn: warn
};