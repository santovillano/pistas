# Decorte · optimizador de cortes (Android)

App para calcular cómo cortar planchas con el menor desperdicio.

- Proyectos que se guardan en el teléfono y se pueden borrar
- Unidades cm, mm o m (al cambiar, las medidas se convierten)
- Plancha y piezas en ancho × alto, con cantidad, grosor del corte (kerf), margen de refilado y giro de 90° opcional
- Cortes de lado a lado (tipo guillotina), como en una escuadradora
- Plano por plancha con aprovechamiento y desperdicio
- Imprimir desde el móvil a la impresora, o «Guardar como PDF» (diálogo de impresión de Android)

## Obtener el APK

1. Crea un repositorio nuevo en GitHub (por ejemplo `cortes`).
2. Sube **todo el contenido de esta carpeta** (incluida la carpeta oculta `.github`).
3. Entra a la pestaña **Actions**. El flujo **Compilar APK** arranca solo con cada subida (o pulsa *Run workflow*).
4. Cuando termine (unos 3–5 minutos), abre la ejecución y descarga el artefacto **kerf-apk**. Descomprímelo: dentro está `app-debug.apk`.
5. Pásalo al teléfono e instálalo (Android pedirá permitir instalar apps de esta fuente).

## Probar sin instalar

Abre `app/src/main/assets/index.html` en un navegador: funciona igual y los proyectos se guardan en ese navegador.

## Pruebas del optimizador

```
node tests/packer.test.js
```

## Estructura

- `app/src/main/assets/` interfaz (HTML, CSS, JS) y el optimizador `packer.js`
- `app/src/main/java/app/kerf/cortes/MainActivity.java` contenedor Android y puente de impresión
- `.github/workflows/build.yml` compilación del APK
