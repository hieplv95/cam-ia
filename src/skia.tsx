import { useSyncExternalStore, type ComponentType } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';

import { colors } from './theme';

/**
 * On the web, Skia's engine (CanvasKit, about 8 MB) loads in the background (index.web.js) while the first screen is
 * already usable; on phones it is built in. Skia keeps whatever engine exists when '@shopify/react-native-skia' is first
 * imported, so no module importing it may run before the engine has loaded: screens that draw with Skia live in
 * src/screens/ and their route files open them through skiaScreen().
 */
type SkiaGlobal = { CanvasKit?: unknown; __skiaReady?: Promise<unknown> };
const g = globalThis as SkiaGlobal;

export const isSkiaReady = () => Platform.OS !== 'web' || !!g.CanvasKit;

/** Resolves once Skia can be used. */
export const skiaReady: Promise<void> = isSkiaReady() ? Promise.resolve() : Promise.resolve(g.__skiaReady).then(() => undefined);

const subscribe = (onReady: () => void) => {
  let listening = true;
  skiaReady.then(() => listening && onReady()).catch(() => {});
  return () => {
    listening = false;
  };
};

export const useSkiaReady = () => useSyncExternalStore(subscribe, isSkiaReady, () => false);

/** A route that shows a spinner until Skia is ready, then the screen `load` returns (required only then). */
export function skiaScreen(load: () => { default: ComponentType }) {
  return function SkiaScreen() {
    if (!useSkiaReady()) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      );
    }
    const Screen = load().default;
    return <Screen />;
  };
}
