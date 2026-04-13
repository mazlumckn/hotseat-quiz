# Production Domain Setup (Cloudflare + Render)

Bu dosya "kullanicidan IP istemeyen" yapiyi adim adim kurar.

## 1) Bu repoda hazirlananlar

Asagidaki teknik hazirliklar yapildi:
- `stream-server.js` artik `PORT` env degerini destekliyor (cloud uyumlu).
- Linux + Windows icin Chrome path algilama eklendi.
- IPTV cache/health dosyalari icin `IPTV_DATA_DIR` destegi eklendi.
- Docker deploy dosyalari eklendi:
  - `Dockerfile`
  - `.dockerignore`
  - `render.yaml`
  - `.env.production.example`
- API base'i tek komutla guncellemek icin eklendi:
  - `npm run api:set -- https://api.example.com`

## 2) Senin panelden yapacagin kisimlar

Bu adimlar hesap ve domain paneli gerektirdigi icin buradan otomatik yapilamaz.

### A. Kodu GitHub'a gonder
1. Projeyi bir GitHub repo'ya push et.
2. `render.yaml` dosyasi repoda kalsin.

### B. Render'da backend ac
1. Render dashboard -> `New` -> `Blueprint`.
2. GitHub repo'nu sec.
3. Render `render.yaml` dosyasini okuyup servisi olusturur.
4. Ilk deploy tamamlaninca gecici URL alirsin (ornek: `https://cinematic-api.onrender.com`).
5. Test et:
   - `https://<render-url>/health`
   - JSON donmeli ve `ok: true` olmali.

### C. Domain al ve DNS bagla (Cloudflare)
1. Cloudflare'dan domain satin al (veya var olani Cloudflare DNS'e getir).
2. Render servisinde `Settings -> Custom Domains` bolumune:
   - `api.senin-domainin.com` ekle.
3. Render sana bir hedef hostname verir (CNAME target).
4. Cloudflare DNS'te kayit olustur:
   - Type: `CNAME`
   - Name: `api`
   - Target: Render'in verdigi hedef
   - Proxy status: ilk kurulumda `DNS only` onerilir.
5. Cloudflare'da `AAAA` kayitlari varsa sil (Render IPv4 kullaniyor).
6. Cloudflare `SSL/TLS -> Overview` ekraninda mode'u `Full` yap.
7. SSL aktif olana kadar bekle (genelde dakikalar, bazen daha uzun).

### D. Render env degerlerini tamamla
Render servis env ayarlari:
- `PUBLIC_BASE_URL=https://api.senin-domainin.com`
- `IPTV_DATA_DIR=/var/data`
- `IPTV_REFRESH_MINUTES=30`
- `STREAM_FETCH_TIMEOUT_MS=15000`
- `IPTV_FETCH_TIMEOUT_MS=15000`
- `ENABLE_WEB_FALLBACK=0`

Kaydet ve redeploy et.

Not:
- Render persistent disk ozelligi ucretli plan gerektirebilir.
- Disk yoksa `iptv-cache.json` ve `iptv-health.json` restart/deploy sonrasi sifirlanabilir.

### E. Canli endpoint kontrolu
1. `https://api.senin-domainin.com/health`
2. `https://api.senin-domainin.com/api/live-channels`
3. Ikisi de calisiyorsa backend hazir.

## 3) Uygulamaya domaini sabitle

Bu adimi yerelde terminalden yap:

```bash
npm run api:set -- https://api.senin-domainin.com
```

Sonra native APK build:

```bash
npm run native:build:local
```

Cikti:
- `cinematic-native-debug.apk`

Bu APK artik varsayilan olarak senin domainini kullanir.
Kullanicinin IP girmesine gerek kalmaz.

## 4) Yayin oncesi kontrol listesi

1. Telefonda temiz kurulum yap (eski app verisini silmek iyi olur).
2. Film acma testi.
3. Live TV liste ve oynatma testi.
4. `Profile` ekraninda API degerinin dogru oldugunu kontrol et.
5. `https` kilidi ve sertifika gecerliligini kontrol et.

## 5) Sik hatalar ve cozum

- Problem: `health` acilmiyor.
  - Cozum: Render deploy loglarini kontrol et, env degerlerini dogrula.

- Problem: Domain aciliyor ama SSL yok.
  - Cozum: DNS kaydi ve custom domain dogrulamasini tekrar kontrol et.

- Problem: Kullanici hala IP girmek zorunda kaliyor.
  - Cozum: `api:set` + yeni APK build + yeni APK kurulum.

- Problem: Stream extraction calismiyor.
  - Cozum: Render loglarinda Chrome/Puppeteer hatalarini kontrol et, gerekirse `CHROME_PATH` dogrula.
