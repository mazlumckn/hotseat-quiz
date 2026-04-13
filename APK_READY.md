# APK Ready Kurulum Rehberi

Bu repoda iki APK yolu vardir:
- `android` -> web tabanli shell (Capacitor)
- `android-native` -> gercek native Android uygulama (onerilen)

## Native (Onerilen)

Tek komut:

```bash
npm run native:build:local
```

Bu komut:
- `android-native/local.properties` icine SDK yolunu yazar
- yerel JDK/SDK ile native debug APK derler
- ciktiyi proje kokune kopyalar

## Herkesin IP girmemesi icin (onerilen)

`config.js` icindeki `apiBase` alanina tek bir public domain yaz:

```js
window.CINEMATIC_CONFIG = {
  apiBase: 'https://api.senin-domainin.com'
};
```

Sonra tekrar:

```bash
npm run native:build:local
```

Bu durumda APK icine bu API sabitlenir ve kullanicilar tek tek IP girmez.

Alternatif hizli komut:

```bash
npm run api:set -- https://api.senin-domainin.com
```

Detayli domain + deploy akisi:
- `PRODUCTION_DOMAIN_SETUP.md`

Native APK ciktilari:

```text
android-native/app/build/outputs/apk/debug/app-debug.apk
cinematic-native-debug.apk
```

## Web Shell (Opsiyonel)

```bash
npm run apk:build:local
```

Web shell APK ciktilari:

```text
android/app/build/outputs/apk/debug/app-debug.apk
cinematic-debug.apk
```

## Not

- Testte `http://` backend kullanilabilir.
- Uretimde mutlaka `https://` backend kullan.
