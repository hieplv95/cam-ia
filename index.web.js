// Skia's web build reads global.CanvasKit when its module is first evaluated,
// so CanvasKit (WebAssembly) must finish loading before any route is imported.
import '@expo/metro-runtime';
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

// The version in the URL lets browsers keep public/canvaskit.wasm (8 MB) for a year (see server.cjs): change it
// together with the file whenever the canvaskit-wasm package is upgraded.
const CANVASKIT_VERSION = '0.40.0';

LoadSkiaWeb({ locateFile: (file) => (file === 'canvaskit.wasm' ? `/canvaskit.wasm?v=${CANVASKIT_VERSION}` : `/${file}`) }).then(() => {
  const { App } = require('expo-router/build/qualified-entry');
  const { renderRootComponent } = require('expo-router/build/renderRootComponent');
  renderRootComponent(App);
});
