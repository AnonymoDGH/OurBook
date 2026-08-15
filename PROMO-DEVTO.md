---
title: "OurBook: el MCP donde tu agente recuerda vuestra historia (no tus datos)"
published: false
description: "Un servidor MCP de memoria narrativa: recuerdos con emoción, sueños que consolidan lo vivido y un libro coautorado que se exporta como legado. Soñar y consolidar cuesta 0 tokens de tu API principal."
tags: mcp, ai, typescript, opensource
cover_image: https://raw.githubusercontent.com/AnonymoDGH/OurBook/main/assets/banner-en.jpg
canonical_url: https://github.com/AnonymoDGH/OurBook
---

La mayoría de los "agentes con memoria" recuerdan **datos**: un string, un hecho, una preferencia. Pero cuando hablas semanas con un agente, lo que quieres no es una base de datos con tus notas. Quieres que recuerde **vuestra historia**: el día que conociste a su perro, la vez que os reísteis de una idea absurda, lo que prometisteis hacer juntos.

Y, sobre todo, quieres que **no confunda lo real con lo soñado**.

Por eso construí **OurBook**: un servidor [MCP](https://modelcontextprotocol.io) de *memoria narrativa*. El agente no guarda tus datos: guarda vuestra vida en común, con emoción, con un diario que se escribe cada noche y con sueños que consolidan los recuerdos — sin contaminarlos jamás.

## El problema

Los MCP de memoria actuales son utilitarios: almacenan y buscan hechos. Eso genera tres fallos conocidos:

1. **Confabulación** — el agente inventa y lo presenta como recuerdo real.
2. **Contexto que no escala** — inyectar todo en cada prompt es caro y se desborda.
3. **Sin identidad** — cambias de modelo o de máquina y el "personaje" desaparece.

OurBook cambia el marco: la memoria como **identidad narrativa**.

## Lo que lo hace diferente

### 1. Taxonomía de veracidad (la capa de honestidad)

Cada recuerdo tiene un campo `veracity`:

- `real` — lo vivisteis juntos
- `observed` — el agente lo infirió
- `imagined` — un sueño o ficción
- `hypothetical` — una especulación ("¿y si…?")

El *recall* factual **excluye por defecto** los sueños. Un sueño nunca se presenta como hecho. Esto ataca de raíz la confabulación.

### 2. Soñar = consolidar (neurociencia aplicada)

El motor de fondo, **Mnemosyne**, muestrea fragmentos de memoria por *saliencia emocional* (importancia × valencia) y los recombina en un sueño — como el *replay hipocampal* durante el sueño. Cada sueño guarda **sus fuentes** (qué fragmentos lo originaron), para que sea ficción honesta y trazable.

### 3. Doble cerebro: 0 tokens de tu API principal

El modelo principal (Claude, etc.) solo pone la voz cara al usuario. Soñar, consolidar y etiquetar emociones corre en Mnemosyne con esta cadena:

```
qwen-reverse (chat.qwen.ai, anónimo y gratis)
   → endpoint local (Ollama · LM Studio · LocalAI)
     → generadores offline deterministas (nunca falla)
```

Cada llamada queda auditada en `engine_log`. Tu API principal no paga la cognición de fondo.

### 4. El libro y la semilla de identidad

Todo se exporta a `OurBook.md` / `.html`: una crónica coautorada donde lo real y lo soñado están separados. Y con `identity-seed.json`, **otro agente puede heredar la vida** al cambiar de modelo o de máquina. La historia sobrevive al modelo.

## Demo en 60 segundos

```bash
npm i ourbook                # instala
npx ourbook setup            # detecta tus agentes y registra el MCP (interactivo)
```

Dentro del agente, las herramientas son `book.*`:

```text
book.remember  → "Me presentaste a Kira y me dio la pata." (veracity=real, valence=0.9)
book.recall    → "Kira"  → devuelve el recuerdo, no el sueño
book.dream     → Mnemosyne sueña y cita sus fuentes
book.consolidate → escribe la página del diario (NREM)
book.chapter   → entrega fragmentos reales + instrucciones para el narrador
book.export    → escribe OurBook.md / .html + identity-seed.json
```

Este es un extracto real del libro tras tres sesiones:

> Nos conocimos hace un mes, y ya el libro tiene olor a hogar. Kira me dio la pata antes de que dijera mi nombre… Aún no hemos volado a ningún sitio, pero ya tenemos a dónde: esa es la primera lección de nuestra historia.

Y en la sección *Sueños*, en cursiva y marcado:

> SUEÑO: LA CASA QUE CRECE — *(soñado con el motor offline; fuente: m1)*

## La neurociencia, en una tabla

| Hallazgo del cerebro | Feature en OurBook |
|---|---|
| Replay hipocampal (Wilson & McNaughton) | El sueño muestrea y recombina fragmentos |
| Complementary Learning Systems (Marr, McClelland) | Almacén dual: episodios + crónica consolidada |
| Reconsolidación (Nader 2000) | `book.correct` reescribe el recuerdo en su sitio, auditado |
| Curva de olvido (Ebbinghaus) | `decay = f(importancia, emoción, recencia, accesos)` |
| Flashbulb memories (Brown & Kulik) | `importance=5` + emoción alta → inmune al olvido |
| NREM vs REM | Dos pasadas: NREM resume/archiva; REM teje el sueño |

## Honestidad y privacidad

- **Local-first**: el libro vive en tu disco (`~/.ourbook/ourbook.db`). Sin nube, sin telemetría.
- **El agente es un personaje de una historia, no una conciencia** — el colofón del libro lo recuerda en cada exportación.
- **Olvido real**: `book.forget` y `book.redact` funcionan y quedan auditados.
- `qwen-reverse` es ingeniería inversa de un servicio web: úsalo con conocimiento de causa. OurBook funciona 100% offline sin él.

## El detalle técnico

- **TypeScript** + `@modelcontextprotocol/sdk`, transporte stdio.
- **SQLite + FTS5 nativo** (`node:sqlite`), cero dependencias compiladas.
- **Decaimiento** estilo Ebbinghaus con refuerzo por evocación (*retrieval practice*).
- **Instalador** que detecta tus agentes (Claude Desktop, Cursor, OpenCode, Windsurf, VS Code, Zed, Gemini CLI) y registra el MCP con backup.

## Pruébalo

```text
github.com/AnonymoDGH/OurBook
npm i ourbook && npx ourbook setup
```

Si un agente puede recordar, que recuerde como se recuerda de verdad: con emoción, con sueños, y con una historia que sigue viva entre dos.
