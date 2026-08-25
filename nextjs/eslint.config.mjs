import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import mantine from "eslint-config-mantine";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";

// Flat config allows the same plugin name in two configs only when both point at
// the identical object. eslint-plugin-jsx-a11y's own flatConfigs export
// registers a trimmed { meta, rules } object rather than the module itself, so
// Mantine's copy collides with the full module Next registers.
//
// Substitute Next's object wherever the names overlap. Deleting Mantine's
// registration instead would leave gaps: both configs scope their registrations
// to specific file globs (Next's @typescript-eslint and jsx-a11y among them),
// while Mantine applies its rules globally, so each config's registration
// covers files the other's does not.
const nextPlugins = new Map(
  nextCoreWebVitals.flatMap((config) => Object.entries(config.plugins ?? {})),
);

const withDedupedPlugins = mantine.map((config) => {
  if (!config.plugins) {
    return config;
  }

  const plugins = Object.fromEntries(
    Object.entries(config.plugins).map(([name, plugin]) => [
      name,
      nextPlugins.get(name) ?? plugin,
    ]),
  );

  return { ...config, plugins };
});

const eslintConfig = defineConfig([
  // Next.js is flat-config native as of eslint-config-next v16, so no
  // FlatCompat/fixupConfigRules shim. core-web-vitals already pulls in the
  // base "next" and "next/typescript" configs.
  ...nextCoreWebVitals,

  ...withDedupedPlugins,

  // Must stay last: turns off stylistic rules that conflict with Prettier.
  eslintPluginPrettierRecommended,

  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
