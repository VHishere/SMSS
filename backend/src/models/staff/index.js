const overview = require("./overview");
const students = require("./students");
const parents = require("./parents");
const lookups = require("./lookups");
const schoolYears = require("./schoolYears");
const classes = require("./classes");
const promotion = require("./promotion");

module.exports = {
  ...overview,
  ...students,
  ...parents,
  ...lookups,
  ...schoolYears,
  ...classes,
  ...promotion,
};
