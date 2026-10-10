import { findPreset } from '../develop/customPresets';
import { colorSliders, detailSliders, hslRanges, lightSliders, type Develop } from '../develop/types';
import { filterName } from './filters';
import { frames } from './frames';
import type { Doc, Layer } from './types';
import { t, type MessageKey } from '../i18n';

/** Readable names for the history list ("Phơi sáng +20", "Thêm sticker"…). */
const sliderLabels: Record<string, MessageKey> = Object.fromEntries([
  ...lightSliders.map((s) => [`light.${s.key}`, s.label]),
  ...colorSliders.map((s) => [`color.${s.key}`, s.label]),
  ...detailSliders.map((s) => [`detail.${s.key}`, s.label]),
  ...(['smooth', 'brighten', 'rosy', 'even', 'glow', 'detail'] as const).map((k) => [`beauty.${k}`, `beauty.${k}`]),
]);

const capitalized: Record<Layer['kind'], 'Sticker' | 'Text' | 'Stroke' | 'Retouch'> = { sticker: 'Sticker', text: 'Text', stroke: 'Stroke', retouch: 'Retouch' };

const layerLabel = (l: Layer) =>
  l.kind === 'retouch' ? t(l.effect === 'whiten' ? 'history.whiten' : 'history.lighten') : l.kind === 'stroke' ? t('history.draw') : t(l.kind === 'text' ? 'history.addText' : 'history.addSticker');

const signed = (v: number) => (v > 0 ? `+${v}` : `${v}`);

function describeDevelop(a: Develop, b: Develop): string | null {
  const changes: string[] = [];
  for (const group of ['light', 'color', 'detail', 'beauty'] as const) {
    for (const [key, v] of Object.entries(b[group])) {
      const before = (a[group] as Record<string, number>)[key];
      const label = sliderLabels[`${group}.${key}`];
      if (before !== v) changes.push(`${label ? t(label) : key} ${group === 'beauty' ? v : signed(v)}`);
    }
  }
  if (JSON.stringify(a.curves) !== JSON.stringify(b.curves)) changes.push(t('history.curves'));
  for (const r of hslRanges) if (JSON.stringify(a.hsl[r.id]) !== JSON.stringify(b.hsl[r.id])) changes.push(`HSL · ${t(r.label)}`);
  if (a.look !== b.look) changes.push(t('history.look', { name: filterName(b.look) }));
  if (!changes.length) return null;
  return changes.length === 1 ? changes[0] : changes.length <= 2 ? changes.join(', ') : t('history.manyChanges', { n: changes.length });
}

/** What changed between two consecutive history states, or null when nothing visible did. */
export function describeChange(a: Doc, b: Doc): string | null {
  if (a.image !== b.image) return b.step ?? t('history.newImage');
  if (a.preset?.id !== b.preset?.id) return b.preset ? t('history.filter', { name: findPreset(b.preset.id)?.name ?? b.preset.id }) : t('history.noFilter');
  if (b.preset && a.preset?.intensity !== b.preset.intensity) return t('history.filterIntensity', { n: b.preset.intensity });
  if (a.frame !== b.frame) {
    const frame = frames.find((f) => f.id === b.frame);
    return t('history.frame', { name: frame ? t(frame.label) : b.frame });
  }
  if (a.layers !== b.layers) {
    if (b.layers.length > a.layers.length) return layerLabel(b.layers[b.layers.length - 1]);
    if (b.layers.length < a.layers.length) {
      const removed = a.layers.find((l) => !b.layers.some((x) => x.id === l.id));
      return removed ? t(`history.remove${capitalized[removed.kind]}` as MessageKey) : t('history.removeLayer');
    }
    const changed = b.layers.find((l, i) => l !== a.layers[i]);
    if (changed) return changed.kind === 'text' ? t('history.editText') : t(`history.move${capitalized[changed.kind]}` as MessageKey);
  }
  return describeDevelop(a.develop, b.develop);
}
