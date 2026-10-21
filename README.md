# Bajo el Casco — app de autoentrevistas (look «Transmisión»)

Webapp para celular: el piloto toca **Recibir una pregunta**, aparece una de las 25 preguntas y la cámara frontal empieza a grabar. El video se guarda con la pregunta y la gráfica sobreimpresas (1080×1920), y opcionalmente una versión limpia sin gráfica para edición.

## Publicar en GitHub Pages
1. Crear un repo (por ejemplo `bajo-el-casco`) y subir todos los archivos de esta carpeta a la raíz.
2. Settings → Pages → Deploy from a branch → `main` / root.
3. Abrir `https://<usuario>.github.io/bajo-el-casco/` en el celular. La cámara solo funciona por https.
4. Opcional: "Agregar a pantalla de inicio" para usarla como app a pantalla completa. Después de la primera carga funciona sin señal.

## Uso
1. **Bienvenida**: branding, concepto y cómo funciona. Botón **Comenzar**.
2. Al tocar Comenzar se enciende la cámara frontal y empieza a grabar. La pregunta y el tiempo quedan siempre en pantalla y se graban en el video.
3. **Preguntar de nuevo**: cambia la pregunta sin cortar la grabación (todo queda en un solo video).
4. **Terminar**: corta y guarda la participación en el dispositivo (sección **Mis videos**).
5. **A la galería**: abre el menú de compartir (en iPhone, "Guardar video") o descarga el archivo. También la **versión limpia** sin gráfica.

## Ajustes
Versión limpia, calidad (1080 o 720), duración máxima y reinicio del mazo de preguntas.

## Notas
- El video no está espejado, para que los sponsors del buzo se lean bien.
- Para cambiar preguntas, editar la lista `CATS` al inicio de `app.js`.
- Si se modifica algún archivo, subir el número de versión en `sw.js` (por ejemplo `bec-v3` → `bec-v4`) para que los celulares tomen la actualización.
- Los videos guardados en "Mis videos" quedan en el almacenamiento del navegador de ese celular. Conviene pasarlos a la galería después de cada sesión: si se borran los datos del sitio, se pierden.
