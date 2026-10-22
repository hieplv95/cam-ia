import '@expo/metro-runtime';
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

import { CANVASKIT_URL } from './src/canvaskit';

// Skia's engine (CanvasKit, WebAssembly) loads next to the app instead of before it: the home screen and the other
// screens without Skia are usable at once, and screens that draw with Skia wait for it (src/skia.tsx).
globalThis.__skiaReady = LoadSkiaWeb({ locateFile: (file) => (file === 'canvaskit.wasm' ? CANVASKIT_URL : `/${file}`) });

const { App } = require('expo-router/build/qualified-entry');
const { renderRootComponent } = require('expo-router/build/renderRootComponent');
renderRootComponent(App);
