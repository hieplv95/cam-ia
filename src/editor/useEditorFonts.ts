import { useFont } from '@shopify/react-native-skia';
import { useMemo } from 'react';

import { BASE_FONT_SIZE } from './Scene';
import { fontInfo, type EditorFonts } from './text';

/** Every text font, loaded by Skia at BASE_FONT_SIZE (one hook call per font, always in the same order). */
export function useEditorFonts(): EditorFonts {
  const baloo = useFont(fontInfo('baloo').file, BASE_FONT_SIZE);
  const dancing = useFont(fontInfo('dancing').file, BASE_FONT_SIZE);
  const vibes = useFont(fontInfo('vibes').file, BASE_FONT_SIZE);
  const pacifico = useFont(fontInfo('pacifico').file, BASE_FONT_SIZE);
  const lobster = useFont(fontInfo('lobster').file, BASE_FONT_SIZE);
  const playfair = useFont(fontInfo('playfair').file, BASE_FONT_SIZE);
  const oswald = useFont(fontInfo('oswald').file, BASE_FONT_SIZE);
  const hand = useFont(fontInfo('hand').file, BASE_FONT_SIZE);
  return useMemo(
    () => ({ baloo, dancing, vibes, pacifico, lobster, playfair, oswald, hand }),
    [baloo, dancing, vibes, pacifico, lobster, playfair, oswald, hand],
  );
}
