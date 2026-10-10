import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { t } from './i18n';

/** Desktop browsers: a mouse can't swipe, so add drag, wheel and arrow buttons. */
const hasMouse = Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches;

/**
 * Horizontal row that scrolls by swipe on phones and, with a mouse, by dragging, by the wheel,
 * or with the ‹ › buttons that appear while more content is hidden.
 */
export function HScroll({
  children,
  style,
  contentContainerStyle,
  tone = 'light',
  pagingEnabled,
  onScroll,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Arrow button colors: light screens or the dark editor. */
  tone?: 'light' | 'dark';
  pagingEnabled?: boolean;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
}) {
  const ref = useRef<ScrollView>(null);
  const [x, setX] = useState(0);
  const [viewW, setViewW] = useState(0);
  const [contentW, setContentW] = useState(0);

  useEffect(() => {
    if (!hasMouse) return;
    const node = (ref.current as any)?.getScrollableNode?.() as HTMLElement | undefined;
    if (!node) return;
    let down = false;
    let moved = false;
    let startX = 0;
    let startLeft = 0;
    const onWheel = (e: WheelEvent) => {
      if (node.scrollWidth <= node.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const atStart = node.scrollLeft <= 0 && e.deltaY < 0;
      const atEnd = node.scrollLeft + node.clientWidth >= node.scrollWidth - 1 && e.deltaY > 0;
      if (atStart || atEnd) return; // let the page scroll vertically
      node.scrollLeft += e.deltaY;
      e.preventDefault();
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = true;
      moved = false;
      startX = e.clientX;
      startLeft = node.scrollLeft;
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 5) moved = true;
      if (moved) node.scrollLeft = startLeft - dx;
    };
    const onUp = () => {
      down = false;
    };
    // A drag must not also "click" the card under the cursor.
    const onClick = (e: MouseEvent) => {
      if (!moved) return;
      e.stopPropagation();
      e.preventDefault();
      moved = false;
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    node.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    node.addEventListener('click', onClick, true);
    return () => {
      node.removeEventListener('wheel', onWheel);
      node.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      node.removeEventListener('click', onClick, true);
    };
  }, []);

  const step = pagingEnabled ? viewW : viewW * 0.8;
  const go = (dir: -1 | 1) => ref.current?.scrollTo({ x: Math.max(0, Math.min(contentW - viewW, x + dir * step)), animated: true });
  const canLeft = hasMouse && x > 2;
  const canRight = hasMouse && x < contentW - viewW - 2;
  const dark = tone === 'dark';

  return (
    <View style={style}>
      <ScrollView
        ref={ref}
        horizontal
        pagingEnabled={pagingEnabled}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={contentContainerStyle}
        scrollEventThrottle={32}
        onLayout={(e) => setViewW(e.nativeEvent.layout.width)}
        onContentSizeChange={(w) => setContentW(w)}
        onScroll={(e) => {
          setX(e.nativeEvent.contentOffset.x);
          onScroll?.(e);
        }}
      >
        {children}
      </ScrollView>
      {canLeft && (
        <Pressable accessibilityLabel={t('common.scrollLeft')} onPress={() => go(-1)} style={[styles.arrow, styles.left, dark && styles.arrowDark]}>
          <Ionicons name="chevron-back" size={16} color={dark ? '#F4EFE7' : '#2A2018'} />
        </Pressable>
      )}
      {canRight && (
        <Pressable accessibilityLabel={t('common.scrollRight')} onPress={() => go(1)} style={[styles.arrow, styles.right, dark && styles.arrowDark]}>
          <Ionicons name="chevron-forward" size={16} color={dark ? '#F4EFE7' : '#2A2018'} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  arrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -15,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  arrowDark: { backgroundColor: '#2E2A26', borderWidth: 1, borderColor: '#46403A' },
  left: { left: 4 },
  right: { right: 4 },
});
