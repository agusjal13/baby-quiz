# Baby Quiz

Juego de preguntas para chicos de 3 a 5 años. Una voz hace la pregunta, el chico toca la respuesta
y su personaje avanza por el camino. 3 aciertos completan el nivel.

## Probar en la PC

```bash
node servidor.js
```

Abrir http://localhost:8080 en Chrome o Edge.

## Cómo se juega

- Cada nivel tiene 3 preguntas con 4 opciones.
- Error 1: se apaga la opción tocada y se repite la pregunta.
- Error 2: se muestra la correcta y se cambia de pregunta (sin avanzar).
- Los niveles se desbloquean en orden; los mundos están todos abiertos.
- **Opciones para adultos:** mantener apretado el engranaje ⚙️ 2 segundos
  (voz, velocidad, efectos, desbloquear todo, reiniciar).

## Estructura

```
index.html            carga los scripts
css/styles.css        estilos
js/util.js            utilidades y paleta de colores
js/storage.js         progreso guardado en el dispositivo
js/audio.js           voz del sistema y efectos de sonido
js/characters.js      personajes elegibles
js/render.js          dibujo de opciones (emoji, color, texto, grupo, forma)
js/worlds/registry.js registro de mundos y armado de preguntas
js/worlds/*.js        un archivo por mundo
js/game.js            pantallas y lógica del juego
sw.js                 funcionamiento sin internet
```

## Agregar un mundo

1. Copiar un archivo de `js/worlds/` (por ejemplo `colores.js`) con otro nombre.
2. Cambiar `id`, `order`, `name`, `sayName`, `icon`, `theme`, `vehicle` y `goal`.
3. Escribir sus `questionTypes`: cada uno tiene `make(level)` que devuelve `BQ.question({...})`.
   Usar `minLevel` para que un tipo de pregunta aparezca recién en niveles altos.
4. Sumar el `<script>` en `index.html` y la ruta en la lista `ASSETS` de `sw.js`.

### Mundos de dibujar (unir puntos)

Un generador puede devolver `{ kind: 'connect', key, say, pairs: [colores] }` en lugar de
`BQ.question(...)`: el juego muestra un tablero para unir con el dedo cada par de puntos del
mismo color (ver `js/worlds/unir.js` y `js/connect.js`). Cada tablero completo avanza una parada.

## Agregar más niveles o preguntas

- Más niveles en un mundo: `levels: 8` en su definición.
- Más preguntas por nivel: `questionsPerLevel: 5` (por defecto son 3).
- Más variedad: sumar elementos a las listas del mundo (`THINGS`, `ANIMALS`, `WORDS`...)
  o un nuevo tipo en `questionTypes`.

Después de cambiar archivos, subir la versión `CACHE` en `sw.js` para que las tablets se actualicen.

## Publicación

El juego está publicado con GitHub Pages en **https://agusjal13.github.io/baby-quiz/**.
Cada `git push` a `main` lo actualiza en uno o dos minutos (acordarse de subir `CACHE` en `sw.js`).

## Instalar en tablet o celular (sin internet)

Abrir el link en Chrome del dispositivo, menú ⋮ → **Instalar app**. Desde ahí funciona sin conexión.
La voz usa el motor de texto a voz del dispositivo: en Android conviene tener descargada
la voz en español (Ajustes → Texto a voz).
