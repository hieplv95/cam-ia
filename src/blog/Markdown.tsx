import { Link } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Image, Linking, Platform, StyleSheet, Text, View } from 'react-native';

import { apiUrl } from '../account';
import { colors, font } from '../theme';

/**
 * Renders the Markdown of blog articles: ## / ### headings, paragraphs, - and 1. lists, > quotes, ---,
 * **bold**, *italic*, `code`, [links](…) and ![pictures](…). On the web, headings and links become real
 * <h2>/<h3>/<a> elements so search engines read the structure. AI picture placeholders ([[IMAGE 1]]) are hidden.
 */

type Block =
  | { kind: 'heading'; level: 2 | 3 | 4; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'quote'; text: string }
  | { kind: 'image'; alt: string; url: string }
  | { kind: 'rule' };

export function parseMarkdown(md: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (para.length) blocks.push({ kind: 'paragraph', text: para.join(' ') });
    para = [];
    if (list) blocks.push({ kind: 'list', ...list });
    list = null;
  };
  for (const raw of md.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }
    if (/^\s*\[\[IMAGE \d+\]\]\s*$/i.test(line)) continue;
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flush();
      // The article title is the page's only H1.
      blocks.push({ kind: 'heading', level: Math.min(4, Math.max(2, heading[1].length)) as 2 | 3 | 4, text: heading[2].replace(/\s+#+\s*$/, '') });
      continue;
    }
    const image = line.match(/^\s*!\[([^\]]*)\]\((\S+?)(?:\s+"[^"]*")?\)\s*$/);
    if (image) {
      flush();
      blocks.push({ kind: 'image', alt: image[1], url: image[2] });
      continue;
    }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flush();
      blocks.push({ kind: 'rule' });
      continue;
    }
    const quote = line.match(/^\s*>\s?(.*)$/);
    if (quote) {
      flush();
      blocks.push({ kind: 'quote', text: quote[1] });
      continue;
    }
    const bullet = line.match(/^\s*[-*+]\s+(.+)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (bullet || numbered) {
      const ordered = !!numbered;
      if (para.length || (list && list.ordered !== ordered)) flush();
      list ??= { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]);
      continue;
    }
    if (list) {
      // A wrapped line continues the last item.
      list.items[list.items.length - 1] += ` ${line.trim()}`;
      continue;
    }
    para.push(line.trim());
  }
  flush();
  return blocks;
}

/** Internal links (/…, or our own domain) stay in the app; others open in a new tab / the browser. */
function internalPath(url: string) {
  if (url.startsWith('/')) return url;
  const m = url.match(/^https?:\/\/(?:www\.)?camia\.app(\/[^\s]*)?$/i);
  return m ? (m[1] ?? '/') : null;
}

function LinkText({ url, children }: { url: string; children: ReactNode }) {
  const path = internalPath(url);
  if (path) {
    return (
      <Link href={path as never} style={styles.link}>
        {children}
      </Link>
    );
  }
  const web = Platform.OS === 'web' ? ({ href: url, hrefAttrs: { target: '_blank', rel: 'noopener' } } as object) : {};
  return (
    <Text style={styles.link} onPress={Platform.OS === 'web' ? undefined : () => Linking.openURL(url)} {...web}>
      {children}
    </Text>
  );
}

/** **bold**, *italic* / _italic_, `code` and [text](url) inside a line. */
export function Inline({ text }: { text: string }): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|_[^_\s][^_]*_|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g);
  return parts.map((p, i) => {
    if (!p) return null;
    if (/^(\*\*|__).+\1$/.test(p)) return <Text key={i} style={styles.bold}><Inline text={p.slice(2, -2)} /></Text>;
    if (/^`.+`$/.test(p)) return <Text key={i} style={styles.code}>{p.slice(1, -1)}</Text>;
    if (/^(\*|_).+\1$/.test(p)) return <Text key={i} style={styles.italic}><Inline text={p.slice(1, -1)} /></Text>;
    const link = p.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    if (link) return <LinkText key={i} url={link[2]}><Inline text={link[1]} /></LinkText>;
    return p;
  });
}

/** A picture at its own aspect ratio (16:9 until its size is known). */
export function BlogImage({ url, alt, style }: { url: string; alt?: string; style?: object }) {
  const uri = apiUrl(url);
  const [ratio, setRatio] = useState(16 / 9);
  useEffect(() => {
    Image.getSize(uri, (w, h) => w && h && setRatio(w / h), () => {});
  }, [uri]);
  return <Image source={{ uri }} accessibilityLabel={alt} style={[styles.image, { aspectRatio: ratio }, style]} resizeMode="cover" />;
}

export function Markdown({ content }: { content: string }) {
  const blocks = parseMarkdown(content);
  return (
    <View style={styles.body}>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'heading':
            return (
              <Text key={i} role="heading" aria-level={b.level} style={b.level === 2 ? styles.h2 : b.level === 3 ? styles.h3 : styles.h4}>
                <Inline text={b.text} />
              </Text>
            );
          case 'paragraph':
            return (
              <Text key={i} style={styles.p}>
                <Inline text={b.text} />
              </Text>
            );
          case 'quote':
            return (
              <View key={i} style={styles.quote}>
                <Text style={[styles.p, styles.italic]}>
                  <Inline text={b.text} />
                </Text>
              </View>
            );
          case 'list':
            return (
              <View key={i} style={styles.list}>
                {b.items.map((item, j) => (
                  <View key={j} style={styles.item}>
                    <Text style={styles.bullet}>{b.ordered ? `${j + 1}.` : '•'}</Text>
                    <Text style={[styles.p, { flex: 1 }]}>
                      <Inline text={item} />
                    </Text>
                  </View>
                ))}
              </View>
            );
          case 'image':
            return (
              <View key={i} style={{ gap: 6 }}>
                <BlogImage url={b.url} alt={b.alt} />
                {b.alt ? <Text style={styles.caption}>{b.alt}</Text> : null}
              </View>
            );
          case 'rule':
            return <View key={i} style={styles.rule} />;
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: 14 },
  h2: { fontFamily: font.bold, fontSize: 22, lineHeight: 29, color: colors.text, marginTop: 14 },
  h3: { fontFamily: font.semi, fontSize: 18, lineHeight: 25, color: colors.text, marginTop: 6 },
  h4: { fontFamily: font.semi, fontSize: 16, lineHeight: 23, color: colors.text },
  p: { fontFamily: font.regular, fontSize: 16, lineHeight: 26, color: colors.text },
  bold: { fontFamily: font.bold },
  italic: { fontStyle: 'italic' },
  code: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), fontSize: 14, backgroundColor: colors.surface2 },
  link: { color: colors.goldDeep, textDecorationLine: 'underline', fontFamily: font.semi },
  list: { gap: 8 },
  item: { flexDirection: 'row', gap: 10, paddingLeft: 4 },
  bullet: { fontFamily: font.bold, fontSize: 16, lineHeight: 26, color: colors.gold, minWidth: 18 },
  quote: { borderLeftWidth: 3, borderLeftColor: colors.gold, paddingLeft: 14, paddingVertical: 2 },
  image: { width: '100%', borderRadius: 16, backgroundColor: colors.surface2 },
  caption: { fontFamily: font.regular, fontSize: 13, color: colors.textSoft, textAlign: 'center' },
  rule: { height: 1, backgroundColor: colors.border, marginVertical: 8 },
});
