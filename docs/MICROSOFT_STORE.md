# IsoCad — Electron & Microsoft Store Yayınlama Rehberi

Bu doküman, **IsoCad** uygulamasının Electron masaüstü altyapısını ve **Microsoft Store (APPX / MSIX)** paketleme adımlarını açıklar.

## 1. Altyapı Dosyaları

- **`electron/main.ts`**: Electron ana süreci. Özel `app://isocad/` protokolü üzerinden `dist/` içeriğini güvenli şekilde sunar (WebGL2, `pdf.worker.min.js`, `localStorage`, `IndexedDB` ve `BrowserRouter` SPA rotaları tam uyumludur). Harici linkleri sistem tarayıcısında açar, tek örnek (single-instance) kilidi uygular.
- **`electron/preload.ts`**: `contextIsolation: true` ve `sandbox: true` ile güvenli `window.electronAPI` köprüsü sağlar.
- **`tsconfig.electron.json`**: `electron/` TypeScript kodlarını `dist-electron/` klasörüne derler.
- **`electron-builder.yml`**: Windows (`appx` ve `nsis`) paketleme ve Microsoft Store kimlik yapılandırması.
- **`build/` ve `build/appx/`**: Uygulama ikonları (`icon.ico`, `icon.png`) ve Microsoft Store görsel varlıkları (`StoreLogo.png`, `Square44x44Logo.png`, `Square150x150Logo.png`, `Square310x310Logo.png`, `Wide310x150Logo.png`, `SplashScreen.png`).

---

## 2. Geliştirme ve Test Komutları

```bash
# Vite + Electron canlı geliştirme modu
npm run electron:dev

# Production build alıp Electron ile yerel önizleme
npm run electron:preview

# Paketlenmemiş Windows klasör çıktısı (hızlı doğrulama)
npm run dist:dir

# Sadece Microsoft Store (.appx) paketi üretme
npm run dist:appx

# Hem Microsoft Store (.appx) hem NSIS kurulum (.exe) üretme
npm run dist:win
```

Üretilen paketler `release/<version>/` klasöründe oluşturulur.

---

## 3. Microsoft Store Yayını Öncesi Zorunlu Adımlar

Microsoft Partner Center üzerinden uygulama kaydı açtıktan sonra `electron-builder.yml` dosyasındaki `appx:` bölümünü gerçek değerlerle güncelleyin:

1. **Partner Center → App management → Product identity** sayfasına gidin.
2. Aşağıdaki alanları `electron-builder.yml` içine kopyalayın:
   - `identityName`: Partner Center'daki **Package/Identity/Name** değeri (örn. `12345TruncgilTeknoloji.IsoCad`)
   - `publisher`: Partner Center'daki **Package/Identity/Publisher** değeri (örn. `CN=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX`)
   - `publisherDisplayName`: Partner Center'daki **Package/Properties/PublisherDisplayName** değeri (örn. `Trunçgil Teknoloji`)
3. Paket sürümünü `package.json` içindeki `"version"` alanından yönetin (Store kuralları gereği her yeni yüklemede sürüm numarası artırılmalıdır).
4. `npm run dist:appx` komutunu çalıştırıp `release/<version>/IsoCad <version>.appx` dosyasını oluşturun.
5. Oluşan `.appx` paketini Partner Center → **Packages** bölümüne yükleyin (Microsoft Store yükleme sırasında paketi kendi Store sertifikası ile otomatik imzalar).

---

## 4. Store Sertifikasyon Kontrol Listesi

- **Gizlilik Politikası (Privacy Policy URL)**: Partner Center mağaza listelemesinde geçerli bir gizlilik politikası bağlantısı zorunludur.
- **Yaş Derecelendirmesi (Age Rating)**: Partner Center anketini doldurun (CAD/üretkenlik aracı olarak genellikle 3+ / Everyone).
- **Ekran Görüntüleri**: En az 1 masaüstü ekran görüntüsü (1366x768 veya 1920x1080 PNG/JPG) ve opsiyonel mağaza tanıtım görselleri.
- **Çevrimdışı Çalışma**: Uygulama tüm varlıkları (`pdf.worker.min.js`, örnek PDF'ler, ikonlar) paket içinde barındırır; internet olmadığında da açılır ve çalışır.
- **Güvenlik**: `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true` ve harici URL'ler için `shell.openExternal` protokol doğrulaması aktiftir.

