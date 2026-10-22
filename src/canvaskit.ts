// The version in the URL lets browsers keep public/canvaskit.wasm (8 MB) for a year (see server.cjs): change it
// together with the file whenever the canvaskit-wasm package is upgraded.
export const CANVASKIT_URL = '/canvaskit.wasm?v=0.40.0';
