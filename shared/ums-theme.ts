/**
 * «المظهر الحديث» للوحة UMS: أنماط تُحقن فوق Bootstrap 4 الذي يعتمده الموقع،
 * مع وضع داكن اختياري. مشترك بين نسخة سطح المكتب (WebContentsView) ونسخة
 * الأندرويد (WebView أصلي).
 */
import tajawal400Ar from "../src/assets/fonts/tajawal-400-arabic.woff2";
import tajawal400La from "../src/assets/fonts/tajawal-400-latin.woff2";
import tajawal700Ar from "../src/assets/fonts/tajawal-700-arabic.woff2";
import tajawal700La from "../src/assets/fonts/tajawal-700-latin.woff2";

export const DEFAULT_UMS_URL = "https://ums.mbzuh.ac.ae";

const ARABIC_RANGE = "U+0600-06FF, U+0750-077F, U+FB50-FDFF, U+FE70-FEFC, U+200C-200E";
const LATIN_RANGE = "U+0000-00FF, U+0131, U+0152-0153, U+2000-206F, U+20AC, U+2122, U+FEFF, U+FFFD";

const FONT_CSS = `
@font-face{font-family:"Tajawal";font-style:normal;font-weight:400;font-display:swap;src:url(${tajawal400Ar}) format("woff2");unicode-range:${ARABIC_RANGE}}
@font-face{font-family:"Tajawal";font-style:normal;font-weight:400;font-display:swap;src:url(${tajawal400La}) format("woff2");unicode-range:${LATIN_RANGE}}
@font-face{font-family:"Tajawal";font-style:normal;font-weight:700;font-display:swap;src:url(${tajawal700Ar}) format("woff2");unicode-range:${ARABIC_RANGE}}
@font-face{font-family:"Tajawal";font-style:normal;font-weight:700;font-display:swap;src:url(${tajawal700La}) format("woff2");unicode-range:${LATIN_RANGE}}
`;

/** المظهر الحديث: يعيد تشكيل مكوّنات Bootstrap 4 (أزرار، حقول، بطاقات، جداول، قوائم). */
export const MODERN_CSS = `
${FONT_CSS}
:root{--mb-gold:#956a28;--mb-gold-2:#c9a24a;--mb-gold-3:#f1dfae;--mb-navy:#0f1f3d;--mb-bg:#f6f3ec;--mb-card:#ffffff;--mb-ink:#1c2433;--mb-muted:#6b7280;--mb-border:#e6dfd0;--mb-radius:14px;--mb-shadow:0 12px 32px rgba(15,31,61,.08)}
html{scroll-behavior:smooth}
body{font-family:"Tajawal","Segoe UI",Tahoma,sans-serif!important;color:var(--mb-ink)!important;-webkit-font-smoothing:antialiased;background-color:var(--mb-bg)!important}
body:not(.text-center){background-image:radial-gradient(900px 400px at 100% -10%,rgba(201,162,74,.14),transparent 60%),radial-gradient(700px 400px at -10% 110%,rgba(15,31,61,.08),transparent 60%)!important;background-attachment:fixed}
h1,h2,h3,h4,h5,h6,.h1,.h2,.h3,.h4,.h5,.h6{font-family:"Tajawal","Segoe UI",Tahoma,sans-serif!important;font-weight:700!important;letter-spacing:0}
::-webkit-scrollbar{width:10px;height:10px}
::-webkit-scrollbar-thumb{background:rgba(149,106,40,.45);border-radius:999px;border:2px solid transparent;background-clip:padding-box}
::-webkit-scrollbar-thumb:hover{background:rgba(149,106,40,.7);background-clip:padding-box;border:2px solid transparent}
::-webkit-scrollbar-track{background:transparent}
a{color:var(--mb-gold);transition:color .12s}a:hover{color:#6e4d1e}
img{border-radius:6px}
.btn,button.btn,input[type=submit].btn,a.btn{border-radius:12px!important;font-weight:700!important;letter-spacing:.1px;transition:transform .12s ease,box-shadow .18s ease,background .15s!important;box-shadow:0 2px 6px rgba(15,31,61,.06)}
.btn:hover{transform:translateY(-1px);box-shadow:0 10px 22px rgba(149,106,40,.22)!important}
.btn:active{transform:translateY(0) scale(.99)}
.btn-primary,.btn-primary:focus{background:linear-gradient(135deg,#b7853a,#8f6427)!important;border-color:#8f6427!important;color:#fff!important}
.btn-primary:hover{background:linear-gradient(135deg,#c9964a,#9c6f2d)!important}
.btn-secondary{background:#e9e4d8!important;border-color:#e9e4d8!important;color:#3b3325!important}
.btn-success{background:linear-gradient(135deg,#2f9e6b,#217a52)!important;border-color:#217a52!important}
.btn-danger{background:linear-gradient(135deg,#d9484c,#b32e33)!important;border-color:#b32e33!important}
.btn-info{background:linear-gradient(135deg,#2c8bb8,#1f6f94)!important;border-color:#1f6f94!important}
.btn-warning{background:linear-gradient(135deg,#f0b43c,#d9961c)!important;border-color:#d9961c!important;color:#2b2000!important}
.btn-outline-primary{border-color:var(--mb-gold)!important;color:var(--mb-gold)!important}.btn-outline-primary:hover{background:var(--mb-gold)!important;color:#fff!important}
.form-control,.custom-select,select,textarea,input[type=text],input[type=password],input[type=email],input[type=number],input[type=date],input[type=search]{border-radius:12px!important;border:1px solid var(--mb-border)!important;padding:10px 14px!important;background:#fff!important;color:var(--mb-ink)!important;min-height:44px;transition:box-shadow .15s,border-color .15s!important;font-family:inherit!important}
.form-control:focus,.custom-select:focus,select:focus,textarea:focus,input:focus{border-color:var(--mb-gold-2)!important;box-shadow:0 0 0 4px rgba(201,162,74,.22)!important;outline:none!important}
.form-control-sm,.input-group-sm>.form-control{min-height:34px;padding:6px 10px!important}
label{font-weight:700;color:#3f3a30}
.input-group-text{border-radius:12px!important;background:#f3eee2!important;border-color:var(--mb-border)!important;color:var(--mb-gold)!important}
.card,.panel,.jumbotron,.list-group,.well,.modal-content,.accordion>.card{border-radius:var(--mb-radius)!important;border:1px solid var(--mb-border)!important;box-shadow:var(--mb-shadow)!important;background:var(--mb-card)!important;overflow:hidden}
.card-header,.panel-heading,.modal-header{background:linear-gradient(180deg,#fbf8f1,#f5efe2)!important;border-bottom:1px solid var(--mb-border)!important;font-weight:700;color:var(--mb-gold)!important}
.card-footer,.modal-footer{background:#faf7f0!important;border-top:1px solid var(--mb-border)!important}
.modal-content{border-radius:18px!important}
.modal-backdrop.show{opacity:.55!important;backdrop-filter:blur(3px)}
.table{border-collapse:separate!important;border-spacing:0;background:#fff;border-radius:var(--mb-radius);overflow:hidden;box-shadow:var(--mb-shadow)}
.table thead th,.table thead td,table th{background:#faf6ec!important;color:var(--mb-gold)!important;border-bottom:2px solid #eadfc8!important;border-top:none!important;font-weight:700!important;position:sticky;top:0;z-index:2;white-space:nowrap}
.table tbody tr{transition:background .12s}
.table tbody tr:hover,.table-hover tbody tr:hover{background:rgba(201,162,74,.10)!important}
.table td,.table th{border-top:1px solid #f0ebe0!important;vertical-align:middle!important;padding:.65rem .8rem!important}
.table-striped tbody tr:nth-of-type(odd){background:rgba(15,31,61,.025)!important}
.table-bordered,.table-bordered td,.table-bordered th{border-color:#efe9dc!important}
.thead-dark th{background:var(--mb-navy)!important;color:#f1dfae!important}
.navbar{backdrop-filter:blur(12px);background:rgba(255,255,255,.86)!important;border-bottom:1px solid var(--mb-border)!important;box-shadow:0 6px 20px rgba(15,31,61,.06)}
.navbar-dark,.bg-dark.navbar,.navbar.bg-primary{background:linear-gradient(90deg,#0f1f3d,#182d57)!important}
.navbar-dark .navbar-nav .nav-link{color:#f1dfae!important}
.nav-link{border-radius:10px;transition:background .12s,color .12s}
.nav-link:hover{background:rgba(201,162,74,.14)}
.nav-tabs{border-bottom:1px solid var(--mb-border)!important}
.nav-tabs .nav-link{border:none!important;border-bottom:2px solid transparent!important;border-radius:10px 10px 0 0!important;color:var(--mb-muted)}
.nav-tabs .nav-link.active{color:var(--mb-gold)!important;border-bottom-color:var(--mb-gold)!important;background:rgba(201,162,74,.10)!important;font-weight:700}
.nav-pills .nav-link.active{background:var(--mb-gold)!important;border-radius:999px!important}
.list-group-item{border-color:#efe9dc!important;transition:background .12s}
.list-group-item:hover{background:rgba(201,162,74,.08)!important}
.list-group-item.active{background:var(--mb-gold)!important;border-color:var(--mb-gold)!important}
.badge{border-radius:999px!important;padding:.4em .75em!important;font-weight:700!important}
.badge-primary{background:var(--mb-gold)!important}
.alert{border-radius:12px!important;border:none!important;box-shadow:0 8px 20px rgba(15,31,61,.06)}
.alert-info{background:#e8f3fa!important;color:#134b6b!important}
.alert-success{background:#e6f5ec!important;color:#1b5e3a!important}
.alert-warning{background:#fff4d9!important;color:#6f4b00!important}
.alert-danger{background:#fdeaea!important;color:#7a1f1f!important}
.dropdown-menu{border-radius:12px!important;box-shadow:0 16px 36px rgba(15,31,61,.16)!important;border:1px solid var(--mb-border)!important;padding:6px!important}
.dropdown-item{border-radius:8px;transition:background .1s}
.dropdown-item:hover,.dropdown-item:focus{background:rgba(201,162,74,.14)!important;color:var(--mb-ink)!important}
.pagination .page-link{border-radius:10px!important;margin:0 2px;border-color:var(--mb-border)!important;color:var(--mb-gold)!important}
.pagination .page-item.active .page-link{background:var(--mb-gold)!important;border-color:var(--mb-gold)!important;color:#fff!important}
.progress{border-radius:999px!important;height:10px!important;background:#efe9dc!important}
.progress-bar{background:linear-gradient(90deg,#c9a24a,#8f6427)!important}
.breadcrumb{background:transparent!important;padding:0!important}
.custom-control-input:checked~.custom-control-label::before{background:var(--mb-gold)!important;border-color:var(--mb-gold)!important}
hr{border-color:var(--mb-border)!important}
fieldset,legend{border-color:var(--mb-border)!important}
iframe{border-radius:12px}
/* صفحة الدخول */
body.text-center{background:radial-gradient(1200px 700px at 20% -10%,rgba(201,162,74,.28),transparent 60%),radial-gradient(900px 600px at 110% 110%,rgba(15,31,61,.35),transparent 55%),linear-gradient(160deg,#f7f3ea 0%,#efe8d8 100%)!important;background-attachment:fixed!important}
body.text-center .container-fluid{background:rgba(255,255,255,.72);backdrop-filter:blur(16px);border:1px solid rgba(201,162,74,.35);border-radius:26px;padding:34px 26px 30px;box-shadow:0 30px 70px rgba(15,31,61,.18);max-width:460px;width:100%;margin:0 auto;animation:mbIn .5s cubic-bezier(.2,.8,.2,1) both}
body.text-center .form-signin{max-width:340px;margin:0 auto}
body.text-center .form-signin>a{display:block;width:100%;text-decoration:none!important}
body.text-center h5,body.text-center h6{font-family:"Tajawal","Segoe UI",Tahoma,sans-serif!important}
body.text-center h5{font-size:22px!important;color:var(--mb-gold)!important;margin-top:6px}
body.text-center h6{color:#6b7280!important;letter-spacing:1px;text-transform:uppercase;font-size:11px!important;margin-bottom:22px}
body.text-center .form-signin a.btn,body.text-center .form-signin a>div{border-radius:14px!important;width:100%!important;min-height:48px!important;display:flex!important;align-items:center;justify-content:center;gap:10px;font-family:"Tajawal","Segoe UI",Tahoma,sans-serif!important;font-weight:700!important;letter-spacing:0!important;box-shadow:0 6px 16px rgba(15,31,61,.08);transition:transform .12s,box-shadow .18s}
body.text-center .form-signin a>div:hover,body.text-center .form-signin a.btn:hover{transform:translateY(-2px);box-shadow:0 14px 28px rgba(149,106,40,.24)}
body.text-center img.spinhov{filter:drop-shadow(0 10px 20px rgba(15,31,61,.18))}
@keyframes mbIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.card,.table,.alert,.jumbotron{animation:mbIn .35s ease-out both}
`;

export const DARK_CSS = `
html{color-scheme:dark}
body,body:not(.text-center){background:#0b1426!important;background-image:radial-gradient(900px 400px at 100% -10%,rgba(201,162,74,.12),transparent 60%),radial-gradient(700px 400px at -10% 110%,rgba(59,90,160,.16),transparent 60%)!important;color:#e6ebf5!important}
body.text-center{background:radial-gradient(1200px 700px at 20% -10%,rgba(201,162,74,.22),transparent 60%),linear-gradient(160deg,#0b1426 0%,#0f1f3d 100%)!important}
body.text-center .container-fluid{background:rgba(19,32,64,.72)!important;border-color:rgba(201,162,74,.35)!important}
body.text-center .form-signin a>div,body.text-center .form-signin a.btn{background:#152548!important;color:#f1dfae!important;border-color:rgba(201,162,74,.5)!important}
h1,h2,h3,h4,h5,h6,p,span,div,td,th,li,label,small,strong,b{color:inherit}
.card,.panel,.jumbotron,.list-group,.well,.modal-content,.accordion>.card,.dropdown-menu,.list-group-item,.navbar,.table,.page-link,.input-group-text{background:#132040!important;color:#e6ebf5!important;border-color:#23345a!important}
.card-header,.panel-heading,.modal-header,.card-footer,.modal-footer{background:#0f1a34!important;border-color:#23345a!important;color:#e0bd6a!important}
.form-control,.custom-select,select,textarea,input[type=text],input[type=password],input[type=email],input[type=number],input[type=date],input[type=search]{background:#0f1a34!important;color:#e6ebf5!important;border-color:#2a3d63!important}
.form-control::placeholder{color:#7d8aa6!important}
.table thead th,.table thead td,table th{background:#0f1a34!important;color:#e0bd6a!important;border-bottom-color:#2f4570!important}
.table td,.table th{border-top-color:#1e2f52!important;color:#e6ebf5!important}
.table-striped tbody tr:nth-of-type(odd){background:rgba(255,255,255,.03)!important}
.table tbody tr:hover,.table-hover tbody tr:hover{background:rgba(201,162,74,.12)!important}
.table-bordered,.table-bordered td,.table-bordered th{border-color:#23345a!important}
.bg-white,.bg-light,.table-light,.thead-light th{background:#132040!important;color:#e6ebf5!important}
.text-dark,.text-body,.text-secondary,.text-muted{color:#c3cde0!important}
.navbar-light .navbar-nav .nav-link,.navbar-light .navbar-brand{color:#f1dfae!important}
.nav-tabs .nav-link{color:#aab6cc}
.btn-secondary,.btn-light,.btn-outline-secondary{background:#1c2c52!important;border-color:#2a3d63!important;color:#e6ebf5!important}
.alert-info{background:#123047!important;color:#bfe3f7!important}.alert-success{background:#123a28!important;color:#bdf1d3!important}.alert-warning{background:#4a3606!important;color:#ffe6a6!important}.alert-danger{background:#4a1616!important;color:#ffc9c9!important}
a{color:#e0bd6a}a:hover{color:#f1dfae}
img:not([src*="logo"]):not([src*="icon"]){filter:brightness(.92)}
hr{border-color:#23345a!important}
::-webkit-scrollbar-thumb{background:rgba(201,162,74,.5);background-clip:padding-box;border:2px solid transparent}
`;


/** هل الرابط ضمن نطاقات الجامعة أو تسجيل الدخول (يبقى داخل اللوحة)؟ */
export function isUmsInternalUrl(url: string, homeUrl = DEFAULT_UMS_URL): boolean {
  try {
    const home = new URL(homeUrl);
    const host = new URL(url).hostname;
    return (
      host === home.hostname ||
      host.endsWith(".mbzuh.ac.ae") ||
      /(^|\.)microsoftonline\.com$|(^|\.)microsoft\.com$|(^|\.)live\.com$|(^|\.)uaepass\.ae$|(^|\.)msauth\.net$|(^|\.)msftauth\.net$/i.test(host)
    );
  } catch {
    return false;
  }
}
