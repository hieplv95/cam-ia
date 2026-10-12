import { BLOG_LENGTHS, BLOG_TEXT_MODELS, BLOG_TONES, DEFAULT_BLOG_TEXT_MODEL, isClaudeModel, MAX_BLOG_IMAGES, type BlogWriteRequest } from '@/src/blog/types';
import { isLang } from '@/src/i18n/languages';
import { caller } from '@/src/server/account';
import { adminOf, audit } from '@/src/server/admin';
import { allPosts, BlogError, deletePost, postById, saveImage, savePost, setStatus } from '@/src/server/blog';
import { TOPIC_COUNTS } from '@/src/blog/clusters';
import { drawBlogImage, suggestTopics } from '@/src/server/blogAi';
import { dismissJob, enqueueArticle, recentJobs } from '@/src/server/blogJobs';
import { coverage, pendingTopics, setTopicStatus, topicById } from '@/src/server/blogTopics';
import { claudeErrorText, hasClaude } from '@/src/server/claude';
import { AiError } from '@/src/server/gemini';
import { tr } from '@/src/server/i18n';
import { logAi } from '@/src/server/stats';

/**
 * Blog on the admin page. GET = every article, ?id= one, ?topics=1&lang=es (waiting ideas + coverage board),
 * ?jobs=1 (articles being written in the background). POST { action, … } below.
 */
export function GET(request: Request) {
  const admin = adminOf(request);
  if (admin instanceof Response) return admin;
  const params = new URL(request.url).searchParams;
  if (params.get('jobs')) return Response.json({ jobs: recentJobs() });
  if (params.get('topics')) {
    const lang = params.get('lang');
    if (!isLang(lang)) return Response.json({ error: 'Ngôn ngữ không hợp lệ.' }, { status: 400 });
    return Response.json({ topics: pendingTopics(lang), coverage: coverage(lang) });
  }
  const id = Number(params.get('id'));
  if (id) {
    const post = postById(id);
    return post ? Response.json({ post }) : Response.json({ error: 'Không tìm thấy bài viết.' }, { status: 404 });
  }
  return Response.json({ posts: allPosts() });
}

const textModel = (v: unknown) => (BLOG_TEXT_MODELS.some((m) => m.id === v) ? (v as BlogWriteRequest['model']) : DEFAULT_BLOG_TEXT_MODEL);

/**
 * topics { lang, direction (group id | 'random'), count, extra, model } · topicStatus { id, status } ·
 * write { lang, topic, keyword, length, tone, images, extra, model, publish, logo, topicId?, cluster? } (queued, answers at once) · dismissJob { id } ·
 * image { prompt } · upload { data } · save { post } · status { id, status } · delete { id }
 */
export async function POST(request: Request) {
  const admin = adminOf(request);
  if (admin instanceof Response) return admin;
  const who = caller(request);
  const body = (await request.json().catch(() => ({}))) as Record<string, any>;
  const started = Date.now();
  const action = String(body.action ?? '');
  const aiTool = action === 'topics' ? 'blog.topics' : action === 'image' ? 'blog.image' : '';

  try {
    if ((action === 'topics' || action === 'write') && isClaudeModel(textModel(body.model)) && !hasClaude()) {
      throw new BlogError('Server chưa có CAMI_CLAUDE_API_KEY trong .env: thêm khoá Claude rồi khởi động lại server, hoặc chọn model Gemini Flash.');
    }
    switch (action) {
      case 'topics': {
        if (!isLang(body.lang)) throw new BlogError('Ngôn ngữ không hợp lệ.');
        const count = (TOPIC_COUNTS as readonly number[]).includes(Number(body.count)) ? Number(body.count) : 10;
        const r = await suggestTopics({ lang: body.lang, direction: String(body.direction ?? 'random'), count, extra: String(body.extra ?? '').trim(), model: textModel(body.model) });
        logAi(who, { tool: aiTool, model: r.model, status: 'ok', ms: Date.now() - started, source: r.source, usd: r.usd });
        return Response.json({ topics: r.topics, pending: pendingTopics(body.lang), coverage: coverage(body.lang) });
      }
      case 'topicStatus': {
        const topic = topicById(Number(body.id));
        if (!topic) throw new BlogError('Không tìm thấy gợi ý.');
        setTopicStatus(topic.id, body.status === 'suggested' ? 'suggested' : 'skipped');
        return Response.json({ pending: pendingTopics(topic.lang), coverage: coverage(topic.lang) });
      }
      case 'write': {
        const req: BlogWriteRequest = {
          lang: isLang(body.lang) ? body.lang : 'es',
          topic: String(body.topic ?? '').trim(),
          keyword: String(body.keyword ?? '').trim(),
          length: body.length in BLOG_LENGTHS ? body.length : 'medium',
          tone: body.tone in BLOG_TONES ? body.tone : 'friendly',
          images: Math.max(0, Math.min(MAX_BLOG_IMAGES, Math.round(Number(body.images) || 0))),
          extra: String(body.extra ?? '').trim(),
          model: textModel(body.model),
          publish: !!body.publish,
          topicId: Number(body.topicId) || undefined,
          cluster: typeof body.cluster === 'string' ? body.cluster : undefined,
        };
        if (req.topic.length < 3) throw new BlogError('Nhập chủ đề bài viết (hoặc bấm một gợi ý).');
        // Written in the background (several at once); the page follows its progress with ?jobs=1.
        const job = enqueueArticle({ ...req, logo: body.logo !== false }, who, admin);
        return Response.json({ job, jobs: recentJobs() });
      }
      case 'dismissJob': {
        dismissJob(Number(body.id));
        return Response.json({ jobs: recentJobs() });
      }
      case 'image': {
        const prompt = String(body.prompt ?? '').trim();
        if (!prompt) throw new BlogError('Thiếu mô tả ảnh.');
        const r = await drawBlogImage(prompt);
        logAi(who, { tool: aiTool, model: r.model, status: 'ok', ms: Date.now() - started, source: r.source });
        return Response.json({ image: r.image, mimeType: r.mimeType });
      }
      case 'upload': {
        const name = saveImage(String(body.data ?? ''));
        return Response.json({ name, url: `/api/blog/image/${name}` });
      }
      case 'save': {
        const post = savePost(body.post ?? {});
        audit(admin, 'blog', null, `${body.post?.id ? 'Sửa' : 'Viết'} bài #${post.id} (${post.status === 'published' ? 'đã đăng' : 'nháp'}): ${post.title}`);
        return Response.json({ post });
      }
      case 'status': {
        const post = setStatus(Number(body.id), body.status === 'published' ? 'published' : 'draft');
        audit(admin, 'blog', null, `${post.status === 'published' ? 'Đăng' : 'Ẩn'} bài #${post.id}: ${post.title}`);
        return Response.json({ post });
      }
      case 'delete': {
        const post = postById(Number(body.id));
        deletePost(Number(body.id));
        if (post) audit(admin, 'blog', null, `Xoá bài #${post.id}: ${post.title}`);
        return Response.json({ ok: true });
      }
      default:
        return Response.json({ error: 'Thao tác không hợp lệ.' }, { status: 400 });
    }
  } catch (e) {
    if (aiTool && !(e instanceof BlogError)) logAi(who, { tool: aiTool, model: action === 'image' ? 'image' : textModel(body.model), status: 'error', error: e instanceof AiError ? e.key : 'unexpected', ms: Date.now() - started });
    if (e instanceof BlogError) return Response.json({ error: e.message }, { status: 400 });
    if (e instanceof AiError) return Response.json({ error: claudeErrorText(e) ?? tr(request, e.key) }, { status: e.status });
    console.error('[blog]', action, e);
    return Response.json({ error: e instanceof Error ? e.message : 'Lỗi không rõ.' }, { status: 500 });
  }
}
