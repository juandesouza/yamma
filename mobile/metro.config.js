const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;

const config = getDefaultConfig(projectRoot);

const reactNativeRoot = path.dirname(
  require.resolve('react-native/package.json', { paths: [projectRoot] }),
);
const reactNativeSvgRoot = path.dirname(
  require.resolve('react-native-svg/package.json', { paths: [projectRoot] }),
);
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  'react-native': reactNativeRoot,
  /** Must match Expo Go’s embedded native SVG; workspace peers can otherwise pull a newer JS-only copy. */
  'react-native-svg': reactNativeSvgRoot,
};

/**
 * One physical React instance for the whole bundle. pnpm workspaces can otherwise
 * resolve `react` / `react/jsx-runtime` to different realpaths (same version, duplicate
 * module graph) → "React Element from an older version of React".
 */
function isReactCoreModule(moduleName) {
  return (
    moduleName === 'react' ||
    moduleName === 'react/jsx-runtime' ||
    moduleName === 'react/jsx-dev-runtime' ||
    (moduleName.startsWith('react/') && !moduleName.startsWith('react-native'))
  );
}

const upstreamResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (isReactCoreModule(moduleName)) {
    try {
      const filePath = require.resolve(moduleName, { paths: [projectRoot] });
      return { type: 'sourceFile', filePath };
    } catch {
      /* fall through */
    }
  }
  if (typeof upstreamResolveRequest === 'function') {
    return upstreamResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
