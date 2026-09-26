const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.transformer = {
  ...config.transformer,
  getTransformOptions: async () => ({
    transform: {
      inlineRequires: true,
      experimentalImportSupport: false,
    },
  }),
};

// react-native-svg's package entry is its TypeScript source. On iOS, Metro
// fails to resolve the extensionless ./fabric directory import from that file.
const svgFabric = path.join(__dirname, 'node_modules', 'react-native-svg', 'src', 'fabric', 'index.ts');
const previousResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === './fabric' &&
    context.originModulePath &&
    context.originModulePath.includes(`${path.sep}react-native-svg${path.sep}src${path.sep}ReactNativeSVG.ts`)
  ) {
    return { filePath: svgFabric, type: 'sourceFile' };
  }
  if (previousResolveRequest) {
    return previousResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
