const overview = require("./overview");
const students = require("./students");
const parents = require("./parents");
const teachers = require("./teachers");
const lookups = require("./lookups");
const schoolYears = require("./schoolYears");
const classes = require("./classes");
const curriculum = require("./curriculum");
const fees = require("./fees");

module.exports = {
  ...overview,
  ...students,
  ...parents,
  ...teachers,
  ...lookups,
  ...schoolYears,
  ...classes,
  ...curriculum,
  ...fees,
};
