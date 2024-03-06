# Tl;DR

This reproduces the problem that in `.gts` files, conflicting or redundant
`eslint:recommended` rules, such as `getter-return`, are not disabled.

```js
// Minimal .eslintrc.js
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
```

```ts
// foo.ts – eslint passes
export default class Foo {
  get foo(): true | undefined {
    if (Math.random() > 0.5) {
      return true;
    }
  }
}
```

```ts
// foo.gts – exactly the same file, only different extension, eslint fails
export default class Foo {
  // error: Expected getter 'foo' to always return a value (getter-return)
  get foo(): true | undefined {
    if (Math.random() > 0.5) {
      return true;
    }
  }
}
```

## Background

Ember uses [`.gjs` and `.gts` files][1] for single-file components. It has a
small piece of syntax extension (`<template>...</template>`) to JS/TS that
requires a different parser ([`ember-eslint-parser`][2]), which is configured
here. It does a small amount of pre-processing to remove the custom syntax
extension and then subsequently delegates to `@typescript/eslint-parser`.

**However**, `.gjs` and `.gts` are a strict superset of JS/TS syntax, and as
long as you don't use the custom syntax extension, they behave identically. In
other words, any valid `.js`/`.ts` files are a valid `.gjs`/`.gts` file.

**I don't believe the issue here has to do with the parser/parsing, so these
should ultimately be irrelevant for this discussion.** The examples in this
reproduction are simultaneously legal TS/GTS code (should be parsable with the
stock parser if you force it).

[1]: https://github.com/emberjs/rfcs/blob/master/text/0779-first-class-component-templates.md
[2]: https://github.com/NullVoxPopuli/ember-eslint-parser

## The Issue

The issue is that the [`@typescript-eslint/eslint-recommended` config][3] has a
hardcoded list of file extensions:

```ts
/**
 * This is a compatibility ruleset that:
 * - disables rules from eslint:recommended which are already handled by TypeScript.
 * - enables rules that make sense due to TS's typechecking / transpilation.
 */
import type { ClassicConfig } from "@typescript-eslint/utils/ts-eslint";

export = {
  overrides: [
    {
      files: ["*.ts", "*.tsx", "*.mts", "*.cts"],
      rules: {
        "constructor-super": "off", // ts(2335) & ts(2377)
        "getter-return": "off", // ts(2378)
        "no-const-assign": "off", // ts(2588)
        "no-dupe-args": "off", // ts(2300)
        "no-dupe-class-members": "off", // ts(2393) & ts(2300)
        "no-dupe-keys": "off", // ts(1117)
        "no-func-assign": "off", // ts(2630)
        "no-import-assign": "off", // ts(2632) & ts(2540)
        "no-new-symbol": "off", // ts(7009)
        "no-obj-calls": "off", // ts(2349)
        "no-redeclare": "off", // ts(2451)
        "no-setter-return": "off", // ts(2408)
        "no-this-before-super": "off", // ts(2376) & ts(17009)
        "no-undef": "off", // ts(2304) & ts(2552)
        "no-unreachable": "off", // ts(7027)
        "no-unsafe-negation": "off", // ts(2365) & ts(2322) & ts(2358)
        "no-var": "error", // ts transpiles let/const to var, so no need for vars any more
        "prefer-const": "error", // ts provides better types with const
        "prefer-rest-params": "error", // ts provides better types with rest args over arguments
        "prefer-spread": "error", // ts transpiles spread to apply, so no need for manual apply
      },
    },
  ],
} satisfies ClassicConfig.Config;
```

Linking/embedding the version from v6.21.0 here, because the work to support
flat config obfuscated the code/problem but I think they fundamentally suffer
the same issue.

I gathered that the intention here is to make the kind of simple/minimal legacy
config (like the snippet I had at the top) Just Work™ – it will turn off the
conflicting rules for TypeScript files but leave it alone for JavaScript files.

But suppose you do this instead:

```js
module.exports = {
  root: true,
  overrides: [
    {
      files: ["*.ts", "*.gts"],
      parser: "ember-eslint-parser",
      plugins: ["ember", "@typescript-eslint"],
      extends: [
        // Enables the `getter-return` rule
        "eslint:recommended",

        // Disables the `getter-return` rule
        "plugin:@typescript-eslint/eslint-recommended",
      ],
    },
  ],
};
```

The intention here seems pretty straightforward – to apply the same set of
rules to both `.ts` and `.gts` files. It looks like the should work, but it
still doesn't. Because the config being extended has `files` included in it
the portion of the rules ended up only applying to `.ts` files but not for
`.gts` files.

More bizarrely, if you extend from `plugin:@typescript-eslint/recommended`
or similar (either _instead_ or _in addition to_ `@ts-e/eslint-recommended`),
those additional TypeScript-specific rules _are_ applied to both types of
files, because [it does not include a file list][4], but the portion that
happens to be defined in `@ts-e/eslint-recommended` are still excluded for
`.gts` files.

[3]: https://github.com/typescript-eslint/typescript-eslint/blob/v6.21.0/packages/eslint-plugin/src/configs/eslint-recommended.ts#L11
[4]: https://github.com/typescript-eslint/typescript-eslint/blob/v6.21.0/packages/eslint-plugin/src/configs/recommended.ts

## Flat Config?

I think flat configs fundamentally have the same problem, but I suppose because
it is "Just JavaScript" you can "fix" it.

## Conclusions

Not sure how to coordinate/workaround this problem, other than duplicating
the set of rules in `@ts-e/eslint-recommended` _somewhere_ (either in the
application `.eslintrc.js`, or as `plugin:ember/gte-slint-recommendeds` etc).
