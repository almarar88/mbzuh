/**
 * مصنّف الأخبار: يحدّد هل الخبر تقني، وهل هو عن الذكاء الاصطناعي تحديدًا،
 * ويستخرج وسومًا بالعربية. يعمل بالكلمات المفتاحية (عربي + إنجليزي) بلا اتصال.
 */
import type { Category } from "@shared/types";

interface KeywordGroup {
  tag: string;
  ai: boolean;
  words: RegExp[];
}

const w = (s: string): RegExp => new RegExp(`(^|[^\\p{L}\\p{N}])${s}(?=$|[^\\p{L}\\p{N}])`, "iu");
const a = (s: string): RegExp => new RegExp(s, "u");

const GROUPS: KeywordGroup[] = [
  { tag: "ذكاء اصطناعي", ai: true, words: [w("ai"), w("a\\.i\\."), w("artificial intelligence"), a("الذكاء الاصطناعي"), a("ذكاء اصطناعي"), a("بالذكاء الاصطناعي"), w("agi"), w("genai"), w("generative ai"), a("التوليدي")] },
  { tag: "نماذج لغوية", ai: true, words: [w("llm"), w("llms"), w("large language model"), w("language model"), a("نموذج لغوي"), a("النماذج اللغوية"), a("نماذج لغوية"), w("foundation model"), w("transformer"), w("reasoning model")] },
  { tag: "ChatGPT / OpenAI", ai: true, words: [w("chatgpt"), w("openai"), w("gpt-?\\d[\\w.-]*"), w("gpt"), w("sora"), w("dall-?e"), w("sam altman"), a("شات جي بي تي"), a("أوبن إيه آي"), a("أوبن آي"), a("سام ألتمان"), a("جي بي تي")] },
  { tag: "Claude / Anthropic", ai: true, words: [w("claude"), w("anthropic"), a("كلود"), a("أنثروبيك"), a("انثروبيك")] },
  { tag: "Gemini / Google", ai: true, words: [w("gemini"), w("deepmind"), w("bard"), a("جيميني"), a("جمناي"), a("ديب مايند")] },
  { tag: "نماذج مفتوحة", ai: true, words: [w("llama"), w("mistral"), w("deepseek"), w("qwen"), w("hugging ?face"), w("open[- ]?source model"), w("open[- ]?weights?"), a("لاما"), a("ديب سيك"), a("ميسترال"), a("مفتوحة المصدر")] },
  { tag: "Grok / xAI", ai: true, words: [w("grok"), w("xai"), a("جروك")] },
  { tag: "Copilot / Microsoft AI", ai: true, words: [w("copilot"), a("كوبايلوت"), a("كوبيلوت")] },
  { tag: "تعلم آلي", ai: true, words: [w("machine learning"), w("deep learning"), w("neural network"), w("neural nets?"), a("تعلم الآلة"), a("التعلم الآلي"), a("تعلم آلي"), a("التعلم العميق"), a("الشبكات العصبية"), a("شبكة عصبية")] },
  { tag: "وكلاء ذكيون", ai: true, words: [w("ai agents?"), w("agentic"), w("autonomous agents?"), a("وكيل ذكي"), a("وكلاء ذكيون"), a("الوكلاء الأذكياء"), a("وكلاء الذكاء")] },
  { tag: "روبوتات", ai: true, words: [w("robots?"), w("robotics"), w("humanoid"), a("روبوت"), a("الروبوتات"), a("روبوتات")] },
  { tag: "رؤية حاسوبية", ai: true, words: [w("computer vision"), w("image generation"), w("text-to-(image|video)"), w("midjourney"), w("stable diffusion"), a("توليد الصور"), a("توليد الفيديو"), a("الرؤية الحاسوبية")] },
  { tag: "رقائق ومعالجات", ai: false, words: [w("nvidia"), w("gpu"), w("gpus"), w("tpu"), w("chips?"), w("semiconductors?"), w("amd"), w("intel"), w("qualcomm"), w("tsmc"), w("arm"), w("snapdragon"), a("إنفيديا"), a("انفيديا"), a("معالج"), a("رقائق"), a("شرائح"), a("أشباه الموصلات"), a("كوالكوم"), a("إنتل")] },
  { tag: "هواتف وأجهزة", ai: false, words: [w("iphone"), w("android"), w("smartphones?"), w("galaxy"), w("pixel"), w("ipad"), w("macbook"), w("laptops?"), w("wearables?"), w("smartwatch"), a("آيفون"), a("ايفون"), a("أندرويد"), a("اندرويد"), a("هاتف"), a("هواتف"), a("جالكسي"), a("ساعة ذكية"), a("لابتوب"), a("حاسوب محمول")] },
  { tag: "شركات التقنية", ai: false, words: [w("apple"), w("google"), w("microsoft"), w("meta"), w("amazon"), w("samsung"), w("tesla"), w("spacex"), w("huawei"), w("xiaomi"), w("alphabet"), a("آبل"), a("أبل"), a("جوجل"), a("غوغل"), a("مايكروسوفت"), a("ميتا"), a("أمازون"), a("سامسونج"), a("سامسونغ"), a("تسلا"), a("هواوي"), a("شاومي")] },
  { tag: "برمجيات وتطبيقات", ai: false, words: [w("software"), w("apps?"), w("ios"), w("windows"), w("linux"), w("update"), w("developers?"), w("github"), w("open source"), w("api"), a("برمجيات"), a("تطبيق"), a("تطبيقات"), a("تحديث"), a("نظام التشغيل"), a("ويندوز"), a("المطورين")] },
  { tag: "أمن سيبراني", ai: false, words: [w("cybersecurity"), w("hack(ers?|ed|ing)?"), w("breach"), w("malware"), w("ransomware"), w("vulnerability"), w("zero-day"), w("phishing"), a("الأمن السيبراني"), a("أمن سيبراني"), a("اختراق"), a("قرصنة"), a("ثغرة"), a("برمجيات خبيثة"), a("هجوم إلكتروني"), a("هجمات إلكترونية")] },
  { tag: "حوسبة سحابية", ai: false, words: [w("cloud"), w("aws"), w("azure"), w("data ?centers?"), w("servers?"), w("kubernetes"), a("الحوسبة السحابية"), a("سحابية"), a("مراكز البيانات"), a("مركز بيانات"), a("خوادم")] },
  { tag: "منصات وتواصل", ai: false, words: [w("twitter"), w("tiktok"), w("instagram"), w("youtube"), w("whatsapp"), w("telegram"), w("snapchat"), w("social media"), w("threads"), a("تويتر"), a("تيك توك"), a("إنستغرام"), a("انستقرام"), a("يوتيوب"), a("واتساب"), a("تيليجرام"), a("سناب شات"), a("التواصل الاجتماعي")] },
  { tag: "عملات رقمية", ai: false, words: [w("bitcoin"), w("crypto"), w("blockchain"), w("ethereum"), w("web3"), a("بيتكوين"), a("العملات الرقمية"), a("عملات رقمية"), a("بلوك تشين"), a("العملات المشفرة")] },
  { tag: "ألعاب", ai: false, words: [w("playstation"), w("xbox"), w("nintendo"), w("gaming"), w("video games?"), w("steam"), a("بلايستيشن"), a("إكس بوكس"), a("ألعاب الفيديو"), a("نينتندو")] },
  { tag: "واقع افتراضي", ai: false, words: [w("vr"), w("ar"), w("metaverse"), w("vision pro"), w("headset"), w("smart glasses"), a("الواقع الافتراضي"), a("الواقع المعزز"), a("ميتافيرس"), a("نظارات ذكية")] },
  { tag: "فضاء وعلوم", ai: false, words: [w("nasa"), w("rocket"), w("satellite"), w("starlink"), a("ناسا"), a("صاروخ"), a("قمر صناعي"), a("ستارلينك"), a("أقمار صناعية")] },
  { tag: "سيارات كهربائية", ai: false, words: [w("ev"), w("evs"), w("electric vehicles?"), w("self-driving"), w("autonomous (cars?|vehicles?|driving)"), w("waymo"), a("سيارات كهربائية"), a("سيارة كهربائية"), a("القيادة الذاتية"), a("ذاتية القيادة")] },
  { tag: "شبكات واتصالات", ai: false, words: [w("5g"), w("6g"), w("wi-?fi"), w("broadband"), w("telecom"), a("اتصالات"), a("الجيل الخامس"), a("شبكات"), a("إنترنت")] },
  { tag: "تنظيم وسياسات", ai: false, words: [w("regulation"), w("antitrust"), w("privacy"), w("lawsuit"), w("eu ai act"), w("ftc"), a("تنظيم"), a("قانون"), a("الخصوصية"), a("دعوى"), a("الاتحاد الأوروبي")] },
  { tag: "شركات ناشئة وتمويل", ai: false, words: [w("startups?"), w("funding"), w("valuation"), w("raises"), w("ipo"), w("acquisition"), w("acquires"), a("شركة ناشئة"), a("شركات ناشئة"), a("تمويل"), a("استحواذ"), a("تقييم"), a("جولة")] },
  { tag: "تقنية عامة", ai: false, words: [w("tech"), w("technology"), w("digital"), w("computers?"), w("computing"), w("internet"), w("gadgets?"), a("تقنية"), a("التقنية"), a("تكنولوجيا"), a("التكنولوجيا"), a("رقمي"), a("الرقمية"), a("الرقمي"), a("حاسوب"), a("الحاسوب"), a("كمبيوتر")] },
];

export interface Classification {
  isTech: boolean;
  category: Category;
  tags: string[];
  aiScore: number;
  techScore: number;
}

export function classify(title: string, body = ""): Classification {
  const head = (title || "").toLowerCase();
  const rest = (body || "").slice(0, 4000).toLowerCase();
  const tags: string[] = [];
  let aiScore = 0;
  let techScore = 0;
  for (const g of GROUPS) {
    const inTitle = g.words.some((re) => re.test(head));
    const inBody = !inTitle && g.words.some((re) => re.test(rest));
    if (!inTitle && !inBody) continue;
    const weight = inTitle ? 3 : 1;
    if (g.ai) aiScore += weight;
    else techScore += weight;
    if (tags.length < 6) tags.push(g.tag);
  }
  const isTech = aiScore + techScore >= 1;
  const category: Category = aiScore >= 2 || (aiScore >= 1 && aiScore >= techScore) ? "ai" : "tech";
  return { isTech, category, tags, aiScore, techScore };
}
