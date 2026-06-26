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
    // Coverage is collected across both projects (run with --coverage) so the
    // integration HTTP flows count towards the service numbers too.
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/generated/**', // Prisma's generated client — not our code
        'src/**/*.spec.ts',
        'src/**/dto/**',
        'src/**/*.dto.ts',
        'src/**/*.entity.ts',
        'src/**/*.module.ts',
        'src/**/*.events.ts',
        'src/**/*.constants.ts',
        'src/**/index.ts',
        'src/main.ts',
        'src/test-setup.integration.ts',
        'src/config/**', // env schema, wired at boot
        'src/**/data/**', // bundled JSON typings
      ],
      thresholds: {
        // Overall floor for the whole API (certification target: 60%).
        lines: 60,
        statements: 60,
        functions: 60,
        branches: 60,
        // Services carry the business logic, so they're held to 80%.
        'src/**/*.service.ts': {
          lines: 80,
          statements: 80,
          functions: 80,
          branches: 75,
        },
      },
    },
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
