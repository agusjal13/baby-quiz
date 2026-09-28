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

## Monedas y tienda

- Completar un nivel por primera vez da **1 moneda** (moneda gigante al final de la fiesta, que cae en
  una fila de 5 lugares). Repetir un nivel ya pasado no da otra.
- En la tienda (🛍️ en el mapa de mundos) cada personaje tiene su ropa, a **5 monedas** cada cosa
  (un mundo completo = una prenda). El precio está en `PRICE` de `js/wardrobe.js`.
  Tocar algo comprado lo pone o lo saca. Hay un lugar por prenda: cabeza, cuello, mano, cuerpo y espalda.
- Desde ⚙️ se pueden regalar monedas.
- Para agregar ropa: sumar una línea al personaje en `CATALOG` de `js/wardrobe.js`
  (con `emoji`, `art`, `bow`, `cape` o `jersey`, y opcionalmente `use`: la acción al tocarlo).
- Los personajes se dibujan en `js/puppet.js` (`LOOKS`); ahí también está dónde va cada prenda
  (`anchors`) y el gesto propio de cada uno (`idle`).

## Bingo familiar (online)

- Botón 🎱 en el mapa de mundos. Uno crea la partida (código de 4 letras + link para compartir)
  y los demás se unen. Cartón 4x4 con números del 1 al 40: línea (fila, columna o diagonal) y bingo.
- Usa **Supabase Realtime** (canales con broadcast y presence, sin tablas). La configuración está en
  `js/online-config.js` (URL del proyecto y clave pública `anon`, que es segura para publicar).
- El dispositivo que crea la partida es el anfitrión: saca los números y decide los ganadores.
  Tiene que quedar abierto mientras se juega (si se recarga, retoma la partida).
- Plan gratis de Supabase: el proyecto se **pausa tras 7 días sin uso**. Si el bingo no conecta,
  entrar a supabase.com → proyecto `baby-quiz` → **Restore project**.

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
