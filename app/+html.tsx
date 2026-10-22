import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

import { CANVASKIT_URL } from '@/src/canvaskit';

/** The web page around the app (Expo's default) plus an early start on downloading Skia's engine. */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        {/* Fetched together with the app's code instead of after it has run (index.web.js asks for the same URL). */}
        <link rel="preload" href={CANVASKIT_URL} as="fetch" type="application/wasm" crossOrigin="anonymous" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
