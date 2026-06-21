import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Transform with SWC so decorator metadata (design:paramtypes) ends up in the test build.
// Vitest's normal esbuild transform leaves it out, and then Nest can't do constructor
// injection in tests. Heads up: with `projects` you have to set the plugin on each project,
// putting it at the top level does not reach the project configs.
const swcPlugin = swc.vite({
  module: { type: 'es6' },
  jsc: {
    parser: { syntax: 'typescript', decorators: true },
    transform: { legacyDecorator: true, decoratorMetadata: true },
    target: 'es2022',
  },
});

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [swcPlugin],
        test: {
          name: 'unit',
          include: ['src/**/*.spec.ts'],
          exclude: ['src/**/*.integration.spec.ts'],
        },
      },
      {
        plugins: [swcPlugin],
        test: {
          name: 'integration',
          include: ['src/**/*.integration.spec.ts'],
          setupFiles: ['src/test-setup.integration.ts'],
          testTimeout: 30_000,
          sequence: { concurrent: false },
          // Integration tests use one real DB.
          // Keep them in a single fork to avoid data clashes between files.
          pool: 'forks',
          poolOptions: { forks: { singleFork: true } },
        },
      },
    ],
  },
});
