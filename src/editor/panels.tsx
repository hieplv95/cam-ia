import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View, type ImageSourcePropType } from 'react-native';

import { creditsLabel, useAccount } from '../account';
import { aiPresets, type AiPresetId } from '../ai/presets';
import { retouchOptions, retouchStyles, type RetouchOptionId, type RetouchStyleId } from '../ai/retouch';
import { developPresets, presetCategories, type DevelopPreset, type PresetCategory } from '../develop/presets';
import type { Develop } from '../develop/types';
import { aiPresetIcons, aiPresetLabel, Icon, type IconSpec } from '../icons';
import { ModelChip } from '../ModelPicker';
import { photoImage } from '../photos';
import { colors, font, goldGradient, paintColors } from '../theme';
import type { PenSettings } from './EditorCanvas';
import { FRAME_CATEGORIES, frames, type FrameCategory, type FrameId } from './frames';
import { cropRatios, type CropRatio, type TransformOp } from './imageOps';
import type { NoseLiftStyle } from './reshape';
import type { RetouchEffect } from './types';
import { STICKER_CATEGORIES, stickers, type StickerCategory } from './stickers';
import { designText, fontInfo, TEXT_CATEGORIES, TEXT_DESIGNS, TEXT_FONTS, TEXT_STYLES, type FontId, type TextCategory, type TextDesign, type TextStyleId } from './text';
import { CategoryTabs, ec, EditorSlider, Pill, ToolCircle, ToolRow } from './ui';
import { HScroll } from '../HScroll';
import { beautyPhotos, RetouchToolCard } from '../RetouchToolCard';
import { getLanguage, useT, type MessageKey } from '../i18n';
import { isMessageKey } from '../i18n/core';

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

/** Crop frame shapes: free, or locked to a ratio. */
export type CropChoice = 'free' | CropRatio;
export const cropChoices: { id: CropChoice; label: string | null }[] = [
  { id: 'free', label: null },
  { id: 'square', label: '1:1' },
  { id: 'portrait', label: '4:5' },
  { id: 'classic', label: '3:4' },
  { id: 'story', label: '9:16' },
  { id: 'landscape', label: '16:9' },
];
export const cropRatioOf = (c: CropChoice) => (c === 'free' ? null : cropRatios[c]);

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
  crop,
  ...slider
}: SliderProps & {
  tool: BasicTool;
  onTool: (t: BasicTool) => void;
  onTransform: (op: TransformOp) => void;
  /** Free crop: the chosen shape, whether the frame differs from the whole picture, and the actions. */
  crop: { choice: CropChoice; onChoice: (c: CropChoice) => void; changed: boolean; onReset: () => void; onApply: () => void };
}) {
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
        <>
          <HScroll contentContainerStyle={styles.pills}>
            {cropChoices.map((c) => (
              <Pill key={c.id} label={c.label ?? t('editor.crop.free')} active={crop.choice === c.id} onPress={() => crop.onChoice(c.id)} />
            ))}
          </HScroll>
          <View style={styles.cropRow}>
            <Text style={styles.cropHint} numberOfLines={2}>
              {t('editor.crop.hint')}
            </Text>
            <Pressable onPress={crop.onReset} disabled={!crop.changed} style={[styles.cropReset, !crop.changed && { opacity: 0.4 }]}>
              <Text style={styles.cropResetText}>{t('common.reset')}</Text>
            </Pressable>
            <Pressable onPress={crop.onApply} disabled={!crop.changed} style={[styles.cropApply, !crop.changed && { opacity: 0.4 }]}>
              <Icon icon={{ set: 'mci', name: 'crop' }} size={15} color="#FFFFFF" />
              <Text style={styles.cropApplyText}>{t('editor.crop.apply')}</Text>
            </Pressable>
          </View>
        </>
      )}
      {tool === 'rotate' && (
        <HScroll contentContainerStyle={styles.pills}>
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

/* ---------- Hiệu ứng (Điều chỉnh: DevelopPanel.tsx) ---------- */

const effectIds: DevelopKeyId[] = ['vignette', 'grain', 'clarity', 'noise', 'sharpness'];

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
      <HScroll contentContainerStyle={styles.pills}>
        {[{ id: 'all' as const, label: 'common.all' as const }, { id: 'mine' as const, label: 'common.mine' as const }, ...presetCategories].map((c) => (
          <Pill key={c.id} label={t(c.label)} active={category === c.id} onPress={() => setCategory(c.id)} />
        ))}
      </HScroll>
      <HScroll contentContainerStyle={styles.thumbRow}>
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


/**
 * Free beauty tools: sliders work on automatically detected skin, brushes on the area the user paints, and the
 * shape tools on marks the user paints before pressing "Apply" (acne healing and reshaping, see reshape.tsx).
 */
export type BeautySlider = keyof Develop['beauty'];
export type ShapeTool = 'acne' | 'bigeyes' | 'slim' | 'legs' | 'vline' | 'jaw' | 'nose' | 'noselift' | 'fulllips' | 'shoulders' | 'height';
export type BeautyTool = BeautySlider | RetouchEffect | ShapeTool;

const shapeTools: ShapeTool[] = ['acne', 'bigeyes', 'slim', 'legs', 'vline', 'jaw', 'nose', 'noselift', 'fulllips', 'shoulders', 'height'];
export const isShapeTool = (t: BeautyTool): t is ShapeTool => shapeTools.includes(t as ShapeTool);
/** "Tăng chiều cao" works on the whole picture; the other shape tools need marks first. */
export const needsMarks = (t: ShapeTool) => t !== 'height';

type BeautyGroup = 'skin' | 'face' | 'makeup' | 'body';
const beautyGroups: BeautyGroup[] = ['skin', 'face', 'makeup', 'body'];

/** A free tool with its sample picture (a retouch tool's own, or `picture` with `icon`) and its name (beauty.<id> by default). */
type FreeCard = { id: BeautyTool; photo: RetouchOptionId; picture?: ImageSourcePropType; icon?: IconSpec; label?: MessageKey };

/** Free tools by group (Da / Khuôn mặt / Trang điểm / Body), in the order of their rows. */
const freeCards: Record<BeautyGroup, FreeCard[]> = {
  skin: [
    { id: 'smooth', photo: 'skin' },
    { id: 'acne', photo: 'acne' },
    { id: 'brighten', photo: 'light' },
    { id: 'rosy', photo: 'skin', picture: beautyPhotos.rosy, icon: { set: 'ion', name: 'heart-outline' } },
    { id: 'even', photo: 'skin', picture: beautyPhotos.even, icon: { set: 'mci', name: 'circle-half-full' } },
    { id: 'glow', photo: 'light', picture: beautyPhotos.glow, icon: { set: 'ion', name: 'sparkles-outline' } },
    { id: 'detail', photo: 'eyes', picture: beautyPhotos.detail, icon: { set: 'ion', name: 'eye-outline' } },
  ],
  face: [
    { id: 'vline', photo: 'slimface', picture: beautyPhotos.vline, icon: { set: 'mci', name: 'face-woman-outline' } },
    { id: 'jaw', photo: 'slimface', picture: beautyPhotos.jaw, icon: { set: 'mci', name: 'face-woman-profile' } },
    { id: 'bigeyes', photo: 'bigeyes' },
    { id: 'nose', photo: 'nose', picture: beautyPhotos.nose, icon: { set: 'mci', name: 'arrow-collapse-horizontal' } },
    { id: 'noselift', photo: 'nose', picture: beautyPhotos.noselift, icon: { set: 'mci', name: 'chevron-double-up' } },
    { id: 'fulllips', photo: 'lips', picture: beautyPhotos.fulllips, icon: { set: 'mci', name: 'emoticon-kiss-outline' } },
  ],
  makeup: [
    { id: 'lips', photo: 'lips' },
    { id: 'blush', photo: 'skin', picture: beautyPhotos.blush, icon: { set: 'mci', name: 'brush-variant' } },
    { id: 'brows', photo: 'eyes', picture: beautyPhotos.brows, icon: { set: 'mci', name: 'format-paint' } },
    { id: 'whiten', photo: 'teeth' },
    { id: 'lighten', photo: 'eyes' },
  ],
  body: [
    { id: 'slim', photo: 'waist', label: 'beauty.waist' },
    { id: 'legs', photo: 'legs', picture: beautyPhotos.longlegs },
    { id: 'shoulders', photo: 'waist', picture: beautyPhotos.shoulders, icon: { set: 'mci', name: 'human-handsup' } },
    { id: 'height', photo: 'legs', picture: beautyPhotos.height, icon: { set: 'mci', name: 'human-male-height' } },
  ],
};
/** Icons beside the group names: a drop for skin, a face, a makeup brush, a figure. */
const beautyGroupIcons: Record<BeautyGroup, IconSpec> = {
  skin: { set: 'ion', name: 'water-outline' },
  face: { set: 'mci', name: 'face-woman-outline' },
  makeup: { set: 'mci', name: 'brush-variant' },
  body: { set: 'mci', name: 'human-female' },
};
const groupOf = (tool: BeautyTool) => beautyGroups.find((g) => freeCards[g].some((c) => c.id === tool)) ?? 'skin';

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
  { id: 'lips', icon: { set: 'mci', name: 'lipstick' }, hint: 'beauty.lipsHint' },
  { id: 'blush', icon: { set: 'mci', name: 'brush-variant' }, hint: 'beauty.blushHint' },
  { id: 'brows', icon: { set: 'mci', name: 'format-paint' }, hint: 'beauty.browsHint' },
];

const noseStyles: NoseLiftStyle[] = ['contour', 'lift'];

const sizeLabels: MessageKey[] = ['common.small', 'common.medium', 'common.large'];
const brushSizes = [14, 26, 44].map((width, i) => ({ width, label: sizeLabels[i] }));

export type BeautyMode = 'quick' | 'style' | 'free' | 'ai';

/** "Làm đẹp nhanh": a look (at most one), the retouch tools picked, and running them with AI. */
export type QuickBeauty = {
  style: RetouchStyleId | null;
  onStyle: (s: RetouchStyleId | null) => void;
  selected: RetouchOptionId[];
  onToggle: (id: RetouchOptionId) => void;
  onRun: () => void;
};

/** What the Làm đẹp tab opens on: one-tap looks and retouch tools (the free tools are the other tabs). */
function QuickBeautyPanel({ style, onStyle, selected, onToggle, onRun, compact }: QuickBeauty & { compact?: boolean }) {
  const t = useT();
  const nothing = !style && !selected.length;
  return (
    <View style={styles.colTight}>
      <HScroll contentContainerStyle={styles.lookRow}>
        {retouchStyles.map((st) => {
          const active = style === st.id;
          return (
            <Pressable key={st.id} onPress={() => onStyle(active ? null : st.id)} style={[styles.look, active && styles.lookActive]}>
              <Image source={photoImage(st.photo, 160)} style={styles.lookImg} />
              {active && (
                <View style={styles.lookCheck}>
                  <Ionicons name="checkmark" size={11} color={colors.onGold} />
                </View>
              )}
              <Text numberOfLines={1} style={[styles.lookName, active && { color: colors.goldDeep }]}>
                {t(`retouch.style.${st.id}`)}
              </Text>
            </Pressable>
          );
        })}
      </HScroll>
      {/* On short screens the "Nhanh" tab already says it. */}
      {!compact && (
        <View style={styles.quickHead}>
          <Text style={styles.quickTitle}>{t('retouch.quick')}</Text>
        </View>
      )}
      <ToolRow>
        {retouchOptions.map((o) => (
          <RetouchToolCard key={o.id} id={o.id} size={54} active={selected.includes(o.id)} onPress={() => onToggle(o.id)} />
        ))}
      </ToolRow>
      <AiRunRow label={t('retouch.applyNow')} disabled={nothing} onRun={onRun} />
    </View>
  );
}

/** The AI model to use (and its cost) beside the big gold button that runs it. */
function AiRunRow({ label, disabled, onRun }: { label: string; disabled: boolean; onRun: () => void }) {
  return (
    <View style={styles.aiRunRow}>
      <ModelChip compact />
      <Pressable disabled={disabled} onPress={onRun} style={({ pressed }) => [styles.applyNow, (pressed || disabled) && { opacity: 0.55 }]}>
        <LinearGradient colors={goldGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.applyNowFill}>
          <Ionicons name="sparkles" size={16} color={colors.onGold} />
          <Text numberOfLines={1} style={styles.applyNowText}>
            {label}
          </Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

/**
 * "Phong cách" (AI Makeup & Hairstyle): makeup, hairstyle / hair color and outfit, at most one per studio group,
 * sent to the studio's hair & makeup tool. Items without a sample picture yet show an icon (or the hair color).
 */
export type StyleGroup = 'makeup' | 'hair' | 'color' | 'outfit';
type StyleRow = 'makeup' | 'hair' | 'outfit';
type StyleItem = { group: StyleGroup; id: string; photo?: ImageSourcePropType; icon?: IconSpec; swatch?: string };

const styleRows: { id: StyleRow; icon: IconSpec }[] = [
  { id: 'makeup', icon: { set: 'mci', name: 'lipstick' } },
  { id: 'hair', icon: { set: 'mci', name: 'hair-dryer-outline' } },
  { id: 'outfit', icon: { set: 'mci', name: 'hanger' } },
];

const styleItems: Record<StyleRow, StyleItem[]> = {
  makeup: [
    { group: 'makeup', id: 'natural', photo: photoImage('lookNatural') },
    { group: 'makeup', id: 'party', photo: photoImage('lookLuxe') },
    { group: 'makeup', id: 'glam', photo: photoImage('lookLatina') },
    { group: 'makeup', id: 'sweet', photo: photoImage('lookBright') },
    { group: 'makeup', id: 'korean', photo: photoImage('lookKorean') },
    { group: 'makeup', id: 'bridal', icon: { set: 'mci', name: 'flower-outline' } },
  ],
  // Samples: assets/images/style/hair-<id>.jpg (cut from the user's sheet); the last two colors are plain swatches.
  hair: [
    { group: 'hair', id: 'straight', photo: require('../../assets/images/style/hair-straight.jpg') },
    { group: 'hair', id: 'waves', photo: require('../../assets/images/style/hair-waves.jpg') },
    { group: 'hair', id: 'bob', photo: require('../../assets/images/style/hair-bob.jpg') },
    { group: 'hair', id: 'curly', photo: require('../../assets/images/style/hair-curly.jpg') },
    { group: 'hair', id: 'bangs', photo: require('../../assets/images/style/hair-bangs.jpg') },
    { group: 'hair', id: 'updo', photo: require('../../assets/images/style/hair-updo.jpg') },
    { group: 'color', id: 'chestnut', photo: require('../../assets/images/style/hair-chestnut.jpg') },
    { group: 'color', id: 'caramel', photo: require('../../assets/images/style/hair-caramel.jpg') },
    { group: 'color', id: 'black', photo: require('../../assets/images/style/hair-black.jpg') },
    { group: 'color', id: 'ash', photo: require('../../assets/images/style/hair-ash.jpg') },
    { group: 'color', id: 'burgundy', swatch: '#6E1E2E' },
    { group: 'color', id: 'rose', swatch: '#F2A7B8' },
  ],
  // Samples: assets/images/style/outfit-<id>.jpg (the outfit only, cut from the user's sheet).
  outfit: [
    { group: 'outfit', id: 'dress', photo: require('../../assets/images/style/outfit-dress.jpg') },
    { group: 'outfit', id: 'street', photo: require('../../assets/images/style/outfit-street.jpg') },
    { group: 'outfit', id: 'elegant', photo: require('../../assets/images/style/outfit-elegant.jpg') },
    { group: 'outfit', id: 'evening', photo: require('../../assets/images/style/outfit-evening.jpg') },
    { group: 'outfit', id: 'casual', photo: require('../../assets/images/style/outfit-casual.jpg') },
  ],
};

export type StyleLook = {
  picks: Partial<Record<StyleGroup, string>>;
  onPick: (group: StyleGroup, id: string | null) => void;
  onRun: () => void;
};

function StyleLookPanel({ picks, onPick, onRun }: StyleLook) {
  const t = useT();
  const [row, setRow] = useState<StyleRow>('makeup');
  const nothing = !Object.values(picks).some(Boolean);
  return (
    <>
      <HScroll contentContainerStyle={styles.pills}>
        {styleRows.map((r) => {
          const has = styleItems[r.id].some((it) => picks[it.group] === it.id);
          return <Pill key={r.id} icon={r.icon} label={`${t(`beauty.style.${r.id}`)}${has ? ' •' : ''}`} active={row === r.id} onPress={() => setRow(r.id)} />;
        })}
      </HScroll>
      {/* A new row starts scrolled to its beginning. */}
      <HScroll key={row} contentContainerStyle={styles.lookRow}>
        {styleItems[row].map((it) => {
          const active = picks[it.group] === it.id;
          return (
            <Pressable key={`${it.group}.${it.id}`} onPress={() => onPick(it.group, active ? null : it.id)} style={[styles.look, active && styles.lookActive]}>
              {it.photo ? (
                <Image source={it.photo} style={styles.lookImg} />
              ) : (
                <View style={[styles.lookImg, styles.lookIcon, it.swatch ? { backgroundColor: it.swatch } : null]}>
                  {it.icon && <Icon icon={it.icon} size={24} color={ec.gold} />}
                </View>
              )}
              {active && (
                <View style={styles.lookCheck}>
                  <Ionicons name="checkmark" size={11} color={colors.onGold} />
                </View>
              )}
              <Text numberOfLines={1} style={[styles.lookName, active && { color: colors.goldDeep }]}>
                {t(`studio.style.${it.group}.${it.id}` as MessageKey)}
              </Text>
            </Pressable>
          );
        })}
      </HScroll>
      <AiRunRow label={t('beauty.style.run')} disabled={nothing} onRun={onRun} />
    </>
  );
}

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
  marks,
  strength,
  noseStyle,
  onNoseStyle,
  onStrength,
  onClearMarks,
  onApplyShape,
  comparing,
  onCompare,
  aiSelected,
  onAiToggle,
  onAiRun,
  onAdvanced,
  quick,
  compact,
  look,
}: {
  /** Làm đẹp nhanh, Phong cách (makeup, hair, outfit), the free tools (Da / Khuôn mặt / Trang điểm / Body) or the AI tools. */
  mode: BeautyMode;
  onMode: (m: BeautyMode) => void;
  tool: BeautyTool;
  onTool: (t: BeautyTool) => void;
  develop: Develop;
  onStart: () => void;
  onBeauty: (key: BeautySlider, value: number) => void;
  brushWidth: number;
  onBrushWidth: (w: number) => void;
  onClearBrush: (effect: RetouchEffect) => void;
  /** Shape tools: how many marks are painted, how strong the change is (0–100), and applying it. */
  marks: number;
  strength: number;
  /** Nâng mũi: "Tạo khối" (contour) or "Nâng rõ" (lift). */
  noseStyle: NoseLiftStyle;
  onNoseStyle: (s: NoseLiftStyle) => void;
  onStrength: (v: number) => void;
  onClearMarks: () => void;
  onApplyShape: () => void;
  /** The before / after view of the editor. */
  comparing: boolean;
  onCompare: () => void;
  aiSelected: RetouchOptionId[];
  onAiToggle: (id: RetouchOptionId) => void;
  onAiRun: () => void;
  onAdvanced: () => void;
  quick: QuickBeauty;
  /** Short screen: leave out what the tabs already say. */
  compact?: boolean;
  look: StyleLook;
}) {
  const t = useT();
  const brush = beautyBrushes.find((b) => b.id === tool);
  const [group, setGroup] = useState<BeautyGroup>(() => groupOf(tool));
  const carded = new Set(freeCards.skin.map((c) => c.id));
  // Always on top: Nhanh (Làm đẹp nhanh), Phong cách, the free groups (Da / Khuôn mặt / Trang điểm / Body), then AI.
  const tabs = (
    <CategoryTabs<BeautyGroup | Exclude<BeautyMode, 'free'>>
      tabs={[
        { id: 'quick', label: t('beauty.group.quick'), icon: { set: 'ion', name: 'flash-outline' } },
        { id: 'style', label: t('beauty.group.style'), icon: { set: 'mci', name: 'face-woman-shimmer-outline' } },
        ...beautyGroups.map((g) => ({ id: g, label: t(`beauty.group.${g}`), icon: beautyGroupIcons[g] })),
        { id: 'ai', label: 'AI', icon: { set: 'ion', name: 'sparkles-outline' } },
      ]}
      value={mode === 'free' ? group : mode}
      onChange={(g) => {
        if (g === 'quick' || g === 'style' || g === 'ai') return onMode(g);
        onMode('free');
        setGroup(g);
        onTool(freeCards[g][0].id);
      }}
    />
  );
  if (mode === 'quick')
    return (
      <View style={styles.colTight}>
        {tabs}
        <QuickBeautyPanel {...quick} compact={compact} />
      </View>
    );
  if (mode === 'style')
    return (
      <View style={styles.colTight}>
        {tabs}
        <StyleLookPanel {...look} />
      </View>
    );
  return (
    <View style={styles.colTight}>
      {tabs}
      {mode === 'free' ? (
        <>
          <ToolRow>
            {freeCards[group].map((c) => (
              <RetouchToolCard
                key={c.id}
                id={c.photo}
                photo={c.picture}
                icon={c.icon}
                size={54}
                label={t(c.label ?? `beauty.${c.id}`)}
                active={tool === c.id}
                onPress={() => onTool(c.id)}
              />
            ))}
            {group === 'skin' &&
              beautySliders
                .filter((b) => !carded.has(b.id))
                .map((b) => <ToolCircle key={b.id} icon={b.icon} label={t(`beauty.${b.id}`)} active={tool === b.id} onPress={() => onTool(b.id)} />)}
          </ToolRow>
          {isShapeTool(tool) ? (
            <>
              <HScroll contentContainerStyle={styles.pills}>
                <Text style={styles.brushHint}>{t(`beauty.${tool}Hint`)}</Text>
                {tool === 'noselift' &&
                  noseStyles.map((s) => <Pill key={s} label={t(`beauty.noseStyle.${s}`)} active={noseStyle === s} onPress={() => onNoseStyle(s)} />)}
                {needsMarks(tool) &&
                  brushSizes.map((s) => <Pill key={s.width} label={t(s.label)} active={brushWidth === s.width} onPress={() => onBrushWidth(s.width)} />)}
              </HScroll>
              {tool !== 'acne' && <EditorSlider label={t('editor.intensity')} value={strength} min={0} max={100} onChange={onStrength} />}
              <View style={styles.actionRow}>
                <View style={styles.shapeActions}>
                  {needsMarks(tool) && <Pill label={t('common.reset')} icon={{ set: 'ion', name: 'refresh' }} onPress={onClearMarks} />}
                  <Pill label={t('beauty.compare')} icon={{ set: 'mci', name: 'compare' }} active={comparing} onPress={onCompare} />
                </View>
                <Pressable disabled={needsMarks(tool) && !marks} onPress={onApplyShape} style={[styles.runBtn, needsMarks(tool) && !marks && { opacity: 0.4 }]}>
                  <Icon icon={{ set: 'ion', name: 'checkmark' }} size={15} color="#FFFFFF" />
                  <Text style={styles.runText}>{t('common.apply')}</Text>
                </Pressable>
              </View>
            </>
          ) : brush ? (
            <HScroll contentContainerStyle={styles.pills}>
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
              <RetouchToolCard key={o.id} id={o.id} size={54} active={aiSelected.includes(o.id)} onPress={() => onAiToggle(o.id)} />
            ))}
            <ToolCircle icon={{ set: 'mci', name: 'compare' }} label={t('editor.retouchAdvanced')} onPress={onAdvanced} />
          </ToolRow>
          <View style={styles.actionRow}>
            <ModelChip />
            <Pressable disabled={!aiSelected.length} onPress={onAiRun} style={[styles.runBtn, !aiSelected.length && { opacity: 0.4 }]}>
              <Icon icon={{ set: 'ion', name: 'sparkles' }} size={15} color="#FFFFFF" />
              <Text style={styles.runText}>{t('editor.beautify')}</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

/* ---------- AI ---------- */

/** One-tap AI effects; writing your own request is done in the prompt box under the photo (PromptBar). */
export function AiPanel({ onPreset }: { onPreset: (id: AiPresetId) => void }) {
  const { credits } = useAccount();
  const left = creditsLabel(credits);
  return (
    <View style={styles.col}>
      <ToolRow>
        {aiPresets
          .filter((p) => p.id !== 'retouch')
          .map((p) => (
            <ToolCircle key={p.id} icon={aiPresetIcons[p.id]} label={aiPresetLabel(p.id)} onPress={() => onPreset(p.id)} />
          ))}
      </ToolRow>
      <View style={styles.actionRow}>
        <ModelChip />
        {left && <Text style={styles.hint}>{left}</Text>}
      </View>
    </View>
  );
}

/* ---------- Văn bản / Sticker / Khung / Vẽ ---------- */

function Swatches({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <HScroll contentContainerStyle={styles.swatches}>
      {paintColors.map((c) => (
        <Pressable key={c} onPress={() => onChange(c)} style={[styles.swatch, { backgroundColor: c }, c === value && styles.swatchActive]} />
      ))}
    </HScroll>
  );
}

/** How a look shows in the panel previews (React Native text shadows standing in for Skia's borders). */
const previewLook = (style: TextStyleId) =>
  style === 'sticker'
    ? { textShadowColor: '#FFFFFF', textShadowRadius: 3 }
    : style === 'outline'
      ? { textShadowColor: '#1E1A17', textShadowRadius: 2 }
      : style === 'shadow'
        ? { textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 }
        : {};

/** Two cards per column, scrolling sideways. */
const inPairs = <T,>(list: T[]) => Array.from({ length: Math.ceil(list.length / 2) }, (_, i) => list.slice(i * 2, i * 2 + 2));

export type TextLook = { font: FontId; style: TextStyleId; color: string };

/**
 * "Văn bản": ready-made designs by group (Mẫu chữ), or your own words with a font, a look and a color (Tự viết).
 * With a text layer selected, the font, look, color and words apply to it.
 */
export function TextPanel({
  look,
  onLook,
  selectedText,
  onAdd,
  onEdit,
  onDesign,
}: {
  look: TextLook;
  onLook: (patch: Partial<TextLook>) => void;
  /** The words of the selected text layer, if one is selected. */
  selectedText: string | null;
  onAdd: (text: string) => void;
  onEdit: (text: string) => void;
  onDesign: (design: TextDesign) => void;
}) {
  const t = useT();
  const lang = getLanguage();
  const [fontsLoaded] = useFonts(Object.fromEntries(TEXT_FONTS.map((f) => [f.family, f.file])));
  const [tab, setTab] = useState<'designs' | 'write'>(selectedText === null ? 'designs' : 'write');
  const [category, setCategory] = useState<TextCategory>('all');
  const [text, setText] = useState('');
  const editing = selectedText !== null;
  const value = editing ? selectedText : text;

  const submit = () => {
    if (!value.trim()) return;
    if (editing) return;
    onAdd(text.trim());
    setText('');
  };
  const family = (id: FontId) => (fontsLoaded ? fontInfo(id).family : undefined);
  const designs = TEXT_DESIGNS.filter((d) => category === 'all' || d.cat === category);

  return (
    <View style={styles.colTight}>
      <CategoryTabs
        tabs={[
          { id: 'designs', label: t('text.tab.designs') },
          { id: 'write', label: t('text.tab.write') },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'designs' ? (
        <>
          <HScroll contentContainerStyle={styles.modeRow}>
            {TEXT_CATEGORIES.map((c) => (
              <Pill key={c} label={t(`text.cat.${c}`)} active={category === c} onPress={() => setCategory(c)} />
            ))}
          </HScroll>
          <HScroll contentContainerStyle={styles.thumbRow}>
            {inPairs(designs).map((pair) => (
              <View key={pair[0].id} style={{ gap: 8 }}>
                {pair.map((d) => (
                  <Pressable
                    key={d.id}
                    onPress={() => onDesign(d)}
                    accessibilityLabel={designText(d, lang)}
                    style={({ pressed }) => [styles.design, d.color.toUpperCase() === '#FFFFFF' || d.color === '#FFF3E0' ? styles.designDark : null, pressed && { transform: [{ scale: 0.95 }] }]}
                  >
                    <Text numberOfLines={2} adjustsFontSizeToFit style={[styles.designText, { color: d.color, fontFamily: family(d.font) }, previewLook(d.style)]}>
                      {designText(d, lang)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </HScroll>
        </>
      ) : (
        <>
          <View style={styles.inputRow}>
            <TextInput
              value={value}
              onChangeText={(v) => (editing ? onEdit(v) : setText(v))}
              placeholder={t('editor.textPlaceholder')}
              placeholderTextColor={ec.textMute}
              style={[styles.input, { fontFamily: family(look.font) ?? styles.input.fontFamily }]}
              maxLength={80}
              multiline
              blurOnSubmit={!editing}
              onSubmitEditing={submit}
            />
            {!editing && (
              <Pressable onPress={submit} disabled={!text.trim()} style={[styles.sendBtn, !text.trim() && { opacity: 0.4 }]} accessibilityLabel={t('text.add')}>
                <Icon icon={{ set: 'ion', name: 'add' }} size={20} color="#FFFFFF" />
              </Pressable>
            )}
          </View>
          <HScroll contentContainerStyle={styles.modeRow}>
            {TEXT_FONTS.map((f) => (
              <Pressable key={f.id} onPress={() => onLook({ font: f.id })} style={[styles.fontChip, look.font === f.id && styles.fontChipActive]} accessibilityLabel={f.family}>
                <Text style={[styles.fontChipText, { fontFamily: family(f.id) }, look.font === f.id && { color: '#FFFFFF' }]}>Aa</Text>
              </Pressable>
            ))}
          </HScroll>
          <HScroll contentContainerStyle={styles.modeRow}>
            {TEXT_STYLES.map((s) => (
              <Pill key={s} label={t(`text.style.${s}`)} active={look.style === s} onPress={() => onLook({ style: s })} />
            ))}
          </HScroll>
          <Swatches value={look.color} onChange={(color) => onLook({ color })} />
        </>
      )}
    </View>
  );
}

export function StickerPanel({ thumbs, onAdd }: { thumbs: Record<string, string>; onAdd: (id: string) => void }) {
  const t = useT();
  const [category, setCategory] = useState<StickerCategory>('all');
  const list = stickers.filter((s) => category === 'all' || s.cat === category);
  return (
    <View style={styles.colTight}>
      <HScroll contentContainerStyle={styles.modeRow}>
        {STICKER_CATEGORIES.map((c) => (
          <Pill key={c} label={t(`sticker.cat.${c}`)} active={category === c} onPress={() => setCategory(c)} />
        ))}
      </HScroll>
      <HScroll contentContainerStyle={styles.thumbRow}>
        {inPairs(list).map((pair) => (
          <View key={pair[0].id} style={{ gap: 8 }}>
            {pair.map((s) => {
              const key = `sticker.${s.id}`;
              return (
                <Pressable
                  key={s.id}
                  accessibilityLabel={isMessageKey(key) ? t(key) : t(`sticker.cat.${s.cat}`)}
                  onPress={() => onAdd(s.id)}
                  style={({ pressed }) => [styles.sticker, pressed && { transform: [{ scale: 0.92 }] }]}
                >
                  {thumbs[s.id] ? <Image source={{ uri: thumbs[s.id] }} style={styles.stickerImg} /> : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </HScroll>
    </View>
  );
}

export function FramePanel({ value, thumbs, onPick }: { value: FrameId; thumbs: Record<string, string>; onPick: (id: FrameId) => void }) {
  const t = useT();
  const [category, setCategory] = useState<FrameCategory>('all');
  // "None" stays first in every group, so a frame can always be taken off.
  const list = frames.filter((f) => category === 'all' || f.cat === category || f.id === 'none');
  return (
    <View style={styles.colTight}>
      <HScroll contentContainerStyle={styles.modeRow}>
        {FRAME_CATEGORIES.map((c) => (
          <Pill key={c} label={t(`frame.cat.${c}`)} active={category === c} onPress={() => setCategory(c)} />
        ))}
      </HScroll>
      <HScroll contentContainerStyle={styles.thumbRow}>
        {list.map((f) => (
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
    </View>
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
      <HScroll contentContainerStyle={styles.pills}>
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
  cropRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14 },
  cropHint: { flex: 1, fontFamily: font.regular, fontSize: 12, color: ec.textSoft },
  cropReset: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: ec.border },
  cropResetText: { fontFamily: font.medium, fontSize: 13, color: ec.text },
  cropApply: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: ec.gold, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  cropApplyText: { fontFamily: font.semi, fontSize: 13.5, color: '#FFFFFF' },
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
  lookRow: { paddingHorizontal: 10, gap: 2 },
  lookIcon: { alignItems: 'center', justifyContent: 'center' },
  look: { width: 90, alignItems: 'center', gap: 3, padding: 2, borderRadius: 13, borderWidth: 1.5, borderColor: 'transparent' },
  lookActive: { borderColor: ec.gold, backgroundColor: ec.goldSoft },
  lookImg: { width: 56, height: 56, borderRadius: 10, backgroundColor: ec.surface2 },
  lookCheck: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: ec.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lookName: { fontFamily: font.medium, fontSize: 10, color: ec.text },
  quickHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, marginBottom: -4 },
  quickTitle: { fontFamily: font.serif, fontSize: 16, color: ec.text },
  aiRunRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  applyNow: { flex: 1 },
  applyNowFill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 11 },
  applyNowText: { fontFamily: font.semi, fontSize: 15, color: colors.onGold },
  modeRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 14 },
  shapeActions: { flexDirection: 'row', gap: 8, flexShrink: 1 },
  brushHint: { fontFamily: font.medium, fontSize: 13, color: ec.gold, alignSelf: 'center', marginRight: 4 },
  pills: { paddingHorizontal: 14, gap: 8 },
  thumbRow: { paddingHorizontal: 12, gap: 10 },
  thumbItem: { alignItems: 'center', gap: 5, width: 66 },
  thumb: { width: 62, height: 62, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', backgroundColor: ec.surface2 },
  thumbActive: { borderColor: ec.gold },
  thumbImg: { width: '100%', height: '100%' },
  thumbLabel: { fontFamily: font.regular, fontSize: 11, color: ec.textSoft },
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 14 },
  runBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: ec.gold, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  runText: { fontFamily: font.semi, fontSize: 14, color: '#FFFFFF' },
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
  design: { width: 108, height: 58, borderRadius: 12, backgroundColor: '#F4ECE2', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  // White designs need a darker card to be seen.
  designDark: { backgroundColor: '#B79C84' },
  designText: { fontSize: 17, lineHeight: 20, textAlign: 'center' },
  fontChip: { width: 52, height: 36, borderRadius: 10, backgroundColor: ec.surface2, alignItems: 'center', justifyContent: 'center' },
  fontChipActive: { backgroundColor: ec.gold },
  fontChipText: { fontSize: 18, color: ec.text },
});
