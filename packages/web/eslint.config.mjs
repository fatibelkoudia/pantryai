import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

// Next.js 16 removed `next lint`; ESLint 9 flat config is the supported path.
// `core-web-vitals` already bundles the Next base config; `typescript` is standalone.
const config = [
  { ignores: ['.next/**', 'dist/**', 'node_modules/**'] },
  ...nextCoreWebVitals,
  ...nextTypeScript,
];

export default config;
