let busy = false;

function isBusy() {
  return busy;
}

function setBusy(val) {
  busy = val;
}

module.exports = { isBusy, setBusy };