/**
 * Keyword groups (clusters) of the blog: topic ideas are spread over them, and the coverage board shows how many
 * articles each has. `label` is for the admin page (Vietnamese); `ai` tells the model what belongs there (English).
 */
export const BLOG_CLUSTERS = [
  { id: 'restore', label: 'Phục hồi ảnh cũ', ai: 'restoring, repairing and colorizing old, damaged or black-and-white family photos' },
  { id: 'erase', label: 'Xoá vật thể & nền', ai: 'removing objects, people, text or the background; white or transparent backgrounds' },
  { id: 'product', label: 'Ảnh sản phẩm & bán hàng', ai: 'product photos for online sellers (Mercado Libre, Instagram/WhatsApp shops, TikTok Shop, catalogs, food menus)' },
  { id: 'logo', label: 'Logo & thương hiệu', ai: 'logos and simple branding for small businesses and entrepreneurs' },
  { id: 'portrait', label: 'Selfie, chân dung & làm đẹp', ai: 'selfies, portraits, skin retouching, trying hairstyles, hair colors and makeup' },
  { id: 'style', label: 'Bộ lọc & phong cách', ai: 'filters and presets, film and cinematic looks, black and white, photo to art/anime/watercolor' },
  { id: 'aitools', label: 'AI & sáng tạo ảnh', ai: 'creating images with AI from text, prompts, editing by describing, expanding photos, enhancing quality' },
  { id: 'compare', label: 'So sánh ứng dụng', ai: 'comparisons and free alternatives to other apps (Canva, Picsart, Remini, Photoroom, Lightroom, Snapseed, Fotor, CapCut)' },
  { id: 'occasions', label: 'Dịp lễ & sự kiện', ai: 'seasonal and occasion photos: Día de Muertos, Christmas, quinceañera, weddings, Valentine, Mother’s Day, graduation, Carnival, travel' },
  { id: 'basics', label: 'Mẹo chỉnh ảnh cơ bản', ai: 'beginner photo editing tips: light, color, crop, composition, editing on the phone' },
  { id: 'social', label: 'Ảnh cho mạng xã hội', ai: 'photos for Instagram, TikTok, WhatsApp, Facebook: profile pictures, stories, posts, sizes' },
] as const;

export type BlogClusterId = (typeof BLOG_CLUSTERS)[number]['id'];
export const isClusterId = (v: unknown): v is BlogClusterId => BLOG_CLUSTERS.some((c) => c.id === v);
export const clusterLabel = (id: string) => BLOG_CLUSTERS.find((c) => c.id === id)?.label ?? 'Chưa phân nhóm';

/** At most this many ideas from one group in a mixed batch, so the list isn't ten versions of the same article. */
export const MAX_PER_CLUSTER = 3;

export const TOPIC_COUNTS = [5, 10, 15] as const;

export type TopicDifficulty = 'low' | 'medium' | 'high';
export type TopicPriority = 'high' | 'medium' | 'low';
export const DIFFICULTY_LABEL: Record<TopicDifficulty, string> = { low: 'Dễ lên top', medium: 'Độ khó vừa', high: 'Khó lên top' };
export const PRIORITY_LABEL: Record<TopicPriority, string> = { high: 'Ưu tiên cao', medium: 'Ưu tiên vừa', low: 'Ưu tiên thấp' };

/** A remembered topic idea (table blog_topics). `similar` = title of an article or idea it looks like (duplicate warning). */
export type BlogTopic = {
  id: number;
  lang: string;
  title: string;
  keyword: string;
  cluster: string;
  difficulty: TopicDifficulty;
  priority: TopicPriority;
  reason: string;
  similar: string;
  status: 'suggested' | 'written' | 'skipped';
  postId: number | null;
  createdAt: number;
};

/** One row of the coverage board. */
export type ClusterCoverage = { cluster: string; published: number; drafts: number; suggested: number; skipped: number };
