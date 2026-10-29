# Pistas

App Android para grabar sonidos con el micrófono en 13 pistas, escucharlas juntas y descargar la mezcla.

## Cómo usarla
- **Toca un «sonido»** vacío: empieza a grabar esa pista (se oyen las demás mientras grabas). **Tócalo otra vez** para detener.
- La primera grabación define el largo del audio (el bucle); las siguientes se ajustan a ese largo.
- **Toca una pista ya grabada**: la silencia o la activa.
- **▶ (arriba)**: reproduce todas las pistas en bucle, sincronizadas. La «pista de audio» muestra la forma de onda de la mezcla y un cabezal que avanza.
- **volver a realizar**: borra la última pista grabada (si estás grabando, descarta esa grabación).
- **descargar (rojo)**: mezcla las pistas activas y guarda un archivo `.wav` en el móvil (Documentos/Pistas; si el sistema no lo permite, abre «Guardar en…»).

## Generar el APK (sin instalar nada en tu PC)
1. Crea un repositorio en GitHub y sube todo el contenido de esta carpeta (incluida `.github`).
2. Ve a la pestaña **Actions** → **Compilar APK** → espera unos minutos.
3. Abre la ejecución terminada y descarga el artefacto **pistas-apk** (contiene `app-debug.apk`).
4. Pasa el APK al móvil e instálalo (permite «instalar apps de origen desconocido»).

## Generar el APK en tu PC
Requiere Node 20, Java 17 y Android Studio (SDK):
```
npm install
npx cap add android
# añade en android/app/src/main/AndroidManifest.xml:
#   <uses-permission android:name="android.permission.RECORD_AUDIO" />
#   <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
#   <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28" />
npx cap sync android
cd android && ./gradlew assembleDebug
```
El APK queda en `android/app/build/outputs/apk/debug/app-debug.apk`.

## Probar ya mismo
Abre `www/index.html` servido por HTTPS (o `localhost`) en Chrome; el micrófono requiere un contexto seguro.
