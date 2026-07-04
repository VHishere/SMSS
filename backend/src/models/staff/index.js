const overview = require("./overview");
const students = require("./students");
const parents = require("./parents");
const teachers = require("./teachers");
const lookups = require("./lookups");
const schoolYears = require("./schoolYears");
const classes = require("./classes");
const promotion = require("./promotion");
const curriculum = require("./curriculum");
const yearSchedule = require("./yearSchedule");

module.exports = {
  ...overview,
  ...students,
  ...parents,
  ...teachers,
  ...lookups,
  ...schoolYears,
  ...classes,
  ...promotion,
  ...curriculum,
  ...yearSchedule,
};
