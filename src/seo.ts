import type { Lang } from './i18n/languages';

/**
 * Search engine texts of the website, edited on the admin page (SEO tab). Shared by the server, which writes them
 * into every page (server.cjs), and the admin page. The main market is Spanish-speaking Latin America:
 * Google, Facebook and WhatsApp read the `primary` language.
 */

export type SeoText = { title: string; description: string; keywords: string };
export type SeoSettings = {
  /** Language search engines and link previews get (they send no language). */
  primary: Lang;
  texts: Record<Lang, SeoText>;
  /** Google Search Console "HTML tag" code, the same for every language. */
  verification: string;
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
