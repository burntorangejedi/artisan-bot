

// DEBUG_LEVEL: 'none', 'debug', or 'verbose'
const DEBUG_LEVEL = (process.env.DEBUG_LEVEL || 'none').toLowerCase();

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