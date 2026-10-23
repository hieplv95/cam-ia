import type { Lang } from './i18n/languages';

/**
 * Search engine texts of the website, edited on the admin page (SEO tab). Shared by the server, which writes them
 * into every page (server.cjs), and the admin page. The main market is Spanish-speaking Latin America:
 * Google, Facebook and WhatsApp read the `primary` language.
 */

export type SeoText = { title: string; description: string; keywords: string };
export type SeoFaq = { q: string; a: string };

/**
 * GEO (generative engine optimization): what AI assistants (ChatGPT, Gemini, Perplexity, Claude…) read about CamIA.
 * Used in /llms.txt, the structured data of the home page, and the plain-text copy of pages served to bots that
 * don't run JavaScript.
 */
export type GeoSettings = {
  /** Who CamIA is and what it does, per language (a few factual sentences). */
  about: Partial<Record<Lang, string>>;
  /** Frequently asked questions per language (FAQPage structured data + llms.txt). */
  faq: Partial<Record<Lang, SeoFaq[]>>;
  /** Let AI companies use the site to train models. Search and answer bots are always allowed. */
  allowTraining: boolean;
  /** Official profiles (structured data "sameAs"): full https:// links, '' when none. */
  social: { facebook: string; instagram: string; x: string; youtube: string; tiktok: string };
};

export type SeoSettings = {
  /** Language search engines and link previews get (they send no language). */
  primary: Lang;
  texts: Record<Lang, SeoText>;
  /** Google Search Console "HTML tag" code, the same for every language. */
  verification: string;
  geo: GeoSettings;
};

export const GEO_LIMITS = { about: 2000, faqItems: 12, question: 200, answer: 800, url: 200 } as const;
/** Also the order of the icons on the home page (web). */
export const SOCIAL_KEYS = ['facebook', 'instagram', 'x', 'youtube', 'tiktok'] as const;

/** AI crawlers named in robots.txt: search/answer bots (always allowed) and training bots (switch on the admin page). */
export const AI_SEARCH_BOTS = ['OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Perplexity-User', 'Claude-SearchBot', 'Claude-User', 'DuckAssistBot'];
export const AI_TRAINING_BOTS = ['GPTBot', 'ClaudeBot', 'Google-Extended', 'Applebot-Extended', 'CCBot', 'meta-externalagent', 'Bytespider'];

export const DEFAULT_GEO: GeoSettings = {
  allowTraining: true,
  social: { facebook: '', instagram: '', x: '', youtube: '', tiktok: '' },
  about: {
    es: 'CamIA (camia.app) es un editor de fotos con inteligencia artificial, gratis y sin descargar, que funciona en el navegador del celular o la PC, y pronto como app para Android e iPhone. Con CamIA puedes restaurar y colorear fotos antiguas, borrar objetos, personas o el fondo, crear fotos de producto profesionales para vender en línea, diseñar logos para tu negocio, probar peinados, colores de cabello y maquillaje, editar describiendo lo que quieres con tus propias palabras y aplicar filtros inspirados en Latinoamérica. Cada mes recibes puntos gratis para usar la IA y los invitados pueden probarla sin registrarse. Está disponible en 10 idiomas, incluido el español.',
    pt: 'CamIA (camia.app) é um editor de fotos com inteligência artificial, grátis e sem baixar nada, que funciona no navegador do celular ou do PC, e em breve como app para Android e iPhone. Com a CamIA você restaura e colore fotos antigas, apaga objetos, pessoas ou o fundo, cria fotos de produto profissionais para vender online, faz logos para o seu negócio, testa penteados, cores de cabelo e maquiagem, edita descrevendo o que quer com suas palavras e aplica filtros inspirados na América Latina. Todo mês você recebe pontos grátis para usar a IA e visitantes podem testar sem cadastro.',
    en: 'CamIA (camia.app) is a free AI photo editor that runs in the browser on a phone or computer with nothing to download, with Android and iPhone apps coming soon. With CamIA you can restore and colorize old photos, remove objects, people or the background, create professional product photos for selling online, design logos for a business, try hairstyles, hair colors and makeup, edit by describing what you want in your own words, and apply filters inspired by Latin America. Every month users get free points for the AI features, and guests can try it without signing up. It is available in 10 languages.',
    vi: 'CamIA (camia.app) là trình chỉnh ảnh bằng trí tuệ nhân tạo, miễn phí và không cần cài đặt, chạy ngay trên trình duyệt điện thoại hoặc máy tính, sắp có app Android và iPhone. Với CamIA bạn có thể phục hồi và tô màu ảnh cũ, xoá vật thể, người hoặc nền, tạo ảnh sản phẩm chuyên nghiệp để bán hàng online, thiết kế logo, thử kiểu tóc, màu tóc và trang điểm, chỉnh ảnh bằng cách mô tả bằng lời, và dùng các bộ lọc màu đẹp. Mỗi tháng người dùng được điểm miễn phí để dùng AI, khách có thể dùng thử không cần đăng ký.',
  },
  faq: {
    es: [
      { q: '¿CamIA es gratis?', a: 'Sí. Puedes editar fotos gratis y cada mes recibes puntos gratis para las funciones de IA. Los invitados también tienen algunos intentos sin registrarse.' },
      { q: '¿Tengo que descargar algo para usar CamIA?', a: 'No. CamIA funciona en el navegador de tu celular o computadora en camia.app. Pronto también tendrá app para Android e iPhone.' },
      { q: '¿Cómo restauro una foto antigua con CamIA?', a: 'Abre camia.app, elige “Restaurar fotos antiguas” y sube la foto. La IA quita rayones, mejora los rostros y puede darle color en segundos.' },
      { q: '¿Puedo quitar el fondo de una foto?', a: 'Sí. Con “Quitar fondo” obtienes un fondo blanco o limpio en segundos, ideal para fotos de producto y documentos.' },
      { q: '¿Sirve para vender en línea?', a: 'Sí. El Estudio de producto IA crea fotos profesionales con fondos y escenas nuevas para Mercado Libre, Instagram o WhatsApp, y puede separar varios productos en fotos distintas.' },
      { q: '¿En qué idiomas está CamIA?', a: 'En 10 idiomas: español, portugués, inglés, vietnamita, francés, alemán, ruso, chino, japonés y coreano.' },
    ],
    pt: [
      { q: 'A CamIA é grátis?', a: 'Sim. Você edita fotos grátis e todo mês recebe pontos grátis para as funções de IA. Visitantes também têm algumas tentativas sem cadastro.' },
      { q: 'Preciso baixar alguma coisa?', a: 'Não. A CamIA funciona no navegador do celular ou do computador em camia.app. Em breve também terá app para Android e iPhone.' },
      { q: 'Como restaurar uma foto antiga com a CamIA?', a: 'Abra camia.app, escolha “Restaurar fotos antigas” e envie a foto. A IA remove riscos, melhora os rostos e pode colorir em segundos.' },
      { q: 'Dá para tirar o fundo de uma foto?', a: 'Sim. Com “Remover fundo” você tem um fundo branco ou limpo em segundos, ideal para fotos de produto.' },
    ],
    en: [
      { q: 'Is CamIA free?', a: 'Yes. You can edit photos for free and get free points every month for the AI features. Guests also get a few tries without signing up.' },
      { q: 'Do I need to download anything?', a: 'No. CamIA runs in the browser on your phone or computer at camia.app. Android and iPhone apps are coming soon.' },
      { q: 'How do I restore an old photo with CamIA?', a: 'Open camia.app, choose “Restore old photos” and upload the picture. The AI removes scratches, sharpens faces and can colorize it in seconds.' },
      { q: 'Can I remove the background of a photo?', a: 'Yes. “Remove background” gives you a clean or white background in seconds, ideal for product photos.' },
    ],
    vi: [
      { q: 'CamIA có miễn phí không?', a: 'Có. Bạn chỉnh ảnh miễn phí và mỗi tháng được điểm miễn phí để dùng các chức năng AI. Khách chưa đăng ký cũng có vài lượt dùng thử.' },
      { q: 'Có cần cài đặt gì không?', a: 'Không. CamIA chạy ngay trên trình duyệt điện thoại hoặc máy tính tại camia.app. App Android và iPhone sắp ra mắt.' },
      { q: 'Phục hồi ảnh cũ bằng CamIA thế nào?', a: 'Mở camia.app, chọn “Phục hồi ảnh cũ” và tải ảnh lên. AI sẽ xoá vết xước, làm rõ khuôn mặt và có thể tô màu trong vài giây.' },
      { q: 'Có xoá nền ảnh được không?', a: 'Có. Chức năng “Xoá nền” cho nền trắng hoặc nền sạch trong vài giây, rất hợp với ảnh sản phẩm.' },
    ],
  },
};

/** Order of the language tabs on the admin page: the target markets first. */
export const SEO_LANGS: Lang[] = ['es', 'pt', 'en', 'vi', 'fr', 'de', 'ru', 'zh', 'ja', 'ko'];

export const SEO_LIMITS = { title: 70, description: 220, keywords: 400 } as const;
/** What Google shows without cutting: shown as a hint next to the counters. */
export const SEO_GOOD = { title: [30, 60], description: [120, 160] } as const;

/** og:locale of each language (Spanish for Latin America). */
export const OG_LOCALE: Record<Lang, string> = {
  es: 'es_LA',
  pt: 'pt_BR',
  en: 'en_US',
  vi: 'vi_VN',
  fr: 'fr_FR',
  de: 'de_DE',
  ru: 'ru_RU',
  zh: 'zh_CN',
  ja: 'ja_JP',
  ko: 'ko_KR',
};

export const DEFAULT_SEO: SeoSettings = {
  primary: 'es',
  verification: '',
  geo: DEFAULT_GEO,
  texts: {
    es: {
      title: 'CamIA – Editor de fotos con IA gratis, sin descargar',
      description:
        'Edita fotos con inteligencia artificial: restaura fotos antiguas, borra objetos, crea logos y fotos de producto en segundos. Gratis en el móvil o la PC.',
      keywords:
        'editor de fotos con IA, editar fotos con inteligencia artificial, restaurar fotos antiguas, borrar objetos de fotos, crear logo con IA, fotos de producto con IA, editor de fotos gratis, app para editar fotos',
    },
    pt: {
      title: 'CamIA – Editor de fotos com IA grátis, sem baixar',
      description:
        'Edite fotos com inteligência artificial: restaure fotos antigas, apague objetos, crie logos e fotos de produto em segundos. Grátis no celular ou no PC.',
      keywords:
        'editor de fotos com IA, editar fotos com inteligência artificial, restaurar fotos antigas, apagar objetos da foto, criar logo com IA, fotos de produto com IA, editor de fotos grátis',
    },
    en: {
      title: 'CamIA – Free AI Photo Editor, No Download Needed',
      description:
        'Edit photos with AI: restore old photos, remove objects, create logos and product shots in seconds. Free on your phone or computer, right in the browser.',
      keywords: 'AI photo editor, edit photos with AI, restore old photos, remove objects from photos, AI logo maker, AI product photos, free photo editor',
    },
    vi: {
      title: 'CamIA – Chỉnh ảnh bằng AI miễn phí, không cần cài',
      description:
        'Chỉnh ảnh bằng trí tuệ nhân tạo: phục hồi ảnh cũ, xoá vật thể, tạo logo và ảnh sản phẩm trong vài giây. Miễn phí trên điện thoại hoặc máy tính.',
      keywords: 'chỉnh ảnh AI, sửa ảnh bằng AI, phục hồi ảnh cũ, xoá vật thể khỏi ảnh, tạo logo AI, ảnh sản phẩm AI, app chỉnh ảnh miễn phí',
    },
    fr: {
      title: 'CamIA – Retouche photo IA gratuite, sans téléchargement',
      description:
        'Retouchez vos photos avec l’IA : restaurez de vieilles photos, effacez des objets, créez logos et photos produit en quelques secondes. Gratuit sur mobile ou PC.',
      keywords: 'retouche photo IA, éditeur photo IA, restaurer vieilles photos, effacer objet photo, créer logo IA, photo produit IA, éditeur photo gratuit',
    },
    de: {
      title: 'CamIA – Kostenloser KI-Fotoeditor ohne Download',
      description:
        'Fotos mit KI bearbeiten: alte Fotos restaurieren, Objekte entfernen, Logos und Produktfotos in Sekunden erstellen. Kostenlos auf Handy oder PC im Browser.',
      keywords: 'KI Fotoeditor, Fotos mit KI bearbeiten, alte Fotos restaurieren, Objekte aus Fotos entfernen, Logo mit KI erstellen, KI Produktfotos, kostenloser Fotoeditor',
    },
    ru: {
      title: 'CamIA – бесплатный ИИ-редактор фото без установки',
      description:
        'Редактируйте фото с помощью ИИ: реставрация старых фото, удаление объектов, логотипы и фото товаров за секунды. Бесплатно на телефоне или компьютере.',
      keywords: 'ИИ редактор фото, редактировать фото с ИИ, реставрация старых фото, удалить объект с фото, создать логотип ИИ, фото товаров ИИ, бесплатный фоторедактор',
    },
    zh: {
      title: 'CamIA – 免费 AI 修图工具，无需下载',
      description: '用人工智能编辑照片：修复老照片、消除多余物体、几秒生成标志和商品图。手机或电脑浏览器即可免费使用。',
      keywords: 'AI修图, AI照片编辑, 老照片修复, 照片消除物体, AI生成标志, AI商品图, 免费修图',
    },
    ja: {
      title: 'CamIA – 無料のAI写真編集、ダウンロード不要',
      description: 'AIで写真を編集：古い写真の修復、不要な物の消去、ロゴや商品写真の作成も数秒で。スマホやパソコンのブラウザで無料で使えます。',
      keywords: 'AI写真編集, AIで写真加工, 古い写真 修復, 写真 物体 消去, AI ロゴ作成, AI 商品写真, 無料 写真編集',
    },
    ko: {
      title: 'CamIA – 무료 AI 사진 편집기, 설치 없이 바로',
      description: 'AI로 사진을 편집하세요: 오래된 사진 복원, 물체 지우기, 로고와 제품 사진 생성까지 몇 초면 끝. 휴대폰이나 PC 브라우저에서 무료로 사용하세요.',
      keywords: 'AI 사진 편집, AI 사진 보정, 오래된 사진 복원, 사진 물체 지우기, AI 로고 만들기, AI 제품 사진, 무료 사진 편집',
    },
  },
};
