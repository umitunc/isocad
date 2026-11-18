import{c as u,a as m,f as g,j as e,u as h,L as y,B as x,T as f,b as v,A as D}from"./index-CwCFYPke.js";import"./pdf-exporter-CwMmiqx2.js";/**
 * @license lucide-react v0.475.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const C=[["path",{d:"M20 6 9 17l-5-5",key:"1gmf2c"}]],P=u("Check",C);/**
 * @license lucide-react v0.475.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const A=[["rect",{width:"14",height:"14",x:"8",y:"8",rx:"2",ry:"2",key:"17jyea"}],["path",{d:"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2",key:"zix9uf"}]],N=u("Copy",A);/**
 * @license lucide-react v0.475.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const k=[["circle",{cx:"11",cy:"11",r:"8",key:"4ej97u"}],["path",{d:"m21 21-4.3-4.3",key:"1qie3q"}]],w=u("Search",k),L=new Set(["import","from","export","const","let","async","await","return","interface","type","class","new","if","else","function","true","false","null"]);function S(l,o,i){if(l.trim().startsWith("//")||l.trim().startsWith("<!--"))return[e.jsx("span",{className:"text-slate-500 italic",children:l},"cmt")];const r=l.split(/("[^"]*"|'[^']*'|\b\d+(?:\.\d+)?\b|\b[A-Za-z_]\w*\b|[{}()[\]:.,=<>\/])/g);return r.map((t,s)=>{if(!t)return null;if(t.startsWith('"')||t.startsWith("'")){const n=r[s+1]??"";return o==="json"&&n.trim().startsWith(":")?e.jsx("span",{className:i?"text-cyan-700":"text-cyan-300",children:t},s):e.jsx("span",{className:i?"text-emerald-700":"text-emerald-300",children:t},s)}return/^\d+(?:\.\d+)?$/.test(t)?e.jsx("span",{className:i?"text-amber-700":"text-amber-300",children:t},s):L.has(t)?e.jsx("span",{className:i?"text-purple-700 font-semibold":"text-purple-400 font-semibold",children:t},s):/^(iframe|script|div|QCAD_EDITOR|QCAD_DOCUMENT_SAVED|SyncOrchestrator|syncOrchestrator|fetch|JSON|window|console)$/.test(t)?e.jsx("span",{className:i?"text-sky-700":"text-sky-300",children:t},s):/^[{}()[\]:.,=<>\/]$/.test(t)?e.jsx("span",{className:i?"text-slate-500":"text-slate-400",children:t},s):e.jsx("span",{className:i?"text-slate-900":"text-slate-200",children:t},s)})}const I=({code:l,language:o="typescript"})=>{const[i,r]=m.useState(!1),{theme:t}=g(),s=t==="light",n=l.split(`
`),d=()=>{navigator.clipboard.writeText(l),r(!0),setTimeout(()=>r(!1),1800)};return e.jsxs("div",{className:s?"rounded-xl border border-slate-200 bg-slate-50 overflow-hidden shadow-sm":"rounded-xl border border-slate-800/90 bg-[#060a12] overflow-hidden shadow-inner",children:[e.jsxs("div",{className:s?"flex items-center justify-between border-b border-slate-200 bg-slate-100 px-4 py-2 text-[10px] font-mono":"flex items-center justify-between border-b border-slate-800/80 bg-slate-900/60 px-4 py-2 text-[10px] font-mono",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("span",{className:"h-2 w-2 rounded-full bg-rose-500/70"}),e.jsx("span",{className:"h-2 w-2 rounded-full bg-amber-500/70"}),e.jsx("span",{className:"h-2 w-2 rounded-full bg-emerald-500/70"}),e.jsx("span",{className:`ml-2 uppercase tracking-wider ${s?"text-slate-600":"text-slate-400"}`,children:o})]}),e.jsxs("button",{type:"button",onClick:d,className:`inline-flex items-center gap-1 rounded px-2 py-0.5 cursor-pointer ${s?"text-cyan-700 hover:bg-slate-200":"text-cyan-300 hover:bg-slate-800"}`,children:[i?e.jsx(P,{className:"h-3 w-3 text-emerald-500"}):e.jsx(N,{className:"h-3 w-3"}),i?"Copied":"Copy"]})]}),e.jsx("div",{className:"overflow-x-auto p-4 text-xs font-mono leading-relaxed",children:n.map((c,a)=>e.jsxs("div",{className:"flex",children:[e.jsx("span",{className:`w-8 shrink-0 select-none text-right pr-4 ${s?"text-slate-400":"text-slate-600"}`,children:a+1}),e.jsx("span",{className:"whitespace-pre",children:S(c,o,s)})]},a))})]})},E={tr:[{id:"overview",navLabel:"1. Genel Bakış",title:"1. Genel Bakış & Mimari",summary:"IsoCad; tarayıcıda donanım hızlandırmalı WebGL2 ile çalışan AutoCAD alternatifli CAD çizim ve endüstriyel Piping PDF veri çıkarım platformudur.",bullets:["Sıfır sunucu bağımlılığı: PDF okuma, MTO/Weld Log analizi ve vektör PDF çıktısı tarayıcıda çalışır.","R-Tree uzamsal indeksleme ile PDF üzerindeki boru uçlarına ve dirseklere OSNAP yakalama.","Kayıpsız Vektör PDF, 5 sayfalı kurumsal Excel (.xlsx) ve AutoCAD (.dxf) dışa aktarım."]},{id:"install",navLabel:"NPM & CDN Kurulum",title:"NPM & CDN Kurulumu (React & Vanilla JS)",summary:"IsoCad’i React projenize npm ile kurabilir veya herhangi bir HTML sayfasına jsDelivr / unpkg CDN üzerinden doğrudan ekleyebilirsiniz.",bullets:["NPM Paketi: npm install isocad-webgl-pdf","React Bileşeni: <IsoCadEditor /> ve çekirdek motorlar (PipingPdfAnalyzer, CadEngineFacade)",'CDN (Sıfır Kurulum): isocad.cdn.js + isocad.css ile IsoCad.mount("#app")'],codeLang:"html",code:`<!-- 1) NPM (React 18 / 19) -->
// npm install isocad-webgl-pdf
import { IsoCadEditor, PipingPdfAnalyzer } from 'isocad-webgl-pdf';
import 'isocad-webgl-pdf/style.css';

export function App() {
  return <IsoCadEditor />;
}

<!-- 2) CDN (Vanilla JS / Laravel / Herhangi Bir HTML Sayfası) -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/isocad-webgl-pdf/dist-lib/isocad.css" />
<div id="isocad-root" style="width:100%;height:100vh"></div>
<script src="https://cdn.jsdelivr.net/npm/isocad-webgl-pdf/dist-lib/isocad.cdn.js"><\/script>
<script>
  IsoCad.mount('#isocad-root', { theme: 'dark', locale: 'tr' });
<\/script>`},{id:"solid",navLabel:"2. Modüler Genişletme",title:"2. Modüler Tasarım & Genişletilebilirlik",summary:"Çekirdek motor arayüzlere bağlıdır; mevcut kodu değiştirmeden yeni CAD araçları, PDF şablonları veya ERP adaptörleri ekleyebilirsiniz.",bullets:["Yeni Çizim Aracı: ICadTool arayüzünü uygulayıp ToolRegistry’ye ekleyin.","Yeni PDF Şablonu: IPipingParserStrategy ile özel BOM/MTO formatlarını tanımlayın.","Yeni API Ucu: IDataSyncAdapter ile SAP, ERP veya özel Webhook bağlantısı kurun."],codeLang:"typescript",code:`// Yeni bir ERP senkronizasyon adaptörü ekleme
syncOrchestrator.register({
  adapterId: 'erp-webhook',
  displayName: 'Kurumsal ERP Webhook',
  async pushDocumentState(envelope) {
    const res = await fetch('https://api.firma.com/v1/weldmap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(envelope),
    });
    return {
      success: res.ok,
      statusCode: res.status,
      endpointUrl: res.url,
      message: 'Senkronizasyon tamamlandı',
      durationMs: 38,
    };
  },
});`},{id:"cad-cli",navLabel:"3. CAD & Kısayollar",title:"3. WebGL2 CAD, OSNAP & F5 Isoplane",summary:"İçe aktarılan PDF paftaları üzerinde AutoCAD komut satırı ve izometrik eksen kilidiyle doğrudan çizim yapın.",bullets:["Çizim Komutları: L (Çizgi), PL (Çoklu Çizgi), C (Daire), REC (Dikdörtgen), CLOUD (Revizyon Bulutu), DIM (Ölçü).","Kaynak Damgaları: FJ (Saha Kaynağı — Üçgen), SJ (Atölye Kaynağı — Daire), SP (Spool).","Kutupsal Giriş: Komut satırında @150<30 yazarak 30° izometrik açıda 150 birim çizin.","Kısayollar: F5 (Isoplane 30°/90°/150°), F8 (Ortho), Space (Pan), Ctrl+Z / Ctrl+Y."]},{id:"piping",navLabel:"4. MTO & Weld Log",title:"4. Piping MTO, Cut List & As-Built Çıkarım",summary:"Danieli (EN + Rusça Kiril), Linde/Energiron ve As-Built kaynakçı damgalı PDF paftalarından otomatik veri çıkarımı.",bullets:["DAN Code Birleştirme: İki satıra bölünmüş 12 haneli kodları otomatik tekilleştirir.","Bend Kuralı: 3D/4D/PLD BEND ifadeleri boru bükümü sayılır; fazladan kaynak eklenmez.","As-Built Damga Algılama: MTO olmayan As-Built paftalarda kaynakçı damgalarını ve FE21/FA00 supportları çıkarır."]},{id:"api",navLabel:"5. REST API & Webhook",title:"5. REST API & Webhook Veri Paketi",summary:"Düzenlenen CAD nesneleri, kaynakçı bilgileri, MTO tabloları ve vektör PDF çıktısı standart JSON zarfıyla dış uca aktarılır.",bullets:["Bearer Token, özel X-API-Key başlığı veya Laravel CSRF doğrulamasını destekler.","Vektör PDF ikili verisi ve tüm tablo çıktıları tek istekte iletilebilir."],codeLang:"json",code:`{
  "schemaVersion": "1.0.0",
  "stage": "pdf_as_build",
  "document": {
    "drawingType": "engineering",
    "drawingNo": "GN-80-AH01FS-FA00.030",
    "revisionNo": "01",
    "sheetNo": "1"
  },
  "annotations": [
    {
      "id": "J-001",
      "shapeKind": "triangle",
      "jointMeta": {
        "typeOfJoint": "F",
        "jointNo": "53A",
        "drawJointNo": "F53A",
        "welderId": "W-104"
      }
    }
  ]
}`},{id:"embed",navLabel:"6. ERP & Iframe SDK",title:"6. Laravel / ERP & Iframe Entegrasyonu",summary:"IsoCad’i mevcut Laravel/ERP uygulamanızın içine gömün veya LaravelApiAdapter ile doğrudan veritabanına kaydedin.",bullets:["LaravelApiAdapter: /api/pdf-editor/annotations/sync ve /export-pdf uçlarıyla uyumludur.","PostMessageBridge: Kayıt anında üst pencereye QCAD_DOCUMENT_SAVED olayı gönderir."],codeLang:"html",code:`<!-- Herhangi bir ERP veya Laravel sayfasına IsoCad gömme -->
<iframe id="isocad" src="https://isocad.truncgil.com/editor" class="w-full h-screen"></iframe>

<script>
  window.addEventListener('message', (event) => {
    if (event.data?.source === 'QCAD_EDITOR' && event.data?.type === 'QCAD_DOCUMENT_SAVED') {
      console.log('Gelen Weldmap & Vektör PDF:', event.data.payload);
    }
  });
<\/script>`}],en:[{id:"overview",navLabel:"1. Overview",title:"1. Overview & Architecture",summary:"IsoCad is a WebGL2 CAD drafting and industrial Piping PDF intelligence platform running natively in the browser.",bullets:["Zero backend lock-in: PDF parsing, MTO/Weld Log extraction, and vector PDF export run client-side.","R-Tree spatial indexing enables sub-millisecond OSNAP on imported PDF pipe vectors.","Lossless Vector PDF, 5-sheet Excel (.xlsx), and AutoCAD (.dxf) export."]},{id:"install",navLabel:"NPM & CDN Install",title:"NPM & CDN Installation (React & Vanilla JS)",summary:"Install IsoCad in any React 18/19 app via npm, or load the self-contained UMD bundle directly from jsDelivr / unpkg CDN.",bullets:["NPM Package: npm install isocad-webgl-pdf","React Component: <IsoCadEditor /> plus PipingPdfAnalyzer & CadEngineFacade",'Zero-build CDN: Load isocad.cdn.js + isocad.css and call IsoCad.mount("#app")'],codeLang:"html",code:`<!-- 1) NPM (React 18 / 19) -->
// npm install isocad-webgl-pdf
import { IsoCadEditor, PipingPdfAnalyzer } from 'isocad-webgl-pdf';
import 'isocad-webgl-pdf/style.css';

export function App() {
  return <IsoCadEditor />;
}

<!-- 2) CDN (Vanilla JS / Laravel / Any HTML Page) -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/isocad-webgl-pdf/dist-lib/isocad.css" />
<div id="isocad-root" style="width:100%;height:100vh"></div>
<script src="https://cdn.jsdelivr.net/npm/isocad-webgl-pdf/dist-lib/isocad.cdn.js"><\/script>
<script>
  IsoCad.mount('#isocad-root', { theme: 'dark', locale: 'en' });
<\/script>`},{id:"solid",navLabel:"2. Modular Extensibility",title:"2. Modular Design & Extensibility",summary:"Core subsystems depend on clean TypeScript interfaces, making new tools, parsers, and API adapters plug-and-play.",bullets:["New CAD Tool: Implement ICadTool and register it in ToolRegistry.","New PDF Template: Implement IPipingParserStrategy for custom BOM layouts.","New Endpoint: Implement IDataSyncAdapter for SAP, ERP, or custom REST webhooks."],codeLang:"typescript",code:`// Register a custom ERP sync adapter
syncOrchestrator.register({
  adapterId: 'erp-webhook',
  displayName: 'Enterprise ERP Webhook',
  async pushDocumentState(envelope) {
    const res = await fetch('https://api.company.com/v1/weldmap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(envelope),
    });
    return {
      success: res.ok,
      statusCode: res.status,
      endpointUrl: res.url,
      message: 'Synced successfully',
      durationMs: 38,
    };
  },
});`},{id:"cad-cli",navLabel:"3. CAD & Shortcuts",title:"3. WebGL2 CAD, OSNAP & F5 Isoplane",summary:"Draft directly over engineering PDFs with AutoCAD-style CLI commands and isometric axis locking.",bullets:["Drafting: L (Line), PL (Polyline), C (Circle), REC (Rect), CLOUD (RevCloud), DIM (Dimension).","Weld Stamps: FJ (Field Weld Triangle), SJ (Shop Weld Circle), SP (Spool Rect).","Polar Input: Type @150<30 in the command bar to draw 150pt at 30° isometric angle.","Shortcuts: F5 (Isoplane 30°/90°/150°), F8 (Ortho), Space (Pan), Ctrl+Z / Ctrl+Y."]},{id:"piping",navLabel:"4. MTO & Weld Log",title:"4. Piping MTO, Cut List & As-Built Extraction",summary:"Automated extraction from Danieli (EN + Russian Cyrillic), Linde/Energiron, and stamped As-Built PDFs.",bullets:["DAN Code Normalization: Automatically merges split 12-digit material codes.","Bend Rule: 3D/4D/PLD BEND entries are treated as pipe bends with zero false weld joints.","As-Built Support: Extracts stamped welder IDs and FE21/FA00 supports even without MTO tables."]},{id:"api",navLabel:"5. REST API & Webhook",title:"5. REST API & Webhook Envelope",summary:"Push CAD entities, weld metadata, extracted MTO/Weld Log tables, and vector PDF binary in a single JSON envelope.",bullets:["Supports Bearer Token, custom X-API-Key header, or Laravel CSRF token.","Includes full pipingData tables and optional base64 Vector PDF."],codeLang:"json",code:`{
  "schemaVersion": "1.0.0",
  "stage": "pdf_as_build",
  "document": {
    "drawingType": "engineering",
    "drawingNo": "GN-80-AH01FS-FA00.030",
    "revisionNo": "01",
    "sheetNo": "1"
  },
  "annotations": [
    {
      "id": "J-001",
      "shapeKind": "triangle",
      "jointMeta": {
        "typeOfJoint": "F",
        "jointNo": "53A",
        "drawJointNo": "F53A",
        "welderId": "W-104"
      }
    }
  ]
}`},{id:"embed",navLabel:"6. ERP & Iframe SDK",title:"6. Laravel / ERP & Iframe Integration",summary:"Embed IsoCad inside any web app via Iframe PostMessageBridge or connect directly to Laravel / ERP REST APIs.",bullets:["LaravelApiAdapter: Maps directly to /api/pdf-editor/annotations/sync and /export-pdf.","PostMessageBridge: Dispatches QCAD_DOCUMENT_SAVED to window.parent on save."],codeLang:"html",code:`<!-- Embed IsoCad inside any Laravel or ERP portal -->
<iframe id="isocad" src="https://isocad.truncgil.com/editor" class="w-full h-screen"></iframe>

<script>
  window.addEventListener('message', (event) => {
    if (event.data?.source === 'QCAD_EDITOR' && event.data?.type === 'QCAD_DOCUMENT_SAVED') {
      console.log('Received Weldmap & Vector PDF:', event.data.payload);
    }
  });
<\/script>`}],ru:[{id:"overview",navLabel:"1. Обзор",title:"1. Обзор и архитектура",summary:"IsoCad — браузерная платформа WebGL2 CAD и интеллектуального анализа трубной изометрии PDF.",bullets:["Работает на стороне клиента: разбор PDF, извлечение MTO/Weld Log и векторный экспорт PDF.","Пространственный индекс R-Tree для точной привязки OSNAP к векторам трубопровода.","Экспорт в векторный PDF, 5-листовой Excel (.xlsx) и AutoCAD (.dxf)."]},{id:"install",navLabel:"NPM и CDN",title:"Установка через NPM и CDN",summary:"Установите IsoCad в проект React через npm или подключите автономную UMD-сборку напрямую с jsDelivr / unpkg CDN.",bullets:["NPM-пакет: npm install isocad-webgl-pdf","Компонент React: <IsoCadEditor /> и модули PipingPdfAnalyzer / CadEngineFacade",'CDN без сборки: подключите isocad.cdn.js + isocad.css и вызовите IsoCad.mount("#app")'],codeLang:"html",code:`<!-- 1) NPM (React 18 / 19) -->
// npm install isocad-webgl-pdf
import { IsoCadEditor, PipingPdfAnalyzer } from 'isocad-webgl-pdf';
import 'isocad-webgl-pdf/style.css';

export function App() {
  return <IsoCadEditor />;
}

<!-- 2) CDN (Vanilla JS / Любая HTML-страница) -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/isocad-webgl-pdf/dist-lib/isocad.css" />
<div id="isocad-root" style="width:100%;height:100vh"></div>
<script src="https://cdn.jsdelivr.net/npm/isocad-webgl-pdf/dist-lib/isocad.cdn.js"><\/script>
<script>
  IsoCad.mount('#isocad-root', { theme: 'dark', locale: 'ru' });
<\/script>`},{id:"solid",navLabel:"2. Модульная архитектура",title:"2. Модульность и расширяемость",summary:"Ядро построено на строгих интерфейсах TypeScript для легкого добавления инструментов и API-адаптеров.",bullets:["Новый инструмент: реализуйте ICadTool и зарегистрируйте в ToolRegistry.","Новый шаблон PDF: реализуйте IPipingParserStrategy.","Внешний API: реализуйте IDataSyncAdapter для SAP, ERP или Webhook."],codeLang:"typescript",code:`// Регистрация пользовательского ERP-адаптера
syncOrchestrator.register({
  adapterId: 'erp-webhook',
  displayName: 'Корпоративный ERP Webhook',
  async pushDocumentState(envelope) {
    const res = await fetch('https://api.company.com/v1/weldmap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(envelope),
    });
    return {
      success: res.ok,
      statusCode: res.status,
      endpointUrl: res.url,
      message: 'Успешно синхронизировано',
      durationMs: 38,
    };
  },
});`},{id:"cad-cli",navLabel:"3. CAD и команды",title:"3. WebGL2 CAD, OSNAP и F5 Isoplane",summary:"Чертите поверх инженерных PDF с командной строкой AutoCAD и изометрическими осями.",bullets:["Команды: L (Линия), PL (Полилиния), C (Круг), REC (Прямоугольник), CLOUD (Облако), DIM (Размер).","Штампы стыков: FJ (Монтажный стык), SJ (Заводской стык), SP (Спул).","Полярный ввод: @150<30 строит отрезок 150pt под углом 30°."]},{id:"piping",navLabel:"4. MTO и Weld Log",title:"4. Извлечение MTO, Cut List и As-Built",summary:"Автоматический разбор чертежей Danieli (EN + RU кириллица), Linde и исполнительных схем As-Built.",bullets:["Нормализация кодов DAN: объединение разорванных 12-значных кодов.","Гибы 3D/4D/PLD BEND учитываются без создания лишних сварных стыков.","Распознавание клейм сварщиков и опор FE21/FA00 на чертежах As-Built."]},{id:"api",navLabel:"5. REST API и Webhook",title:"5. Формат данных REST API и Webhook",summary:"Передача CAD-объектов, таблиц MTO/Weld Log и векторного PDF в едином JSON-пакете.",bullets:["Поддержка Bearer Token, X-API-Key и Laravel CSRF."],codeLang:"json",code:`{
  "schemaVersion": "1.0.0",
  "stage": "pdf_as_build",
  "document": {
    "drawingType": "engineering",
    "drawingNo": "GN-80-AH01FS-FA00.030",
    "revisionNo": "01",
    "sheetNo": "1"
  },
  "annotations": [
    {
      "id": "J-001",
      "shapeKind": "triangle",
      "jointMeta": {
        "typeOfJoint": "F",
        "jointNo": "53A",
        "drawJointNo": "F53A",
        "welderId": "W-104"
      }
    }
  ]
}`},{id:"embed",navLabel:"6. ERP и Iframe SDK",title:"6. Интеграция с ERP и Iframe",summary:"Встраивайте IsoCad в любую веб-систему через PostMessageBridge или LaravelApiAdapter.",bullets:["LaravelApiAdapter совместим с /api/pdf-editor/annotations/sync и /export-pdf."],codeLang:"html",code:`<!-- Встраивание IsoCad в любую ERP или веб-систему -->
<iframe id="isocad" src="https://isocad.truncgil.com/editor" class="w-full h-screen"></iframe>

<script>
  window.addEventListener('message', (event) => {
    if (event.data?.source === 'QCAD_EDITOR' && event.data?.type === 'QCAD_DOCUMENT_SAVED') {
      console.log('Получены данные Weldmap и PDF:', event.data.payload);
    }
  });
<\/script>`}]},R=()=>{const{locale:l,t:o}=h(),{theme:i}=g(),r=E[l],[t,s]=m.useState(r[0].id),[n,d]=m.useState(""),c=r.filter(a=>a.title.toLowerCase().includes(n.toLowerCase())||a.summary.toLowerCase().includes(n.toLowerCase())||a.bullets.some(p=>p.toLowerCase().includes(n.toLowerCase())));return e.jsxs("div",{className:"min-h-screen bg-[#0b1120] text-slate-100 flex flex-col",children:[e.jsxs("header",{className:"sticky top-0 z-20 border-b border-slate-800 bg-[#090d16]/90 backdrop-blur-md px-6 py-3 flex items-center justify-between gap-4",children:[e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsxs(y,{to:"/",className:"flex items-center gap-2 font-bold",children:[e.jsx("img",{src:i==="light"?"/isocad-logo-light.png":"/isocad-logo.png",alt:"IsoCad Logo",className:"h-8 w-auto object-contain"}),e.jsx("span",{className:"font-display text-sm text-slate-300",children:"Docs"})]}),e.jsx(x,{className:"h-4 w-4 text-cyan-400 hidden sm:block"})]}),e.jsxs("div",{className:"relative max-w-md flex-1 hidden md:block",children:[e.jsx(w,{className:"absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500"}),e.jsx("input",{value:n,onChange:a=>d(a.target.value),placeholder:"Search docs, CLI, API...",className:"w-full rounded-lg border border-slate-700 bg-slate-900 pl-9 pr-3 py-1.5 text-xs focus:border-cyan-500 focus:outline-none"})]}),e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx(f,{}),e.jsx(v,{}),e.jsxs(y,{to:"/demo",className:"inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500",children:[o.nav.launchDemo,e.jsx(D,{className:"h-3.5 w-3.5"})]})]})]}),e.jsxs("div",{className:"mx-auto flex w-full max-w-7xl flex-1 gap-8 px-6 py-8",children:[e.jsx("aside",{className:"hidden lg:block w-56 shrink-0 space-y-1 sticky top-20 self-start",children:r.map(a=>e.jsx("a",{href:`#${a.id}`,onClick:()=>s(a.id),className:`block rounded-lg px-3 py-2 text-xs font-medium transition-colors ${t===a.id?"bg-cyan-500/15 text-cyan-300 border border-cyan-500/30":"text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"}`,children:a.navLabel},a.id))}),e.jsx("main",{className:"flex-1 space-y-8 pb-16 min-w-0",children:c.map(a=>e.jsxs("section",{id:a.id,className:"rounded-2xl border border-slate-800 bg-[#090d16] p-6 space-y-4",children:[e.jsx("h2",{className:"text-lg font-bold text-white",children:a.title}),e.jsx("p",{className:"text-sm text-slate-400 leading-relaxed",children:a.summary}),e.jsx("ul",{className:"space-y-2 text-xs text-slate-300 list-disc pl-5",children:a.bullets.map((p,b)=>e.jsx("li",{children:p},b))}),a.code&&e.jsx(I,{code:a.code,language:a.codeLang})]},a.id))})]})]})};export{R as DocsPage};
