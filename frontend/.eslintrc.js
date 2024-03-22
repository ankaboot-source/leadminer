module.exports = {
  root: true,
  extends: ["@nuxt/eslint-config", "airbnb-base", "prettier"],
  rules: {
    radix: "off",
    "no-void": "off",
    "no-undef": "off",
    "no-shadow": "off",
    "no-console": "error",
    "no-unused-vars": "off",
    "no-param-reassign": "off",
    "no-nested-ternary": "off",
    "no-underscore-dangle": "off",

    "@typescript-eslint/no-shadow": "error",
    "@typescript-eslint/no-var-requires": "off",
    "@typescript-eslint/explicit-function-return-type": "off",

    "max-classes-per-file": "off",

    "vue/multi-word-component-names": "off",

    "import/first": "off",
    "import/named": "error",
    "import/namespace": "error",
    "import/default": "error",
    "import/export": "error",
    "import/extensions": "off",
    "import/no-unresolved": "off",
    "import/no-extraneous-dependencies": "off",
    "import/prefer-default-export": "off",

    "prefer-destructuring": ["error", { object: true, array: false }],

    "no-debugger": process.env.NODE_ENV === "production" ? "error" : "off",
  },
};
