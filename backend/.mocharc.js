"use strict";

// This is a JavaScript-based config file containing every Mocha option plus others.
// If you need conditional logic, you might want to use this type of config,
// e.g. set options via environment variables 'process.env'.
// Otherwise, JSON or YAML is recommended.

module.exports = {
  color: true,
  delay: false,
  diff: true,
  exit: false,
  package: "./package.json",
  parallel: false,
  recursive: true,
  timeout: "100000", // same as "timeout: '2s'"
  // timeout: false, // same as "timeout: 0"
  "trace-warnings": true, // node flags ok
  watch: false,
  "watch-files": ["lib/**/*.js", "test/**/*.js"],
};
