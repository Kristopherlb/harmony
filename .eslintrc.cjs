module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier",
  ],
  overrides: [
    {
      files: ["packages/capabilities/**/*.ts"],
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
        ],
      },
    },
    {
      files: ["packages/blueprints/**/*.ts"],
      rules: {
        "no-restricted-syntax": [
          "error",
          {
            selector:
              "ClassDeclaration:not(:has(PropertyDefinition[key.name='metadata']))",
            message: "WCS Blueprints must include a 'metadata' property.",
          },
        ],
      },
    },
  ],
  ignorePatterns: ["dist", "node_modules", "*.config.js", "*.config.mjs", "*.config.cjs", "*.config.ts"],
};
