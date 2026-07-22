const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the shared package source for live updates (preserve Expo defaults)
config.watchFolders = [monorepoRoot, ...config.watchFolders];

// Ensure Metro resolves node_modules from both mobile and monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Let Metro resolve .ts/.tsx source files when following symlinks into workspace packages
config.resolver.sourceExts = [...(config.resolver.sourceExts || []), 'mjs'];

// Resolve the shared package to its dist (compiled) output, not source
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Redirect @pantryai/shared imports to the compiled dist
  if (moduleName === '@pantryai/shared') {
    return {
      filePath: path.resolve(monorepoRoot, 'packages/shared/dist/index.js'),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
