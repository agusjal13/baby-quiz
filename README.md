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
- **Opciones para adultos:** mantener apretado el engranaje ⚙️ 1 segundo, o tocarlo 3 veces seguidas
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
  una fila de 5 lugares). Repetir un nivel no da otra mientras falten niveles en ese mundo; en un mundo
  **completo**, cada nivel jugado vuelve a dar una moneda. Ganar un partido de penales también da una.
- En la tienda (🛍️ en el mapa de mundos) cada personaje tiene su ropa, a **5 monedas** cada cosa
  (un mundo completo = una prenda). El precio está en `PRICE` de `js/wardrobe.js`;
  una cosa puede tener su propio precio con `price` (la pelota común del futbolista es gratis: `price: 0`).
  Tocar algo comprado lo pone o lo saca. Hay un lugar por prenda: cabeza, cuello, mano, cuerpo y espalda.
- Desde ⚙️ se pueden regalar monedas.
- Para agregar ropa: sumar una línea al personaje en `CATALOG` de `js/wardrobe.js`
  (con `emoji`, `art`, `bow`, `cape` o `jersey`, y opcionalmente `use`: la acción al tocarlo).
- Los personajes se dibujan en `js/puppet.js` (`LOOKS`); ahí también está dónde va cada prenda
  (`anchors`) y el gesto propio de cada uno (`idle`).

## Penales

- Botón ⚽ Penales en el mapa de mundos. 3 penales con preguntas al azar de todos los mundos
  (menos los de dibujar), con nivel según lo que ya jugó en cada mundo.
- Respuesta correcta = gol (el arquero se tira al otro lado); incorrecta = ataja y se muestra la correcta.
- Con 2 goles o más se gana el partido y **1 moneda** (siempre, cada partido ganado). Código en `js/penales.js`.

## Partidito

- Botón ⚽ Partidito en el mapa. Cancha 4 vs 4: tu equipo (tu personaje con su ropa) contra otro
  personaje al azar. Juegan solos y cada tanto se arma una jugada de gol con una pregunta:
  ataque propio (bien = gol, mal = ataja el rival) o ataque rival (bien = ataja tu arquero, mal = gol de ellos).
- Gana el primero en llegar a 3 goles (alrededor de un minuto). Código en `js/partido.js`;
  lo que comparte con los penales (preguntas, panel y pantalla final) está en `js/sport.js`.

## Pool

- Botón 🎱 Pool en el mapa. Partida con física (las bolas ruedan, chocan, rebotan y se frenan) que se
  juega sola: arranca con un saque y después tiros sin límite, cada uno con una pregunta
  (bien = la bola elegida entra; mal = pega en la banda y no entra ninguna, no pasa nada).
  Gana si mete 4 de 6 antes de que se termine el tiempo (1:30). Código en `js/pool.js`.

## Bowling

- Botón 🎳 Bowling en el mapa. Vista en 3D desde atrás de la bola (canvas con perspectiva; la cámara
  acompaña la bola hasta los pinos). Se juega arrastrando el dedo hacia arriba sobre la bola (sin preguntas);
  cuanto más rápido, más fuerte. 3 cuadros de hasta 2 tiros, con strike y spare.
  Gana si voltea 15 pinos o más (de 30). Código en `js/bowling.js`.

## Piedra, papel o tijera

- Botón ✊✋✌️ en el mapa. Al mejor de 3 (gana el primero que llega a 2; los empates se repiten).
  El chico elige abajo y un personaje rival elige al azar arriba. Código en `js/ppt.js`.

## Tiros libres

- Botón ⚽💨 Tiros libres en el mapa. 5 tiros con barrera y arquero (personaje rival); se patea arrastrando
  el dedo hacia el arco: la dirección del arrastre es adonde va, la velocidad es la potencia (flojito pega en
  la barrera, rapidísimo se va por arriba) y si el arrastre es curvo la pelota dobla (comba).
  Gana con 3 goles; los 5 es resultado perfecto. Código en `js/libres.js`.

## Tiro al blanco

- Botón 🎯 Tiro al blanco en el mapa. Durante 20 segundos aparecen blancos en lugares al azar que se van
  solos al rato: rojo +1, azul +2 y multicolor +5 (sale poco, gira y dura menos; al menos uno por partido).
  Cada tanto aparece una bomba 💣: tocarla resta 1 (nunca baja de 0).
  Gana con 6 puntos o más. Código en `js/tiro.js` (tiempo, puntos para ganar y frecuencia de bombas arriba de todo).

## Trofeos

- Cada partido ganado (penales, tiros libres, partidito, pool, bowling, piedra papel o tijera o tiro al blanco) da **1 moneda** y suma para los **40 trofeos**
  (de la medalla de bronce con 1 partido a la súper copa legendaria con 200). Se ven en 🏆 Trofeos:
  un mapa con un caminito (un casillero por partido) y el personaje parado donde va, en páginas de 20
  trofeos (`PAGE` en `js/trophies.js`; si se agregan trofeos a la lista, aparecen páginas nuevas solas).
- **Resultado perfecto** (penales 3-0, tiros libres 5 de 5, partidito 3-0, pool con las 6 bolas, bowling 30 pinos,
  piedra papel o tijera 2-0 y tiro al blanco con más de 15 puntos): vale doble, **2 monedas** y cuenta como 2 partidos.
- Al ganar, se abre el mapa de trofeos: el personaje avanza un casillero por partido ganado
  (dos si fue perfecto) y, si llega al trofeo, lo gana. El escenario depende del personaje
  (cancha, laboratorio, castillo, volcán...): lista `PATHS` en `js/sport.js`. Está en `js/sport.js` (`result`, `trophyPath`).
- La lista y los dibujos están en `js/trophies.js` (`TROPHIES`: partidos necesarios, forma, metal y adornos).

## Bingo familiar (online)

- Botón 🎟️ Bingo en el mapa de mundos. Uno crea la partida (código de 4 letras + link para compartir)
  y los demás se unen. Cartón 4x4 con dibujos (los 11 personajes y 19 cosas conocidas, lista `PICS` en
  `js/bingo.js`): línea (fila, columna o diagonal) y bingo. En automático sale uno cada 6 segundos,
  con cuenta regresiva en todas las pantallas.
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
