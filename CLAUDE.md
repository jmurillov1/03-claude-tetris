# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es

Tetris clásico en JavaScript vanilla (HTML5 Canvas + CSS), sin dependencias, sin `package.json`, sin build. Todo el proyecto son 3 archivos: `index.html`, `style.css`, `game.js`.

## Comandos

No hay build, lint ni tests configurados. Para ejecutar el juego, servir el directorio como estático y abrir `index.html`:

```bash
python3 -m http.server 8000    # o: npx serve .
```

No hay suite de pruebas automatizadas; verificar cambios abriendo el juego en el navegador y probando manualmente el flujo (mover/rotar/soft drop/hard drop/pausa/game over/limpieza de líneas/subida de nivel).

## Arquitectura

Todo el estado y la lógica viven en `game.js` (variables globales `board`, `current`, `next`, `score`, `lines`, `level`, etc.). No hay módulos ni clases; es un único script cargado directamente por `index.html`.

- **Tablero**: matriz `ROWS × COLS` (20×10) donde cada celda es `0` (vacía) o un índice 1–7 que indica el color/tipo de pieza fijada.
- **Piezas**: definidas en `PIECES` como matrices cuadradas. La rotación (`rotateCW`) se calcula por transposición + reverso de filas, sin tablas de rotación por pieza (SRS).
- **Colisiones y wall kicks**: `collide(shape, ox, oy)` comprueba límites del tablero y solapes con bloques fijados; `tryRotate()` intenta la rotación y, si colisiona, desplaza la pieza ±1/±2 columnas antes de descartar el giro.
- **Bucle de juego**: `loop(ts)` vía `requestAnimationFrame` acumula tiempo (`dropAccum`) y baja la pieza una fila al superar `dropInterval`; si no puede bajar, llama a `lockPiece()`.
- **Fijado y limpieza de líneas**: `lockPiece()` → `merge()` fija la pieza en `board`; `clearLines()` recorre de abajo hacia arriba, elimina filas completas e inserta filas vacías arriba.
- **Puntuación/nivel**: `LINE_SCORES = [0,100,300,500,800]` multiplicado por `level`; hard drop = 2 pts/celda, soft drop = 1 pt/fila. El nivel sube cada 10 líneas y `dropInterval = max(100, 1000 - (level-1)*90)` ms.
- **Ghost piece**: `ghostY()` proyecta hacia abajo la posición final de la pieza actual; se dibuja con `globalAlpha = 0.2` en `draw()`.
- **Game over**: si la pieza recién generada colisiona en `spawn()`, se dispara `endGame()` y se muestra el overlay.

Flujo de arranque: `init()` → `createBoard()` → genera `next` → `spawn()` (mueve `next` a `current` y genera nueva `next`) → arranca `requestAnimationFrame(loop)`. Los controles de teclado (flechas, `X`, `Espacio`, `P`) están cableados en `game.js` y disparan movimiento/rotación/soft drop/hard drop/pausa.

## Parámetros ajustables (en `game.js`)

`COLS`, `ROWS`, `BLOCK`, `COLORS`, `LINE_SCORES`, `dropInterval`. Si se cambia `COLS`/`ROWS`/`BLOCK`, hay que ajustar también `width`/`height` del `<canvas id="board">` en `index.html` (`COLS × BLOCK` por `ROWS × BLOCK`).
