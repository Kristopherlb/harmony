/**
 * tools/path/src/generators/context-extension/factory.js
 * Nx generator entrypoint wrapper: registers ts-node and exports the TS generator.
 */
const tsNode = require('ts-node');

tsNode.register({
  transpileOnly: true,
  compilerOptions: {
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
  },
});

// eslint-disable-next-line @typescript-eslint/no-var-requires -- CJS factory required by Nx plugin loader
module.exports = require('./entry.ts').default;

