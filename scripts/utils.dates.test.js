const assert = require('node:assert/strict');

const {
  formatDate,
  getCurrentWeekDateRange,
  getPreviousWeekDateRange,
  getDateRangeForMode,
} = require('./utils.dates');

const tuesday = new Date('2026-09-22T12:00:00');
const monday = new Date('2026-09-21T12:00:00');

assert.equal(formatDate(tuesday), '22/09/2026');
assert.equal(formatDate(new Date('2026-09-14T12:00:00')), '14/09/2026');

const rencontresRange = getCurrentWeekDateRange(tuesday);
assert.equal(formatDate(rencontresRange.start), '21/09/2026');
assert.equal(formatDate(rencontresRange.end), '27/09/2026');

const previousRange = getPreviousWeekDateRange(tuesday);
assert.equal(formatDate(previousRange.start), '14/09/2026');
assert.equal(formatDate(previousRange.end), '20/09/2026');

const mondayRencontres = getDateRangeForMode('rencontres', monday);
assert.equal(formatDate(mondayRencontres.start), '14/09/2026');
assert.equal(formatDate(mondayRencontres.end), '20/09/2026');

console.log('date utils tests: OK');
