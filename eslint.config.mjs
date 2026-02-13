import tsParser from "@typescript-eslint/parser";
import tseslint from "@typescript-eslint/eslint-plugin";

export default [
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: { "@typescript-eslint": tseslint },
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module" },
      globals: {},
    },
  },
  {
    files: ["packages/capabilities/**/*.ts"],
    languageOptions: {
      parser: tsParser,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > ObjectExpression:not(:has(> Property[key.name='metadata']))",
          message:
            "OCS Capabilities must define a 'metadata' block for registry discovery.",
        },
        {
          selector: "TemplateLiteral Identifier[name=/^[A-Z][A-Z0-9_]+$/]",
          message:
            "Potential mixed interpolation: Are you trying to interpolate a Shell variable? If so, escape it: \\${VAR}. If this is a TS constant, ignore.",
        },
      ],
    },
  },
  {
    files: ["packages/blueprints/**/*.ts"],
    languageOptions: {
      parser: tsParser,
    },
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "ClassDeclaration:not(:has(PropertyDefinition[key.name='metadata']))",
          message: "WCS Blueprints must include a 'metadata' property.",
        },
        {
          selector: "MemberExpression[object.name='Date']",
          message: "WCS determinism: use this.now() from BaseBlueprint instead of Date.",
        },
        {
          selector: "NewExpression[callee.name='Date']",
          message: "WCS determinism: do not use new Date() in workflow code.",
        },
        {
          selector: "MemberExpression[object.name='Math'][property.name='random']",
          message: "WCS determinism: use this.uuid() or this.now() from BaseBlueprint instead of Math.random().",
        },
        {
          selector: "CallExpression[callee.name='setTimeout']",
          message: "WCS determinism: use this.sleep(ms) from BaseBlueprint instead of setTimeout.",
        },
      ],
    },
  },
  {
    files: ["packages/apps/console/server/**/*.ts"],
    languageOptions: {
      parser: tsParser,
    },
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "ImportDeclaration[source.value=/^@golden\\//] > ImportDefaultSpecifier",
          message:
            "Avoid default imports from internal workspace packages (@golden/*). Use namespace imports (import * as pkg from '@golden/pkg') to avoid ESM interop pitfalls.",
        },
      ],
    },
  },
];
