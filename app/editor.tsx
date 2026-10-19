import { Ionicons } from '@expo/vector-icons';
import { ColorMatrix, Group, Image as SkImageNode, ImageSVG, Path, Skia, type SkImage, type SkSVG } from '@shopify/react-native-skia';
import { usePreventRemove } from '@react-navigation/native';
import { useNavigation, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { aiEdit, aiStudio, type AiRequest } from '@/src/ai/client';
import type { RetouchOptionId, RetouchStyleId } from '@/src/ai/retouch';
import { addCustomPreset, findPreset, nextRecipeName, removeCustomPreset, useCustomPresets } from '@/src/develop/customPresets';
import { developPresets, presetDevelop, type DevelopPreset } from '@/src/develop/presets';
import { DevelopedImage } from '@/src/develop/shader';
import { defaultDevelop, isDefault } from '@/src/develop/types';
import { Dialog, type DialogAction } from '@/src/Dialog';
import { loadDraft, newDraftId, saveDraft, timeAgo } from '@/src/drafts/drafts';
import { EditorCanvas, ERASE_MARK_COLOR, type PenSettings } from '@/src/editor/EditorCanvas';
import { ERASE_SIZES, ErasePanel, type EraseSize } from '@/src/editor/ErasePanel';
import { inpaint } from '@/src/editor/inpaint';
import { biggerEyes, fullerLips, longerLegs, slimmerNose, slimmer, taller } from '@/src/editor/reshape';
import { fitCrop, isFullCrop, scaleCrop, type CropRect } from '@/src/editor/crop';
import { FrameOverlay, frames } from '@/src/editor/frames';
import {
  blankImage,
  encodeBase64,
  flatten,
  flattenFull,
  imageFromBase64,
  loadPhotoPair,
  padImage,
  pairFromBase64,
  cropImage,
  renderImage,
  renderJpegThumbnail,
  renderThumbnail,
  resizeImage,
  sceneThumbnail,
  transformImage,
  type TransformOp,
} from '@/src/editor/imageOps';
import {
  AiPanel,
  BasicPanel,
  BeautyPanel,
  DrawPanel,
  EffectsPanel,
  FiltersPanel,
  FramePanel,
  StickerPanel,
  TextPanel,
  isShapeTool,
  needsMarks,
  type ShapeTool,
  type TextLook,
  type BasicTool,
  type BeautyMode,
  type BeautyTool,
  type StyleGroup,
  type DevelopKey,
  type DevelopKeyId,
  cropRatioOf,
  type CropChoice,
} from '@/src/editor/panels';
import { DevelopPanel } from '@/src/editor/DevelopPanel';
import { EditorNav } from '@/src/editor/EditorNav';
import { buildMatrix, filters } from '@/src/editor/filters';
import { HistorySheet } from '@/src/editor/HistorySheet';
import { PromptBar } from '@/src/editor/PromptBar';
import { BASE_FONT_SIZE, buildStrokePath } from '@/src/editor/Scene';
import { stickers } from '@/src/editor/stickers';
import { designText, fontOf, textBlock, type TextDesign } from '@/src/editor/text';
import { useEditorFonts } from '@/src/editor/useEditorFonts';
import { defaultAdjust, newId, type Doc, type EraseMark, type Layer, type TransformableLayer } from '@/src/editor/types';
import { CategoryTabs, ec } from '@/src/editor/ui';
import { useDocHistory } from '@/src/editor/useDocHistory';
import { getLanguage } from '@/src/i18n';
import { aiPresetLabel, Icon, type IconSpec } from '@/src/icons';
import { notify } from '@/src/notify';
import { setPendingExport, setPendingPhoto, takePendingPhoto } from '@/src/pendingPhoto';
import { ReportAi } from '@/src/ReportAi';
import { bronzeGradient, cardShadow, font, paintColors } from '@/src/theme';
import { BRAND_BROWN, CamiLogo } from '@/src/ui';
import { track, trackPreset } from '@/src/track';
import { t, useT, type MessageKey } from '@/src/i18n';

type Category = 'basic' | 'beauty' | 'filters' | 'ai' | 'adjust';
type BottomTool = 'effects' | 'text' | 'sticker' | 'frame' | 'draw' | 'erase';
/** 'erase' = Xóa vật thể: paint over what to remove, then remove it on the device or with the AI. */
type Panel = Category | BottomTool;

const categories: Category[] = ['basic', 'beauty', 'filters', 'ai', 'adjust'];

const bottomTools: { id: BottomTool; icon: IconSpec }[] = [
  { id: 'effects', icon: { set: 'mci', name: 'auto-fix' } },
  { id: 'text', icon: { set: 'mci', name: 'format-text' } },
  { id: 'sticker', icon: { set: 'mci', name: 'sticker-emoji' } },
  { id: 'frame', icon: { set: 'mci', name: 'image-frame' } },
  { id: 'draw', icon: { set: 'mci', name: 'draw' } },
  { id: 'erase', icon: { set: 'mci', name: 'eraser' } },
];

const THUMB = 124;

const cropRatioLabels: Partial<Record<TransformOp, string>> = { square: '1:1', portrait: '4:5', classic: '3:4', story: '9:16', landscape: '16:9' };

/** Name of a rotate/flip/crop step in the edit history. */
const transformName = (op: TransformOp) => {
  const ratio = cropRatioLabels[op];
  return ratio ? t('editor.op.crop', { ratio }) : t(`editor.op.${op}` as MessageKey);
};

const aiStepName = (req: AiRequest) => {
  if ('erase' in req) return t('editor.aiStep.erase');
  if ('prompt' in req && req.prompt) return t('editor.aiStep.prompt');
  const id = 'preset' in req ? req.preset : undefined;
  if (id === 'retouch') return t('editor.aiStep.retouch');
  return t('editor.aiStep.preset', { name: id ? aiPresetLabel(id) : t('editor.aiStep.generic') });
};

type DialogState =
  { type: 'recipe'; name: string } | { type: 'recipeMenu'; preset: DevelopPreset } | { type: 'leave'; proceed: () => void } | null;

const freshDoc = (image: Doc['image'], full?: Doc['full'], step?: string): Doc => ({
  image,
  full,
  step,
  develop: defaultDevelop(),
  frame: 'none',
  layers: [],
});

/** Same shape within 1%: the "before" picture can be laid over the current one. */
const sameAspect = (a: SkImage, b: SkImage) => Math.abs(a.width() / a.height() - b.width() / b.height()) < 0.01;

function TopButton({
  icon,
  label,
  onPress,
  disabled,
  active,
}: {
  icon: IconSpec;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => [styles.topBtn, active && styles.topBtnActive, (pressed || disabled) && { opacity: 0.35 }]}
    >
      <Icon icon={icon} size={21} color={active ? ec.gold : ec.text} />
    </Pressable>
  );
}

/** Mark size per free shape tool, times the chosen brush size: a pimple is small, an eye big. */
const SHAPE_BRUSH: Record<ShapeTool, number> = { acne: 0.8, bigeyes: 2, slim: 1.5, legs: 1.5, vline: 1.3, jaw: 1.3, nose: 1.2, fulllips: 1.8, shoulders: 1.5, height: 1 };

export default function Editor() {
  useT();
  const router = useRouter();
  const fonts = useEditorFonts();
  const svgs = useMemo<Record<string, SkSVG | null>>(
    () => Object.fromEntries(stickers.map((s) => [s.id, Skia.SVG.MakeFromString(s.svg)])),
    [],
  );
  const { doc, timeline, position, jumpTo, canUndo, canRedo, checkpoint, update, commit, undo, redo } = useDocHistory(null);
  const original = useRef<SkImage | null>(null);
  const navigation = useNavigation();
  const custom = useCustomPresets();

  // Drafts: once saved, every later change is saved again automatically.
  const [draftId, setDraftId] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [openedDraft, setOpenedDraft] = useState(false);
  const savedDoc = useRef<Doc | null>(null);
  /** Same as savedDoc, as state so "unsaved changes" re-renders (the leave guard depends on it). */
  const [savedMark, setSavedMark] = useState<Doc | null>(null);
  const saveChain = useRef<Promise<void>>(Promise.resolve());
  const [historyOpen, setHistoryOpen] = useState(false);
  // The AI prompt box under the photo is open (the tool panel is hidden to make room above the keyboard).
  const [promptOpen, setPromptOpen] = useState(false);
  // "Xóa vật thể": marks painted over what to remove (not part of the document), brush size and an optional description.
  const [eraseMarks, setEraseMarks] = useState<EraseMark[]>([]);
  const [eraseSize, setEraseSize] = useState<EraseSize>('medium');
  const [eraseText, setEraseText] = useState('');
  const [dialog, setDialog] = useState<DialogState>(null);
  const allowLeave = useRef(false);
  const live = useRef({ doc, draftId, canUndo });
  live.current = { doc, draftId, canUndo };

  const [panel, setPanel] = useState<Panel>('basic');
  const [basicTool, setBasicTool] = useState<BasicTool>('exposure');
  // Free crop: the frame over the photo (image pixels) and its shape.
  const [cropChoice, setCropChoice] = useState<CropChoice>('free');
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const [effectTool, setEffectTool] = useState<DevelopKeyId>('vignette');
  const [beauty, setBeauty] = useState<RetouchOptionId[]>(['face', 'skin']);
  // Làm đẹp opens on "Làm đẹp nhanh"; "Tùy chỉnh nâng cao" switches to the free tools.
  const [beautyMode, setBeautyMode] = useState<BeautyMode>('quick');
  // Phong cách: the makeup, hairstyle, hair color and outfit picked (one per group).
  const [stylePicks, setStylePicks] = useState<Partial<Record<StyleGroup, string>>>({ makeup: 'natural' });
  const [quickStyle, setQuickStyle] = useState<RetouchStyleId | null>('natural');
  const [quickTools, setQuickTools] = useState<RetouchOptionId[]>([]);
  const [beautyTool, setBeautyTool] = useState<BeautyTool>('smooth');
  // How strong bigger eyes / slimmer / longer legs are (0–100).
  const [shapeStrength, setShapeStrength] = useState(50);
  const [brushWidth, setBrushWidth] = useState(26);
  const [compare, setCompare] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pen, setPen] = useState<PenSettings>({ color: paintColors[0], width: 12, kind: 'normal' });
  const [look, setLook] = useState<TextLook>({ font: 'baloo', style: 'sticker', color: '#FFFFFF' });
  // The text layer whose words are being typed: one history step for the whole edit, not one per letter.
  const editingTextId = useRef<string | null>(null);
  const [busy, setBusy] = useState<string | null>(t('common.openingPhoto'));
  const [toast, setToast] = useState<string | null>(null);
  const [stickerThumbs, setStickerThumbs] = useState<Record<string, string>>({});
  const [presetThumbs, setPresetThumbs] = useState<Record<string, string>>({});
  const [lookThumbs, setLookThumbs] = useState<Record<string, string>>({});
  const [frameThumbs, setFrameThumbs] = useState<Record<string, string>>({});

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };
  // The latest AI result, reportable for a short while (Google Play's AI-generated content policy).
  const [lastAi, setLastAi] = useState<{ image: SkImage; tool: string; prompt: string; at: number } | null>(null);
  const offerReport = (image: SkImage, tool: string, prompt = '') => {
    const at = Date.now();
    setLastAi({ image, tool, prompt, at });
    setTimeout(() => setLastAi((cur) => (cur?.at === at ? null : cur)), 30_000);
  };
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));

  /** Runs an operation on the flattened picture and replaces the doc with the result. */
  const runFlattened = async (base: Doc, message: string, step: string, op: (flat: SkImage) => Promise<SkImage>) => {
    setBusy(message);
    setSelectedId(null);
    setCompare(false);
    try {
      commit(freshDoc(await op(await flatten(base, fonts, svgs)), undefined, step));
      return true;
    } catch (e: any) {
      showToast(e.message ?? t('common.error'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  /** Free crop of the working picture and, at the same place, of the full-resolution original. */
  const runCrop = async (base: Doc, r: CropRect, label: string) => {
    setBusy(t('editor.processing'));
    setSelectedId(null);
    setCompare(false);
    try {
      const image = await cropImage(await flatten(base, fonts, svgs), r);
      const hasFull = base.full && base.full !== base.image;
      const full = hasFull ? await cropImage(await flattenFull(base, fonts, svgs), scaleCrop(r, base.full!.width() / base.image.width())) : undefined;
      commit(freshDoc(image, full, label));
      // Done cropping: leave the crop tool so its frame doesn't come back over the new picture (tap "Cắt" to crop again).
      setBasicTool('exposure');
    } catch (e: any) {
      showToast(e.message ?? t('common.error'));
    } finally {
      setBusy(null);
    }
  };

  /** Rotates/flips/crops the working picture and, separately, the full-resolution original. */
  const runTransform = async (base: Doc, op: TransformOp) => {
    setBusy(t('editor.processing'));
    setSelectedId(null);
    setCompare(false);
    try {
      const image = await transformImage(await flatten(base, fonts, svgs), op);
      const hasFull = base.full && base.full !== base.image;
      const full = hasFull ? await transformImage(await flattenFull(base, fonts, svgs), op) : undefined;
      commit(freshDoc(image, full, transformName(op)));
    } catch (e: any) {
      showToast(e.message ?? t('common.error'));
    } finally {
      setBusy(null);
    }
  };

  const runAi = async (base: Doc, req: AiRequest) => {
    let summary = '';
    const ok = await runFlattened(base, t('editor.aiWorking'), aiStepName(req), async (flat) => {
      let input = await resizeImage(flat, 1024);
      if ('preset' in req && req.preset === 'expand') input = await resizeImage(await padImage(input), 1024);
      const result = await aiEdit(encodeBase64(input, 88), req);
      summary = result.summary;
      const out = await imageFromBase64(result.image);
      offerReport(out, 'preset' in req ? `preset.${req.preset}` : 'prompt', 'prompt' in req ? req.prompt : '');
      return out;
    });
    if (ok) showToast(`Xong ✨ ${summary}`);
  };

  /** Phong cách: new makeup, hair and/or outfit with AI (the studio's hair & makeup tool). */
  const runStyle = async (base: Doc) => {
    const choices = Object.fromEntries(Object.entries(stylePicks).flatMap(([g, id]) => (id ? [[g, [id]]] : [])));
    if (!Object.keys(choices).length) {
      showToast(t('beauty.style.empty'));
      return;
    }
    let summary = '';
    const ok = await runFlattened(base, t('studio.style.busy'), t('studio.style.title'), async (flat) => {
      const input = await resizeImage(flat, 1024);
      const result = await aiStudio('style', choices, encodeBase64(input, 88));
      summary = result.summary;
      const out = await imageFromBase64(result.image);
      offerReport(out, 'studio.style');
      return out;
    });
    if (ok) showToast(`Xong ✨ ${summary}`);
  };

  /** Removes what was painted over (drawn in red on the copy sent to the AI) and/or described. */
  const runErase = async () => {
    if (!doc) return;
    const marks = eraseMarks;
    const text = eraseText.trim();
    if (!marks.length && !text) {
      showToast(t('editor.erase.empty'));
      return;
    }
    let summary = '';
    const ok = await runFlattened(doc, t('editor.erase.busy'), t('editor.aiStep.erase'), async (flat) => {
      const w = flat.width();
      const h = flat.height();
      const marked = marks.length
        ? await renderImage(
            <Group>
              <SkImageNode image={flat} x={0} y={0} width={w} height={h} />
              {marks.map((m, i) => (
                <Path key={i} path={buildStrokePath(m.points)} style="stroke" strokeWidth={m.width} strokeCap="round" strokeJoin="round" color={ERASE_MARK_COLOR} />
              ))}
            </Group>,
            w,
            h,
          )
        : flat;
      const result = await aiEdit(encodeBase64(await resizeImage(marked, 1024), 90), { erase: true, marked: marks.length > 0, ...(text && { prompt: text }) });
      summary = result.summary;
      const out = await imageFromBase64(result.image);
      offerReport(out, 'erase-brush', text);
      return out;
    });
    if (ok) {
      setEraseMarks([]);
      setEraseText('');
      showToast(`Xong ✨ ${summary}`);
    }
  };

  /** Free beauty tools that work on painted marks (acne healing and face / body reshaping), on the device. */
  const runShape = async () => {
    if (!doc || !isShapeTool(beautyTool)) return;
    const marks = eraseMarks;
    if (!marks.length && needsMarks(beautyTool)) {
      showToast(t('editor.erase.needMarks'));
      return;
    }
    const tool = beautyTool;
    // V-line, jaw, shoulders and waist push the way the finger moved: a tap alone has no direction.
    const pushes = tool === 'slim' || tool === 'vline' || tool === 'jaw' || tool === 'shoulders';
    const swiped = (m: EraseMark) => {
      const n = m.points.length;
      return n >= 4 && Math.hypot(m.points[n - 2] - m.points[0], m.points[n - 1] - m.points[1]) > m.width * 0.25;
    };
    if (pushes && !marks.some(swiped)) {
      showToast(t(`beauty.${tool}Hint`));
      return;
    }
    const amount = shapeStrength / 100;
    const ok = await runFlattened(doc, t('editor.processing'), t(`beauty.${tool}`), (flat) =>
      tool === 'acne'
        ? inpaint(flat, marks)
        : tool === 'bigeyes'
          ? biggerEyes(flat, marks, amount)
          : tool === 'fulllips'
            ? fullerLips(flat, marks, amount)
            : tool === 'nose'
              ? slimmerNose(flat, marks, amount)
              : tool === 'legs'
                ? longerLegs(flat, marks, amount)
                : tool === 'height'
                  ? taller(flat, amount)
                  : slimmer(flat, marks, amount),
    );
    if (ok) setEraseMarks([]);
  };

  /** "Xóa nhanh": removes the painted area on the device, without AI (free, offline). */
  const runEraseQuick = async () => {
    if (!doc) return;
    const marks = eraseMarks;
    if (!marks.length) {
      showToast(t('editor.erase.needMarks'));
      return;
    }
    const ok = await runFlattened(doc, t('editor.erase.quickBusy'), t('editor.step.eraseQuick'), (flat) => inpaint(flat, marks));
    if (ok) {
      setEraseMarks([]);
      track('erase_quick');
    }
  };

  // Load the photo chosen on another screen, then apply what the user picked there.
  useEffect(() => {
    const pending = takePendingPhoto();
    if (!pending) {
      router.replace('/');
      return;
    }
    if (pending.kind === 'draft') {
      loadDraft(pending.id)
        .then((d) => {
          original.current = d.image;
          savedDoc.current = d;
          setSavedMark(d);
          commit(d);
          setDraftId(pending.id);
          setOpenedDraft(true);
          track('draft_resume');
          if (d.preset) setPanel('filters');
        })
        .catch((e) => {
          notify(e.message ?? t('editor.cantOpenDraft'));
          leave();
        })
        .finally(() => setBusy(null));
      return;
    }
    const load: Promise<{ image: SkImage; full?: SkImage }> =
      pending.kind === 'uri'
        ? loadPhotoPair(pending.uri)
        : pending.kind === 'base64'
          ? pairFromBase64(pending.data)
          : pending.kind === 'image'
            ? Promise.resolve({ image: pending.image, full: pending.full })
            : blankImage(pending.gradient ?? pending.color, pending.width, pending.height).then((image) => ({ image }));
    load
      .then(({ image, full }) => {
        original.current = image;
        const first = freshDoc(image, full);
        const intent = pending.intent;
        commit(first);
        if (intent?.type === 'ai' && intent.preset === 'erase') {
          setPanel('erase');
        } else if (intent?.type === 'ai') {
          setPanel('ai');
          runAi(first, { preset: intent.preset });
        } else if (pending.kind === 'blank') {
          setPanel('draw');
        }
      })
      .catch((e) => {
        notify(e.message ?? t('common.cantOpenPhoto'));
        leave();
      })
      .finally(() => setBusy((b) => (b === t('common.openingPhoto') ? null : b)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    Promise.all(
      stickers.map(async (s) => {
        const svg = svgs[s.id];
        if (!svg) return [s.id, ''] as const;
        return [s.id, await renderThumbnail(<ImageSVG svg={svg} x={0} y={0} width={100} height={100} />, 100, 100)] as const;
      }),
    ).then((entries) => setStickerThumbs(Object.fromEntries(entries)));
  }, [svgs]);

  // Preset and frame previews are rendered from the user's own photo.
  const image = doc?.image;
  useEffect(() => {
    if (!image) return;
    let cancelled = false;
    (async () => {
      const small = await resizeImage(image, 200);
      const plain = <SkImageNode image={small} x={0} y={0} width={THUMB} height={THUMB} fit="cover" />;
      const presets = await Promise.all(
        [...custom, ...developPresets].map(async (p) => [
          p.id,
          await renderThumbnail(
            <DevelopedImage image={small} develop={presetDevelop(p)} width={THUMB} height={THUMB} fit="cover" />,
            THUMB,
            THUMB,
          ),
        ]),
      );
      const none = await renderThumbnail(plain, THUMB, THUMB);
      if (cancelled) return;
      setPresetThumbs({ none, ...Object.fromEntries(presets) });
      const looks = await Promise.all(
        filters.map(async (f) => [
          f.id,
          await renderThumbnail(
            <SkImageNode image={small} x={0} y={0} width={THUMB} height={THUMB} fit="cover">
              <ColorMatrix matrix={buildMatrix(f.id, defaultAdjust)} />
            </SkImageNode>,
            THUMB,
            THUMB,
          ),
        ]),
      );
      if (cancelled) return;
      setLookThumbs(Object.fromEntries(looks));
      const frameEntries = await Promise.all(
        frames.map(async (f) => [
          f.id,
          await renderThumbnail(
            <Group>
              {plain}
              <FrameOverlay frame={f.id} width={THUMB} height={THUMB} />
            </Group>,
            THUMB,
            THUMB,
          ),
        ]),
      );
      if (!cancelled) setFrameThumbs(Object.fromEntries(frameEntries));
    })();
    return () => {
      cancelled = true;
    };
  }, [image, custom]);

  /** Writes the draft; saves run one after another so an older save never lands last. */
  const writeDraft = (d: Doc, id: string) => {
    const run = saveChain.current.then(async () => {
      await saveDraft(id, d, await sceneThumbnail(d, fonts, svgs));
      savedDoc.current = d;
      setSavedMark(d);
      setSavedAt(Date.now());
    });
    saveChain.current = run.catch(() => {});
    return run;
  };

  useEffect(() => {
    if (!draftId || !doc || doc === savedDoc.current) return;
    const timer = setTimeout(() => writeDraft(doc, draftId).catch((e) => showToast(e.message ?? t('editor.draftSaveFailed'))), 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, draftId]);

  const saveDraftNow = async () => {
    const current = live.current.doc;
    if (!current) return false;
    const id = draftId ?? newDraftId();
    setBusy(t('editor.savingDraft'));
    setSelectedId(null);
    try {
      await writeDraft(current, id);
      setDraftId(id);
      return true;
    } catch (e: any) {
      showToast(e.message ?? t('editor.draftSaveFailed'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  // Leaving with unsaved edits asks first; a picture that already has a draft is simply saved again.
  // usePreventRemove (not a plain beforeRemove listener) also blocks the iOS swipe-back gesture.
  const unsaved = !!doc && doc !== savedMark && (!!draftId || canUndo);
  usePreventRemove(unsaved, ({ data }) => {
    const proceed = () => {
      allowLeave.current = true;
      navigation.dispatch(data.action);
    };
    const { doc: d, draftId: id } = live.current;
    if (allowLeave.current || !d) proceed();
    // If the automatic save fails, ask instead of silently losing the edits.
    else if (id) writeDraft(d, id).then(proceed, () => setDialog({ type: 'leave', proceed }));
    else setDialog({ type: 'leave', proceed });
  });

  /**
   * Undo / redo for the buttons and the keyboard: while painting what to erase, the last mark goes first;
   * otherwise one step of the edit history.
   */
  const undoStep = () => {
    if ((panel === 'erase' || shapeTool) && eraseMarks.length) return setEraseMarks((m) => m.slice(0, -1));
    setSelectedId(null);
    undo();
  };
  const redoStep = () => {
    setSelectedId(null);
    redo();
  };
  const shortcuts = useRef({ undoStep, redoStep, busy });
  shortcuts.current = { undoStep, redoStep, busy };
  // Ctrl+Z / ⌘Z undo, Ctrl+Y / Ctrl+Shift+Z / ⌘⇧Z redo (web). Typing in a text box keeps its own undo.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const key = e.key.toLowerCase();
      const redoKey = key === 'y' || (key === 'z' && e.shiftKey);
      if (key !== 'z' && !redoKey) return;
      e.preventDefault();
      if (shortcuts.current.busy) return;
      if (redoKey) shortcuts.current.redoStep();
      else shortcuts.current.undoStep();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const cropping = panel === 'basic' && basicTool === 'crop';
  const pictureForCrop = doc?.image;
  useEffect(() => {
    if (!cropping || !pictureForCrop) return;
    setCropRect(fitCrop(pictureForCrop.width(), pictureForCrop.height(), cropRatioOf(cropChoice)));
    // The shape is applied by chooseCropShape; here only a new tool session or a new picture resets the frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cropping, pictureForCrop]);

  if (!doc) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <ActivityIndicator size="large" color={ec.gold} />
      </SafeAreaView>
    );
  }

  const iw = doc.image.width();
  const ih = doc.image.height();
  const minSide = Math.min(iw, ih);
  const selected = doc.layers.find((l): l is TransformableLayer => l.id === selectedId && (l.kind === 'sticker' || l.kind === 'text'));
  const compareWith = compare && original.current && sameAspect(original.current, doc.image) ? original.current : null;

  const addLayer = (layer: Layer) => {
    commit({ ...doc, layers: [...doc.layers, layer] });
    if (layer.kind === 'sticker' || layer.kind === 'text') setSelectedId(layer.id);
  };

  /** Adds words in a look, centred low on the picture, shrunk so every line fits. */
  const addText = (text: string, l: TextLook) => {
    const b = textBlock(fontOf(fonts, l), text, BASE_FONT_SIZE);
    const size = Math.min(minSide * 0.12, (iw * 0.85 * BASE_FONT_SIZE) / Math.max(b.width, 1), (ih * 0.45 * BASE_FONT_SIZE) / (b.lineHeight * b.lines.length));
    editingTextId.current = null;
    // A little apart from the previous one, so several designs don't land exactly on top of each other.
    const jitter = () => (Math.random() - 0.5) * minSide * 0.12;
    addLayer({ kind: 'text', id: newId(), text, color: l.color, font: l.font, style: l.style, x: iw / 2 + jitter(), y: ih * (b.lines.length > 1 ? 0.72 : 0.78) + jitter(), size, rotation: 0 });
  };

  const patchSelected = (fn: (l: TransformableLayer) => Partial<TransformableLayer>) => {
    if (!selected) return;
    commit({ ...doc, layers: doc.layers.map((l) => (l.id === selected.id ? ({ ...l, ...fn(selected) } as Layer) : l)) });
  };

  const removeSelected = () => {
    if (!selected) return;
    commit({ ...doc, layers: doc.layers.filter((l) => l.id !== selected.id) });
    setSelectedId(null);
  };

  const setDevelopValue = (k: DevelopKey, v: number) =>
    update((d) => ({ ...d, develop: { ...d.develop, [k.group]: { ...d.develop[k.group], [k.key]: v } } }));

  const pickPreset = (id: string | null) => {
    const p = id ? findPreset(id) : undefined;
    if (!p) {
      commit({ ...doc, develop: defaultDevelop(), preset: undefined });
      return;
    }
    const intensity = doc.preset?.intensity ?? 80;
    trackPreset(p.id);
    commit({ ...doc, develop: presetDevelop(p, intensity), preset: { id: p.id, intensity } });
  };

  const setPresetIntensity = (v: number) => {
    const p = doc.preset && findPreset(doc.preset.id);
    if (p) update((d) => ({ ...d, develop: presetDevelop(p, v), preset: { id: p.id, intensity: v } }));
  };

  const askRecipeName = () => {
    if (isDefault(doc.develop)) {
      showToast(t('recipe.adjustOrFilterFirst'));
      return;
    }
    setDialog({ type: 'recipe', name: nextRecipeName(custom) });
  };

  const saveRecipe = async (name: string) => {
    setDialog(null);
    try {
      const small = await resizeImage(doc.image, 480);
      const thumb = await renderJpegThumbnail(
        <DevelopedImage image={small} develop={doc.develop} width={360} height={280} fit="cover" />,
        360,
        280,
      );
      const p = await addCustomPreset(name, doc.develop, thumb);
      checkpoint();
      update((d) => ({ ...d, preset: { id: p.id, intensity: 100 } }));
      showToast(t('recipe.savedToFilters', { name: p.name }));
    } catch (e: any) {
      showToast(e.message ?? t('recipe.saveFailed'));
    }
  };

  /** Flattens the picture and opens the Export screen (format, quality, size, destination). */
  const openExport = async () => {
    setBusy(t('common.preparing'));
    setSelectedId(null);
    try {
      setPendingExport(await flattenFull(doc, fonts, svgs));
      router.push('/export');
    } catch (e: any) {
      showToast(e.message ?? t('common.error'));
    } finally {
      setBusy(null);
    }
  };

  /** Hands the current picture to the Retouch or Adjust screen, which comes back here with the result. */
  const openScreen = async (type: 'retouch' | 'adjust') => {
    setBusy(t('common.opening'));
    setSelectedId(null);
    try {
      const flat = await flatten(doc, fonts, svgs);
      const full = doc.full && doc.full !== doc.image ? await flattenFull(doc, fonts, svgs) : undefined;
      if (draftId) await writeDraft(doc, draftId).catch(() => {});
      setPendingPhoto({ kind: 'image', image: flat, full, intent: { type } });
      allowLeave.current = true;
      router.replace(type === 'retouch' ? '/retouch' : '/adjust');
    } catch (e: any) {
      showToast(e.message ?? t('common.error'));
      setBusy(null);
    }
  };

  const choosePanel = (p: Panel) => {
    // Marks belong to the panel they were painted in (Xóa vật thể or a beauty tool): never carry them to another one.
    if (p !== panel) setEraseMarks([]);
    if (p === 'beauty') setBeautyMode('quick');
    setPanel(p);
    if (p === 'draw') setSelectedId(null);
  };

  const toggleCompare = () => {
    if (!compare && !(original.current && sameAspect(original.current, doc.image))) {
      showToast(t('editor.cantCompare'));
      return;
    }
    setSelectedId(null);
    setCompare((c) => !c);
  };

  const slider = { develop: doc.develop, onStart: checkpoint, onDevelop: setDevelopValue };
  // The teeth / under-eye brushes paint masks on the canvas instead of moving stickers.
  const brushEffect =
    panel === 'beauty' && beautyMode === 'free' && (beautyTool === 'whiten' || beautyTool === 'lighten' || beautyTool === 'lips' || beautyTool === 'blush' || beautyTool === 'brows')
      ? beautyTool
      : null;
  // Acne, bigger eyes, slimmer and longer legs mark the photo like "Xóa vật thể", then apply.
  const shapeTool = panel === 'beauty' && beautyMode === 'free' && isShapeTool(beautyTool) && needsMarks(beautyTool) ? beautyTool : null;
  const canvasMode = cropping ? 'crop' : panel === 'erase' || shapeTool ? 'erase' : panel === 'draw' ? 'draw' : brushEffect ? 'retouch' : 'move';
  const chooseCropShape = (c: CropChoice) => {
    setCropChoice(c);
    setCropRect(fitCrop(iw, ih, cropRatioOf(c)));
  };
  const cropChanged = !!cropRect && !isFullCrop(cropRect, iw, ih);
  const applyCrop = () => {
    if (!cropRect || !cropChanged) return;
    const shape = cropChoice === 'free' ? t('editor.crop.free') : (cropRatioLabels[cropChoice] ?? '');
    runCrop(doc, cropRect, t('editor.op.crop', { ratio: shape }));
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      {/* iOS: lift the AI prompt box above the keyboard (Android resizes the window itself). */}
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.topBar}>
        <Pressable onPress={leave} hitSlop={6} style={({ pressed }) => [styles.brand, pressed && { opacity: 0.7 }]} accessibilityLabel={t('common.back')}>
          <Icon icon={{ set: 'ion', name: 'chevron-back' }} size={18} color={ec.textSoft} />
          <CamiLogo size={30} />
          <View style={styles.brandText}>
            <Text style={styles.brandName}>CamIA</Text>
            <Text style={styles.brandSub} numberOfLines={1}>
              {t('common.tagline')}
            </Text>
          </View>
        </Pressable>
        <View style={styles.topCenter}>
          <TopButton
            icon={{ set: 'ion', name: 'arrow-undo-outline' }}
            label={`${t('common.undo')} (Ctrl+Z)`}
            onPress={undoStep}
            disabled={!canUndo && !((panel === 'erase' || shapeTool) && eraseMarks.length)}
          />
          <TopButton icon={{ set: 'ion', name: 'arrow-redo-outline' }} label={`${t('common.redo')} (Ctrl+Y)`} onPress={redoStep} disabled={!canRedo} />
          <TopButton
            icon={{ set: 'ion', name: 'time-outline' }}
            label={t('editor.history')}
            onPress={() => {
              setSelectedId(null);
              setHistoryOpen(true);
            }}
            active={historyOpen}
          />
          <TopButton icon={{ set: 'mci', name: 'compare' }} label={t('editor.compare')} onPress={toggleCompare} active={compare} />
        </View>
        <Pressable style={({ pressed }) => [pressed && { opacity: 0.85 }]} onPress={openExport}>
          <LinearGradient colors={bronzeGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.saveBtn}>
            <Icon icon={{ set: 'ion', name: 'share-outline' }} size={16} color="#FFFFFF" />
            <Text style={styles.saveText}>{t('common.save')}</Text>
          </LinearGradient>
        </Pressable>
      </View>

      <EditorCanvas
        doc={doc}
        fonts={fonts}
        svgs={svgs}
        mode={canvasMode}
        brush={brushEffect ? { effect: brushEffect, width: brushWidth } : undefined}
        pen={pen}
        selectedId={selectedId}
        onSelect={setSelectedId}
        checkpoint={checkpoint}
        update={update}
        compareWith={compareWith}
        erase={{ marks: eraseMarks, width: shapeTool ? brushWidth * SHAPE_BRUSH[shapeTool] : ERASE_SIZES[eraseSize], onChange: setEraseMarks }}
        crop={cropping && cropRect ? { rect: cropRect, ratio: cropRatioOf(cropChoice), onChange: setCropRect } : undefined}
      />

      {selected && panel !== 'draw' && !compareWith && (
        <View style={styles.layerBar}>
          {(
            [
              ['remove', t('editor.layer.smaller'), () => patchSelected((l) => ({ size: Math.max(20, l.size * 0.8) }))],
              ['add', t('editor.layer.bigger'), () => patchSelected((l) => ({ size: l.size * 1.25 }))],
              ['refresh', t('editor.layer.rotate'), () => patchSelected((l) => ({ rotation: l.rotation + Math.PI / 12 }))],
              ...(selected.kind === 'text' ? [['color-palette-outline', t('editor.layer.color'), () => patchSelected(() => ({ color: look.color }))]] : []),
              ['trash-outline', t('editor.layer.delete'), removeSelected],
              ['checkmark', t('editor.layer.done'), () => setSelectedId(null)],
            ] as [React.ComponentProps<typeof Ionicons>['name'], string, () => void][]
          ).map(([icon, label, onPress]) => (
            <Pressable key={label} onPress={onPress} style={styles.layerBtn}>
              <Ionicons name={icon} size={19} color={ec.text} />
              <Text style={styles.layerText}>{label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Describe the edit for the AI, on every tab (hidden while a sticker or text is being edited, or comparing). */}
      {!compareWith && !(selected && panel !== 'draw') && panel !== 'erase' && !cropping && <PromptBar onSubmit={(prompt) => runAi(doc, { prompt })} onExpand={setPromptOpen} />}

      {/* Kept mounted while the prompt is open, so the panels keep their state. */}
      <View style={styles.controls}>
      <View style={[styles.sheet, promptOpen && styles.hidden]}>
        <CategoryTabs
          tabs={categories.map((id) => ({ id, label: t(`editor.tab.${id}` as MessageKey) }))}
          value={(categories.includes(panel as Category) ? panel : null) as Category | null}
          onChange={choosePanel}
        />
        <View
          style={[
            styles.panel,
            (panel === 'adjust' || panel === 'text' || panel === 'sticker' || panel === 'beauty') && styles.panelTall,
            panel === 'beauty' && beautyMode === 'free' && isShapeTool(beautyTool) && styles.panelShape,
            panel === 'beauty' && beautyMode === 'quick' && styles.panelQuick,
          ]}
        >
          {panel === 'basic' && (
            <BasicPanel
              {...slider}
              tool={basicTool}
              onTool={setBasicTool}
              onTransform={(op) => runTransform(doc, op)}
              crop={{ choice: cropChoice, onChoice: chooseCropShape, changed: cropChanged, onReset: () => chooseCropShape(cropChoice), onApply: applyCrop }}
            />
          )}
          {panel === 'beauty' && (
            <BeautyPanel
              mode={beautyMode}
              onMode={(m) => {
                setBeautyMode(m);
                setEraseMarks([]);
              }}
              tool={beautyTool}
              onTool={(t) => {
                setBeautyTool(t);
                setSelectedId(null);
                setEraseMarks([]);
              }}
              develop={doc.develop}
              onStart={checkpoint}
              onBeauty={(key, v) => update((d) => ({ ...d, develop: { ...d.develop, beauty: { ...d.develop.beauty, [key]: v } } }))}
              brushWidth={brushWidth}
              onBrushWidth={setBrushWidth}
              onClearBrush={(effect) =>
                commit({ ...doc, layers: doc.layers.filter((l) => !(l.kind === 'retouch' && l.effect === effect)) })
              }
              marks={eraseMarks.length}
              strength={shapeStrength}
              onStrength={setShapeStrength}
              onClearMarks={() => setEraseMarks([])}
              onApplyShape={runShape}
              comparing={compare}
              onCompare={toggleCompare}
              aiSelected={beauty}
              onAiToggle={(id) => setBeauty((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))}
              onAiRun={() => runAi(doc, { preset: 'retouch', options: beauty })}
              onAdvanced={() => openScreen('retouch')}
              quick={{
                style: quickStyle,
                onStyle: setQuickStyle,
                selected: quickTools,
                onToggle: (id) => setQuickTools((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])),
                onRun: () => runAi(doc, { preset: 'retouch', options: quickTools, ...(quickStyle && { style: quickStyle }) }),
              }}
              look={{
                picks: stylePicks,
                onPick: (g, id) => setStylePicks((p) => ({ ...p, [g]: id ?? undefined })),
                onRun: () => runStyle(doc),
              }}
            />
          )}
          {panel === 'filters' && (
            <FiltersPanel
              thumbs={presetThumbs}
              custom={custom}
              preset={doc.preset}
              onPick={pickPreset}
              onIntensity={setPresetIntensity}
              onStart={checkpoint}
              onSaveRecipe={askRecipeName}
              onRecipeMenu={(preset) => setDialog({ type: 'recipeMenu', preset })}
            />
          )}
          {panel === 'ai' && <AiPanel onPreset={(preset) => (preset === 'erase' ? choosePanel('erase') : runAi(doc, { preset }))} />}
          {panel === 'erase' && (
            <ErasePanel
              size={eraseSize}
              onSize={setEraseSize}
              marks={eraseMarks.length}
              onUndoMark={() => setEraseMarks((m) => m.slice(0, -1))}
              onClearMarks={() => setEraseMarks([])}
              text={eraseText}
              onText={setEraseText}
              onRun={runErase}
              onQuick={runEraseQuick}
              onAuto={() => runAi(doc, { preset: 'erase' })}
            />
          )}
          {panel === 'adjust' && (
            <DevelopPanel
              develop={doc.develop}
              lookThumbs={lookThumbs}
              onStart={checkpoint}
              onChange={(fn) => update((d) => ({ ...d, develop: fn(d.develop) }))}
              onCommit={(fn) => commit({ ...doc, develop: fn(doc.develop) })}
            />
          )}
          {panel === 'effects' && <EffectsPanel {...slider} active={effectTool} onActive={setEffectTool} />}
          {panel === 'text' && (
            <TextPanel
              look={look}
              onLook={(patch) => {
                setLook((l) => ({ ...l, ...patch }));
                if (selected?.kind === 'text') patchSelected(() => patch);
              }}
              selectedText={selected?.kind === 'text' ? selected.text : null}
              onAdd={(text) => addText(text, look)}
              onEdit={(text) => {
                if (selected?.kind !== 'text') return;
                if (editingTextId.current !== selected.id) {
                  checkpoint();
                  editingTextId.current = selected.id;
                }
                update((d) => ({ ...d, layers: d.layers.map((l) => (l.id === selected.id && l.kind === 'text' ? { ...l, text } : l)) }));
              }}
              onDesign={(d: TextDesign) => {
                const next = { font: d.font, style: d.style, color: d.color };
                setLook(next);
                addText(designText(d, getLanguage()), next);
              }}
            />
          )}
          {panel === 'sticker' && (
            <StickerPanel
              thumbs={stickerThumbs}
              onAdd={(stickerId) =>
                addLayer({
                  kind: 'sticker',
                  id: newId(),
                  stickerId,
                  x: iw / 2 + (Math.random() - 0.5) * minSide * 0.2,
                  y: ih / 2 + (Math.random() - 0.5) * minSide * 0.2,
                  size: minSide * 0.3,
                  rotation: 0,
                })
              }
            />
          )}
          {panel === 'frame' && <FramePanel value={doc.frame} thumbs={frameThumbs} onPick={(frame) => commit({ ...doc, frame })} />}
          {panel === 'draw' && <DrawPanel pen={pen} onChange={setPen} />}
        </View>

      </View>

      <View style={[styles.bottomBar, promptOpen && styles.hidden]}>
        {bottomTools.map((tool) => {
          const active = panel === tool.id;
          return (
            <Pressable
              key={tool.id}
              onPress={() => choosePanel(tool.id)}
              style={({ pressed }) => [styles.bottomItem, active && styles.bottomItemActive, pressed && { opacity: 0.75 }]}
            >
              <Icon icon={tool.icon} size={22} color={ec.gold} />
              <Text style={[styles.bottomLabel, active && { color: ec.gold, fontFamily: font.semi }]} numberOfLines={1}>
                {t(`editor.tool.${tool.id}` as MessageKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.nav, promptOpen && styles.hidden]}>
        <EditorNav />
      </View>
      </View>

      <HistorySheet
        visible={historyOpen}
        timeline={timeline}
        position={position}
        firstLabel={openedDraft ? t('editor.openedDraft') : t('common.original')}
        draftStatus={
          draftId ? (savedAt ? t('editor.autoSaved', { time: timeAgo(savedAt) }) : t('editor.autoSaveOn')) : t('editor.noDraft')
        }
        onJump={(i) => {
          setSelectedId(null);
          jumpTo(i);
        }}
        onSaveDraft={async () => {
          setHistoryOpen(false);
          if (await saveDraftNow()) showToast(t('editor.draftSaved'));
        }}
        onClose={() => setHistoryOpen(false)}
      />

      <Dialog
        visible={!!dialog}
        onClose={() => setDialog(null)}
        {...dialogProps(dialog, {
          setName: (name) => setDialog({ type: 'recipe', name }),
          saveRecipe,
          close: () => setDialog(null),
          deleteRecipe: async (p) => {
            setDialog(null);
            await removeCustomPreset(p.id);
            if (doc.preset?.id === p.id) update((d) => ({ ...d, preset: undefined }));
            showToast(t('recipe.deleted', { name: p.name }));
          },
          applyRecipe: (p) => {
            setDialog(null);
            pickPreset(p.id);
          },
          saveAndLeave: async (proceed) => {
            setDialog(null);
            if (await saveDraftNow()) proceed();
          },
        })}
      />

      {toast && (
        <View pointerEvents="none" style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      {lastAi && !busy && !toast && (
        <View style={styles.reportPill}>
          <ReportAi tool={lastAi.tool} image={lastAi.image} prompt={lastAi.prompt} />
        </View>
      )}

      {busy && (
        <View style={styles.overlay}>
          <View style={styles.busyCard}>
            <Icon icon={{ set: 'ion', name: 'sparkles' }} size={30} color={ec.gold} />
            <ActivityIndicator size="small" color={ec.gold} />
            <Text style={styles.busyText}>{busy}</Text>
          </View>
        </View>
      )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Title, message, text field and buttons for whichever dialog is open. */
function dialogProps(
  dialog: DialogState,
  on: {
    setName: (name: string) => void;
    saveRecipe: (name: string) => void;
    close: () => void;
    deleteRecipe: (p: DevelopPreset) => void;
    applyRecipe: (p: DevelopPreset) => void;
    saveAndLeave: (proceed: () => void) => void;
  },
): {
  title: string;
  message?: string;
  input?: { value: string; onChange: (v: string) => void; placeholder?: string };
  actions: DialogAction[];
} {
  if (dialog?.type === 'recipe') {
    return {
      title: t('recipe.saveTitle'),
      message: t('recipe.saveMsgEditor'),
      input: { value: dialog.name, onChange: on.setName, placeholder: t('recipe.namePlaceholder') },
      actions: [
        { label: t('common.save'), primary: true, onPress: () => on.saveRecipe(dialog.name) },
        { label: t('common.cancel'), onPress: on.close },
      ],
    };
  }
  if (dialog?.type === 'recipeMenu') {
    return {
      title: dialog.preset.name,
      message: t('editor.recipeMenuMsg'),
      actions: [
        { label: t('common.apply'), primary: true, onPress: () => on.applyRecipe(dialog.preset) },
        { label: t('recipe.delete'), destructive: true, onPress: () => on.deleteRecipe(dialog.preset) },
        { label: t('common.close'), onPress: on.close },
      ],
    };
  }
  if (dialog?.type === 'leave') {
    return {
      title: t('editor.leaveTitle'),
      message: t('editor.leaveMsg'),
      actions: [
        { label: t('editor.leaveSave'), primary: true, onPress: () => on.saveAndLeave(dialog.proceed) },
        { label: t('editor.leaveDiscard'), destructive: true, onPress: dialog.proceed },
        { label: t('editor.leaveStay'), onPress: on.close },
      ],
    };
  }
  return { title: '', actions: [] };
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ec.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
  },
  brand: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandText: { flexShrink: 1, minWidth: 0 },
  brandName: { fontFamily: font.bold, fontSize: 16, letterSpacing: 0.3, color: BRAND_BROWN },
  brandSub: { fontFamily: font.regular, fontSize: 10.5, color: ec.textSoft },
  topCenter: { flexDirection: 'row', gap: 2 },
  topBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  topBtnActive: { backgroundColor: ec.goldSoft },
  saveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 9 },
  saveText: { fontFamily: font.semi, fontSize: 14, color: '#FFFFFF' },
  layerBar: {
    flexDirection: 'row',
    alignSelf: 'center',
    gap: 4,
    backgroundColor: ec.surface2,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: ec.border,
  },
  layerBtn: { alignItems: 'center', minWidth: 40, gap: 1 },
  layerText: { fontFamily: font.regular, fontSize: 10, color: ec.textSoft },
  // White card with the category tabs and the current tool panel.
  sheet: {
    backgroundColor: ec.surface,
    borderRadius: 22,
    paddingTop: 12,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    ...cardShadow,
  },
  fill: { flex: 1 },
  hidden: { display: 'none' },
  // Fixed height so the tabs don't jump when switching between taller and shorter panels.
  panel: { height: 184, justifyContent: 'center' },
  // Điều chỉnh holds sections, sliders or the curve, and the quick looks.
  panelTall: { height: 236, justifyContent: 'flex-start', paddingTop: 4, paddingBottom: 8 },
  // Face and body reshaping: the strength slider and Reset / Compare / Apply get rows of their own.
  panelShape: { height: 278 },
  // Làm đẹp nhanh: the beauty tabs, the looks, the quick tools and "Áp dụng ngay".
  panelQuick: { height: 316 },
  // Row of white tiles: Hiệu ứng · Văn bản · Sticker · Khung · Vẽ.
  bottomBar: { flexDirection: 'row', gap: 8, paddingTop: 10, width: '100%', maxWidth: 760, alignSelf: 'center' },
  bottomItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 9,
    borderRadius: 16,
    backgroundColor: ec.surface,
    borderWidth: 1,
    borderColor: 'transparent',
    ...cardShadow,
    shadowOpacity: 0.06,
  },
  bottomItemActive: { borderColor: ec.gold, backgroundColor: '#FFFBF4' },
  bottomLabel: { fontFamily: font.regular, fontSize: 11, color: ec.text },
  controls: { paddingHorizontal: 12 },
  nav: { paddingTop: 10, paddingBottom: 4 },
  toast: {
    position: 'absolute',
    top: 70,
    alignSelf: 'center',
    backgroundColor: ec.surface2,
    borderWidth: 1,
    borderColor: ec.gold,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    maxWidth: '90%',
  },
  toastText: { fontFamily: font.medium, color: ec.text, fontSize: 14, textAlign: 'center' },
  reportPill: { position: 'absolute', top: 70, alignSelf: 'center', backgroundColor: ec.surface2, borderRadius: 999, paddingHorizontal: 6 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  busyCard: {
    backgroundColor: ec.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: ec.border,
    padding: 26,
    alignItems: 'center',
    gap: 12,
    minWidth: 220,
  },
  busyText: { fontFamily: font.serif, fontSize: 18, color: ec.text },
});
