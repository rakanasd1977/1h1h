const { db, run, all, get } = require('../index');

module.exports = {
  name: "028_sold_counters_demo",
  up: () => {
    const { seedSoldCountersDemo } = require('../migrate');
    seedSoldCountersDemo();
  },
};
