/* eslint-env node */

module.exports = {
  root: true,
  parser: "ember-eslint-parser",
  plugins: ["ember", "@typescript-eslint"],
  extends: [
    // Enables the `getter-return` rule
    "eslint:recommended",

    // Disables the `getter-return` rule
    "plugin:@typescript-eslint/eslint-recommended",
  ],
};
