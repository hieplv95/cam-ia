import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { creditsLabel, useAccount } from '../account';
import { aiPresets, type AiPresetId } from '../ai/presets';
import { retouchOptions, type RetouchOptionId } from '../ai/retouch';
import { developPresets, presetCategories, type DevelopPreset, type PresetCategory } from '../develop/presets';
import type { Develop } from '../develop/types';
import { aiPresetIcons, aiPresetLabel, Icon, type IconSpec } from '../icons';
import { ModelChip } from '../ModelPicker';
import { font, paintColors } from '../theme';
import type { PenSettings } from './EditorCanvas';
import { frames, type FrameId } from './frames';
import type { TransformOp } from './imageOps';
import type { RetouchEffect } from './types';
import { stickers } from './stickers';
import { ec, EditorSlider, Pill, ToolCircle, ToolRow } from './ui';
import { HScroll } from '../HScroll';
import { useT, type MessageKey } from '../i18n';

/* ---------- Develop sliders shared by several tabs ---------- */

type Group = 'light' | 'color' | 'detail' | 'beauty';
export type DevelopKey = { group: Group; key: string; label: MessageKey; min: number; max: number; icon: IconSpec };

const dk = (group: Group, key: string, label: MessageKey, icon: IconSpec, min = -100, max = 100): DevelopKey => ({ group, key, label, min, max, icon });

export const developKeys = {
  exposure: dk('light', 'exposure', 'develop.brightness', { set: 'ion', name: 'sunny-outline' }),
  contrast: dk('light', 'contrast', 'develop.contrast', { set: 'ion', name: 'contrast-outline' }),
  highlights: dk('light', 'highlights', 'develop.highlights', { set: 'mci', name: 'brightness-7' }),
  shadows: dk('light', 'shadows', 'develop.shadows', { set: 'mci', name: 'brightness-4' }),
  whites: dk('light', 'whites', 'develop.whites', { set: 'mci', name: 'circle-outline' }),
  blacks: dk('light', 'blacks', 'develop.blacks', { set: 'mci', name: 'circle' }),
  temperature: dk('color', 'temperature', 'develop.temperature', { set: 'mci', name: 'thermometer' }),
  tint: dk('color', 'tint', 'develop.tint', { set: 'mci', name: 'eyedropper-variant' }),
  saturation: dk('color', 'saturation', 'develop.saturation', { set: 'ion', name: 'color-palette-outline' }),
  vibrance: dk('color', 'vibrance', 'develop.vibrance', { set: 'mci', name: 'water-percent' }),
  sharpness: dk('detail', 'sharpness', 'develop.sharpness', { set: 'ion', name: 'triangle-outline' }, 0, 100),
  clarity: dk('detail', 'clarity', 'develop.clarity', { set: 'mci', name: 'details' }),
  noise: dk('detail', 'noise', 'develop.noise', { set: 'mci', name: 'blur' }, 0, 100),
  vignette: dk('detail', 'vignette', 'develop.vignette', { set: 'mci', name: 'camera-iris' }),
  grain: dk('detail', 'grain', 'develop.grain', { set: 'mci', name: 'grain' }, 0, 100),
} as const;

export type DevelopKeyId = keyof typeof developKeys;

export const developValue = (d: Develop, k: DevelopKey) => (d[k.group] as Record<string, number>)[k.key];

type SliderProps = {
  develop: Develop;
  onStart: () => void;
  onDevelop: (k: DevelopKey, value: number) => void;
};

function DevelopToolPanel({
  ids,
  active,
  onActive,
  develop,
  onStart,
  onDevelop,
  extra,
}: SliderProps & { ids: DevelopKeyId[]; active: DevelopKeyId; onActive: (id: DevelopKeyId) => void; extra?: React.ReactNode }) {
  const t = useT();
  const k = developKeys[active];
  return (
    <View style={styles.col}>
      <ToolRow>
        {ids.map((id) => (
          <ToolCircle key={id} icon={developKeys[id].icon} label={t(developKeys[id].label)} active={id === active} onPress={() => onActive(id)} />
        ))}
        {extra}
      </ToolRow>
      <EditorSlider value={developValue(develop, k)} min={k.min} max={k.max} onStart={onStart} onChange={(v) => onDevelop(k, v)} />
    </View>
  );
}

/* ---------- Cơ bản ---------- */

export type BasicTool = 'crop' | 'rotate' | DevelopKeyId;

const cropOptions: { op: TransformOp; label: string }[] = [
  { op: 'square', label: '1:1' },
  { op: 'portrait', label: '4:5' },
  { op: 'classic', label: '3:4' },
  { op: 'story', label: '9:16' },
  { op: 'landscape', label: '16:9' },
];

const rotateOptions: { op: TransformOp; label: MessageKey; icon: IconSpec }[] = [
  { op: 'rotateLeft', label: 'editor.op.rotateLeft', icon: { set: 'mci', name: 'rotate-left' } },
  { op: 'rotateRight', label: 'editor.op.rotateRight', icon: { set: 'mci', name: 'rotate-right' } },
  { op: 'flip', label: 'editor.op.flip', icon: { set: 'mci', name: 'flip-horizontal' } },
  { op: 'flipV', label: 'editor.op.flipV', icon: { set: 'mci', name: 'flip-vertical' } },
];

const basicDevelop: DevelopKeyId[] = ['exposure', 'contrast', 'sharpness', 'saturation'];

export function BasicPanel({
  tool,
  onTool,
  onTransform,
  ...slider
}: SliderProps & { tool: BasicTool; onTool: (t: BasicTool) => void; onTransform: (op: TransformOp) => void }) {
  const t = useT();
  const isDevelop = tool !== 'crop' && tool !== 'rotate';
  return (
    <View style={styles.col}>
      <ToolRow>
        <ToolCircle icon={{ set: 'mci', name: 'crop' }} label={t('common.crop')} active={tool === 'crop'} onPress={() => onTool('crop')} />
        <ToolCircle icon={{ set: 'mci', name: 'crop-rotate' }} label={t('common.rotate')} active={tool === 'rotate'} onPress={() => onTool('rotate')} />
        {basicDevelop.map((id) => (
          <ToolCircle key={id} icon={developKeys[id].icon} label={t(developKeys[id].label)} active={tool === id} onPress={() => onTool(id)} />
        ))}
      </ToolRow>
      {tool === 'crop' && (
        <HScroll tone="dark" contentContainerStyle={styles.pills}>
          {cropOptions.map((c) => (
            <Pill key={c.op} label={c.label} onPress={() => onTransform(c.op)} />
          ))}
        </HScroll>
      )}
      {tool === 'rotate' && (
        <HScroll tone="dark" contentContainerStyle={styles.pills}>
          {rotateOptions.map((r) => (
            <Pill key={r.op} label={t(r.label)} icon={r.icon} onPress={() => onTransform(r.op)} />
          ))}
        </HScroll>
      )}
      {isDevelop && (
        <EditorSlider
          value={developValue(slider.develop, developKeys[tool])}
          min={developKeys[tool].min}
          max={developKeys[tool].max}
          onStart={slider.onStart}
          onChange={(v) => slider.onDevelop(developKeys[tool], v)}
        />
      )}
    </View>
  );
}

/* ---------- Điều chỉnh & Hiệu ứng ---------- */

const adjustIds: DevelopKeyId[] = ['exposure', 'contrast', 'highlights', 'shadows', 'whites', 'blacks', 'temperature', 'tint', 'saturation', 'vibrance', 'clarity'];
const effectIds: DevelopKeyId[] = ['vignette', 'grain', 'clarity', 'noise', 'sharpness'];

export function AdjustPanel(props: SliderProps & { active: DevelopKeyId; onActive: (id: DevelopKeyId) => void; onAdvanced: () => void }) {
  const t = useT();
  return (
    <DevelopToolPanel
      {...props}
      ids={adjustIds}
      extra={<ToolCircle icon={{ set: 'mci', name: 'chart-bell-curve-cumulative' }} label={t('editor.curvesHsl')} onPress={props.onAdvanced} />}
    />
  );
}

export function EffectsPanel(props: SliderProps & { active: DevelopKeyId; onActive: (id: DevelopKeyId) => void }) {
  return <DevelopToolPanel {...props} ids={effectIds} />;
}

/* ---------- Bộ lọc ---------- */

type FilterCategory = 'all' | 'mine' | PresetCategory;

export function FiltersPanel({
  thumbs,
  custom,
  preset,
  onPick,
  onIntensity,
  onStart,
  onSaveRecipe,
  onRecipeMenu,
}: {
  thumbs: Record<string, string>;
  /** The user's own recipes, shown first. */
  custom: DevelopPreset[];
  preset?: { id: string; intensity: number };
  onPick: (id: string | null) => void;
  onIntensity: (v: number) => void;
  onStart: () => void;
  /** Saves the current colors as a new recipe. */
  onSaveRecipe: () => void;
  /** Long press on one of the user's recipes (rename / delete). */
  onRecipeMenu: (p: DevelopPreset) => void;
}) {
  const t = useT();
  const [category, setCategory] = useState<FilterCategory>('all');
  const list =
    category === 'all' ? [...custom, ...developPresets] : category === 'mine' ? custom : developPresets.filter((p) => p.categories.includes(category));
  return (
    <View style={styles.col}>
      <HScroll tone="dark" contentContainerStyle={styles.pills}>
        {[{ id: 'all' as const, label: 'common.all' as const }, { id: 'mine' as const, label: 'common.mine' as const }, ...presetCategories].map((c) => (
          <Pill key={c.id} label={t(c.label)} active={category === c.id} onPress={() => setCategory(c.id)} />
        ))}
      </HScroll>
      <HScroll tone="dark" contentContainerStyle={styles.thumbRow}>
        <Pressable onPress={onSaveRecipe} style={styles.thumbItem} accessibilityLabel={t('recipe.saveTitle')}>
          <View style={[styles.thumb, styles.saveTile]}>
            <Icon icon={{ set: 'ion', name: 'add' }} size={26} color={ec.gold} />
          </View>
          <Text numberOfLines={1} style={[styles.thumbLabel, { color: ec.gold }]}>
            {t('recipe.saveThis')}
          </Text>
        </Pressable>
        {category !== 'mine' && (
          <Pressable onPress={() => onPick(null)} style={styles.thumbItem}>
            <View style={[styles.thumb, !preset && styles.thumbActive]}>
              {thumbs.none ? <Image source={{ uri: thumbs.none }} style={styles.thumbImg} /> : null}
            </View>
            <Text style={[styles.thumbLabel, !preset && { color: ec.gold }]}>{t('editor.original')}</Text>
          </Pressable>
        )}
        {list.map((p) => {
          const active = preset?.id === p.id;
          return (
            <Pressable
              key={p.id}
              onPress={() => onPick(p.id)}
              onLongPress={p.custom ? () => onRecipeMenu(p) : undefined}
              delayLongPress={350}
              style={styles.thumbItem}
            >
              <View style={[styles.thumb, active && styles.thumbActive]}>
                {thumbs[p.id] ? <Image source={{ uri: thumbs[p.id] }} style={styles.thumbImg} /> : null}
                {p.custom && (
                  <Pressable hitSlop={6} onPress={() => onRecipeMenu(p)} style={styles.mineBadge} accessibilityLabel={t('recipe.options', { name: p.name })}>
                    <Icon icon={{ set: 'ion', name: 'ellipsis-horizontal' }} size={12} color="#FFFFFF" />
                  </Pressable>
                )}
              </View>
              <Text numberOfLines={1} style={[styles.thumbLabel, active && { color: ec.gold }]}>
                {p.name}
              </Text>
            </Pressable>
          );
        })}
        {category === 'mine' && custom.length === 0 && (
          <Text style={styles.emptyMine}>{t('recipe.mineEmpty')}</Text>
        )}
      </HScroll>
      {preset && <EditorSlider label={t('editor.intensity')} value={preset.intensity} min={0} max={100} onStart={onStart} onChange={onIntensity} />}
    </View>
  );
}

/* ---------- Làm đẹp ---------- */

const beautyIcons: Record<RetouchOptionId, IconSpec> = {
  face: { set: 'mci', name: 'face-woman-shimmer-outline' },
  skin: { set: 'ion', name: 'water-outline' },
  teeth: { set: 'mci', name: 'tooth-outline' },
  eyes: { set: 'ion', name: 'eye-outline' },
  light: { set: 'ion', name: 'sunny-outline' },
};

/** Free beauty tools: sliders work on automatically detected skin, brushes on the area the user paints. */
export type BeautySlider = keyof Develop['beauty'];
export type BeautyTool = BeautySlider | RetouchEffect;

const beautySliders: { id: BeautySlider; icon: IconSpec }[] = [
  { id: 'smooth', icon: { set: 'ion', name: 'water-outline' } },
  { id: 'brighten', icon: { set: 'ion', name: 'sunny-outline' } },
  { id: 'rosy', icon: { set: 'ion', name: 'heart-outline' } },
  { id: 'even', icon: { set: 'mci', name: 'circle-half-full' } },
  { id: 'glow', icon: { set: 'ion', name: 'sparkles-outline' } },
  { id: 'detail', icon: { set: 'ion', name: 'eye-outline' } },
];

const beautyBrushes: { id: RetouchEffect; icon: IconSpec; hint: MessageKey }[] = [
  { id: 'whiten', icon: { set: 'mci', name: 'tooth-outline' }, hint: 'beauty.whitenHint' },
  { id: 'lighten', icon: { set: 'mci', name: 'eye-plus-outline' }, hint: 'beauty.lightenHint' },
];

const sizeLabels: MessageKey[] = ['common.small', 'common.medium', 'common.large'];
const brushSizes = [14, 26, 44].map((width, i) => ({ width, label: sizeLabels[i] }));

export function BeautyPanel({
  mode,
  onMode,
  tool,
  onTool,
  develop,
  onStart,
  onBeauty,
  brushWidth,
  onBrushWidth,
  onClearBrush,
  aiSelected,
  onAiToggle,
  onAiRun,
  onAdvanced,
}: {
  mode: 'free' | 'ai';
  onMode: (m: 'free' | 'ai') => void;
  tool: BeautyTool;
  onTool: (t: BeautyTool) => void;
  develop: Develop;
  onStart: () => void;
  onBeauty: (key: BeautySlider, value: number) => void;
  brushWidth: number;
  onBrushWidth: (w: number) => void;
  onClearBrush: (effect: RetouchEffect) => void;
  aiSelected: RetouchOptionId[];
  onAiToggle: (id: RetouchOptionId) => void;
  onAiRun: () => void;
  onAdvanced: () => void;
}) {
  const t = useT();
  const brush = beautyBrushes.find((b) => b.id === tool);
  return (
    <View style={styles.colTight}>
      <View style={styles.modeRow}>
        <Pill label={t('editor.beautyFree')} active={mode === 'free'} onPress={() => onMode('free')} />
        <Pill label={t('editor.beautyAi')} active={mode === 'ai'} onPress={() => onMode('ai')} />
      </View>
      {mode === 'free' ? (
        <>
          <ToolRow>
            {beautySliders.map((b) => (
              <ToolCircle key={b.id} icon={b.icon} label={t(`beauty.${b.id}`)} active={tool === b.id} onPress={() => onTool(b.id)} />
            ))}
            {beautyBrushes.map((b) => (
              <ToolCircle key={b.id} icon={b.icon} label={t(`beauty.${b.id}`)} active={tool === b.id} onPress={() => onTool(b.id)} />
            ))}
          </ToolRow>
          {brush ? (
            <HScroll tone="dark" contentContainerStyle={styles.pills}>
              <Text style={styles.brushHint}>{t(brush.hint)}</Text>
              {brushSizes.map((s) => (
                <Pill key={s.width} label={t(s.label)} active={brushWidth === s.width} onPress={() => onBrushWidth(s.width)} />
              ))}
              <Pill label={t('editor.clearBrush')} icon={{ set: 'ion', name: 'trash-outline' }} onPress={() => onClearBrush(brush.id)} />
            </HScroll>
          ) : (
            <EditorSlider
              value={develop.beauty[tool as BeautySlider]}
              min={0}
              max={100}
              onStart={onStart}
              onChange={(v) => onBeauty(tool as BeautySlider, v)}
            />
          )}
        </>
      ) : (
        <>
          <ToolRow>
            {retouchOptions.map((o) => (
              <ToolCircle key={o.id} icon={beautyIcons[o.id]} label={t(`retouch.${o.id}`)} active={aiSelected.includes(o.id)} onPress={() => onAiToggle(o.id)} />
            ))}
            <ToolCircle icon={{ set: 'mci', name: 'compare' }} label={t('editor.retouchAdvanced')} onPress={onAdvanced} />
          </ToolRow>
          <View style={styles.actionRow}>
            <ModelChip dark style={styles.darkChip} />
            <Pressable disabled={!aiSelected.length} onPress={onAiRun} style={[styles.runBtn, !aiSelected.length && { opacity: 0.4 }]}>
              <Icon icon={{ set: 'ion', name: 'sparkles' }} size={15} color={ec.onGold} />
              <Text style={styles.runText}>{t('editor.beautify')}</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

/* ---------- AI ---------- */

export function AiPanel({ onPreset, onPrompt }: { onPreset: (id: AiPresetId) => void; onPrompt: (text: string) => void }) {
  const t = useT();
  const { credits } = useAccount();
  const left = creditsLabel(credits);
  const [text, setText] = useState('');
  const submit = () => {
    if (!text.trim()) return;
    onPrompt(text.trim());
    setText('');
  };
  return (
    <View style={styles.col}>
      <ToolRow>
        {aiPresets
          .filter((p) => p.id !== 'retouch')
          .map((p) => (
            <ToolCircle key={p.id} icon={aiPresetIcons[p.id]} label={aiPresetLabel(p.id)} onPress={() => onPreset(p.id)} />
          ))}
      </ToolRow>
      <View style={styles.inputRow}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={t('editor.promptPlaceholder')}
          placeholderTextColor={ec.textMute}
          style={styles.input}
          maxLength={200}
          onSubmitEditing={submit}
          returnKeyType="send"
        />
        <Pressable onPress={submit} disabled={!text.trim()} style={[styles.sendBtn, !text.trim() && { opacity: 0.4 }]}>
          <Icon icon={{ set: 'ion', name: 'arrow-up' }} size={18} color={ec.onGold} />
        </Pressable>
      </View>
      <View style={styles.actionRow}>
        <ModelChip dark style={styles.darkChip} />
        {left && <Text style={styles.hint}>{left}</Text>}
      </View>
    </View>
  );
}

/* ---------- Văn bản / Sticker / Khung / Vẽ ---------- */

function Swatches({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <HScroll tone="dark" contentContainerStyle={styles.swatches}>
      {paintColors.map((c) => (
        <Pressable key={c} onPress={() => onChange(c)} style={[styles.swatch, { backgroundColor: c }, c === value && styles.swatchActive]} />
      ))}
    </HScroll>
  );
}

export function TextPanel({ color, onColor, onAdd }: { color: string; onColor: (c: string) => void; onAdd: (text: string) => void }) {
  const t = useT();
  const [text, setText] = useState('');
  const submit = () => {
    if (!text.trim()) return;
    onAdd(text.trim());
    setText('');
  };
  return (
    <View style={styles.col}>
      <View style={styles.inputRow}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={t('editor.textPlaceholder')}
          placeholderTextColor={ec.textMute}
          style={styles.input}
          maxLength={40}
          onSubmitEditing={submit}
          returnKeyType="done"
        />
        <Pressable onPress={submit} disabled={!text.trim()} style={[styles.sendBtn, !text.trim() && { opacity: 0.4 }]}>
          <Icon icon={{ set: 'ion', name: 'add' }} size={20} color={ec.onGold} />
        </Pressable>
      </View>
      <Swatches value={color} onChange={onColor} />
    </View>
  );
}

export function StickerPanel({ thumbs, onAdd }: { thumbs: Record<string, string>; onAdd: (id: string) => void }) {
  const t = useT();
  return (
    <HScroll tone="dark" contentContainerStyle={styles.thumbRow}>
      {stickers.map((s) => (
        <Pressable key={s.id} accessibilityLabel={t(`sticker.${s.id}` as MessageKey)} onPress={() => onAdd(s.id)} style={({ pressed }) => [styles.sticker, pressed && { transform: [{ scale: 0.92 }] }]}>
          {thumbs[s.id] ? <Image source={{ uri: thumbs[s.id] }} style={styles.stickerImg} /> : null}
        </Pressable>
      ))}
    </HScroll>
  );
}

export function FramePanel({ value, thumbs, onPick }: { value: FrameId; thumbs: Record<string, string>; onPick: (id: FrameId) => void }) {
  const t = useT();
  return (
    <HScroll tone="dark" contentContainerStyle={styles.thumbRow}>
      {frames.map((f) => (
        <Pressable key={f.id} onPress={() => onPick(f.id)} style={styles.thumbItem}>
          <View style={[styles.thumb, value === f.id && styles.thumbActive]}>
            {thumbs[f.id] ? <Image source={{ uri: thumbs[f.id] }} style={styles.thumbImg} /> : null}
          </View>
          <Text numberOfLines={1} style={[styles.thumbLabel, value === f.id && { color: ec.gold }]}>
            {t(f.label)}
          </Text>
        </Pressable>
      ))}
    </HScroll>
  );
}

const penKinds: { id: PenSettings['kind']; icon: IconSpec }[] = [
  { id: 'normal', icon: { set: 'mci', name: 'pencil-outline' } },
  { id: 'neon', icon: { set: 'mci', name: 'lightbulb-on-outline' } },
  { id: 'rainbow', icon: { set: 'mci', name: 'looks' } },
];

const penSizes = [6, 12, 24].map((width, i) => ({ width, label: sizeLabels[i] }));

export function DrawPanel({ pen, onChange }: { pen: PenSettings; onChange: (p: PenSettings) => void }) {
  const t = useT();
  return (
    <View style={styles.col}>
      <HScroll tone="dark" contentContainerStyle={styles.pills}>
        {penKinds.map((k) => (
          <Pill key={k.id} icon={k.icon} label={t(`editor.pen.${k.id}`)} active={pen.kind === k.id} onPress={() => onChange({ ...pen, kind: k.id })} />
        ))}
        {penSizes.map((s) => (
          <Pill key={s.width} label={t(s.label)} active={pen.width === s.width} onPress={() => onChange({ ...pen, width: s.width })} />
        ))}
      </HScroll>
      {pen.kind !== 'rainbow' && <Swatches value={pen.color} onChange={(c) => onChange({ ...pen, color: c })} />}
    </View>
  );
}

const styles = StyleSheet.create({
  saveTile: { alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', borderColor: ec.gold, backgroundColor: ec.goldSoft },
  mineBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyMine: { width: 220, alignSelf: 'center', fontFamily: font.regular, fontSize: 12, lineHeight: 17, color: ec.textSoft },
  col: { gap: 12 },
  colTight: { gap: 10 },
  modeRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 14 },
  brushHint: { fontFamily: font.medium, fontSize: 13, color: ec.gold, alignSelf: 'center', marginRight: 4 },
  pills: { paddingHorizontal: 14, gap: 8 },
  thumbRow: { paddingHorizontal: 12, gap: 10 },
  thumbItem: { alignItems: 'center', gap: 5, width: 66 },
  thumb: { width: 62, height: 62, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', backgroundColor: ec.surface2 },
  thumbActive: { borderColor: ec.gold },
  thumbImg: { width: '100%', height: '100%' },
  thumbLabel: { fontFamily: font.regular, fontSize: 11, color: ec.textSoft },
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 14 },
  darkChip: { backgroundColor: ec.surface2, borderColor: ec.border },
  runBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: ec.gold, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  runText: { fontFamily: font.semi, fontSize: 14, color: ec.onGold },
  hint: { fontFamily: font.regular, fontSize: 12, color: ec.textSoft },
  inputRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 14 },
  input: {
    flex: 1,
    minWidth: 0,
    fontFamily: font.regular,
    fontSize: 14,
    color: ec.text,
    backgroundColor: ec.surface2,
    borderWidth: 1,
    borderColor: ec.border,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: ec.gold, alignItems: 'center', justifyContent: 'center' },
  swatches: { paddingHorizontal: 14, gap: 10 },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: ec.border },
  swatchActive: { borderWidth: 3, borderColor: ec.gold, transform: [{ scale: 1.12 }] },
  sticker: { width: 60, height: 60, borderRadius: 14, backgroundColor: ec.surface2, alignItems: 'center', justifyContent: 'center' },
  stickerImg: { width: 46, height: 46 },
});
