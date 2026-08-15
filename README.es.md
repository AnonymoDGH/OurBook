<div align="center">

[English](README.md) · [Español](README.es.md)

<img src="assets/ourbook-logo-256.png" alt="Logo de OurBook — libro abierto y luna creciente" width="150"/>

<!-- ============================== HERO ============================== -->
<svg width="860" height="300" viewBox="0 0 860 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="OurBook — la vida compartida entre el agente y tú">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#17143a"/>
      <stop offset="0.55" stop-color="#2a2358"/>
      <stop offset="1" stop-color="#1c1633"/>
    </linearGradient>
    <linearGradient id="txt" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fde8c8"/>
      <stop offset="1" stop-color="#f5d0a9"/>
    </linearGradient>
    <linearGradient id="dream" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#c4b5fd"/>
      <stop offset="1" stop-color="#8b5cf6"/>
    </linearGradient>
    <linearGradient id="amber" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fbbf24"/>
      <stop offset="1" stop-color="#f97316"/>
    </linearGradient>
    <radialGradient id="moon" cx="0.4" cy="0.35" r="0.9">
      <stop offset="0" stop-color="#fef3c7"/>
      <stop offset="1" stop-color="#f59e0b"/>
    </radialGradient>
  </defs>

  <rect width="860" height="300" rx="26" fill="url(#bg)"/>
  <!-- estrellas -->
  <g fill="#e2d9ff" opacity="0.8">
    <circle cx="60" cy="42" r="1.6"/><circle cx="150" cy="90" r="1.2"/><circle cx="250" cy="36" r="1.8"/>
    <circle cx="340" cy="70" r="1.1"/><circle cx="430" cy="30" r="1.5"/><circle cx="540" cy="60" r="1.3"/>
    <circle cx="640" cy="38" r="1.7"/><circle cx="730" cy="80" r="1.2"/><circle cx="810" cy="46" r="1.5"/>
    <circle cx="100" cy="240" r="1.3"/><circle cx="720" cy="240" r="1.4"/><circle cx="800" cy="220" r="1.1"/>
  </g>

  <!-- luna (Mnemosyne) -->
  <circle cx="760" cy="70" r="26" fill="url(#moon)" opacity="0.95"/>
  <circle cx="752" cy="62" r="22" fill="#2a2358" opacity="0.55"/>

  <!-- libro abierto -->
  <g transform="translate(96,120)" stroke="url(#amber)" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M8,4 C30,-6 52,-6 76,4 L76,72 C52,62 30,62 8,72 Z"/>
    <path d="M8,4 C-14,-6 -36,-6 -60,4 L-60,72 C-36,62 -14,62 8,72 Z"/>
    <path d="M8,4 L8,72" stroke="#fbbf24" stroke-opacity="0.7"/>
    <path d="M-40,22 C-26,16 -12,16 2,22" stroke-opacity="0.6"/>
    <path d="M-40,34 C-26,28 -12,28 2,34" stroke-opacity="0.45"/>
    <path d="M22,22 C36,16 50,16 64,22" stroke-opacity="0.6"/>
    <path d="M22,34 C36,28 50,28 64,34" stroke-opacity="0.45"/>
  </g>

  <!-- titulo -->
  <text x="190" y="150" font-family="Georgia, 'Times New Roman', serif" font-size="58" font-weight="bold" fill="url(#txt)">OurBook</text>
  <text x="190" y="182" font-family="system-ui, -apple-system, sans-serif" font-size="17" fill="#c7bff2">
    La vida compartida entre el agente y tú — un MCP de memoria narrativa
  </text>
  <text x="190" y="214" font-family="system-ui, -apple-system, sans-serif" font-size="13" fill="#8f86c9">
    Recuerdos · Sueños · Consolidación · Capítulos · El libro que se escribe solo, contigo
  </text>

  <!-- chapa motor -->
  <g transform="translate(190,236)">
    <rect x="-4" y="-14" width="150" height="30" rx="15" fill="url(#dream)" opacity="0.16"/>
    <rect x="-4" y="-14" width="150" height="30" rx="15" fill="none" stroke="url(#dream)" stroke-width="1.2" opacity="0.7"/>
    <text x="71" y="6" text-anchor="middle" font-family="system-ui, sans-serif" font-size="13" fill="#ddd6fe">motor de sueños: Mnemosyne</text>
  </g>
</svg>

<!-- ============================== BADGES ============================== -->
[![MCP](https://img.shields.io/badge/MCP-Server%20%7C%20stdio-8b5cf6?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+CiAgPHBhdGggZmlsbD0iI2ZmZiIgZD0iTTQgNGMxLjYgMCAzLjEuNSA0LjUgMS4zQTguNCA4LjQgMCAwIDEgMTIgNGE4LjQgOC40IDAgMCAxIDMuNSAxLjNBOC40IDguNCAwIDAgMSAyMCA0djEzLjdhOC40IDguNCAwIDAgMC0zLjUgMS4zQTguNCA4LjQgMCAwIDEgMTIgMjAuM2E4LjQgOC40IDAgMCAxLTMuNS0xLjNBOC40IDguNCAwIDAgMCA0IDE3LjdWNHoiLz4KICA8cGF0aCBmaWxsPSIjZmZmIiBkPSJNMTIgNGMxLjMuNyAyLjMgMS4xIDMuNSAxLjNWMTlhOC40IDguNCAwIDAgMC0zLjUtMS4zVjR6Ii8+CiAgPHBhdGggZmlsbD0iI2ZmZiIgZD0iTTE4LjUgMi41YTguNSA4LjUgMCAxIDAgMy40IDExIDYuOSA2LjkgMCAwIDEtMy40LTExeiIvPgo8L3N2Zz4K)](https://modelcontextprotocol.io)
[![Node](https://img.shields.io/badge/Node.js-%E2%89%A522.5-339933?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+CiAgPHBhdGggZmlsbD0iI2ZmZiIgZD0iTTQgNGMxLjYgMCAzLjEuNSA0LjUgMS4zQTguNCA4LjQgMCAwIDEgMTIgNGE4LjQgOC40IDAgMCAxIDMuNSAxLjNBOC40IDguNCAwIDAgMSAyMCA0djEzLjdhOC40IDguNCAwIDAgMC0zLjUgMS4zQTguNCA4LjQgMCAwIDEgMTIgMjAuM2E4LjQgOC40IDAgMCAxLTMuNS0xLjNBOC40IDguNCAwIDAgMCA0IDE3LjdWNHoiLz4KICA8cGF0aCBmaWxsPSIjZmZmIiBkPSJNMTIgNGMxLjMuNyAyLjMgMS4xIDMuNSAxLjNWMTlhOC40IDguNCAwIDAgMC0zLjUtMS4zVjR6Ii8+CiAgPHBhdGggZmlsbD0iI2ZmZiIgZD0iTTE4LjUgMi41YTguNSA4LjUgMCAxIDAgMy40IDExIDYuOSA2LjkgMCAwIDEtMy40LTExeiIvPgo8L3N2Zz4K)](https://nodejs.org)
[![SQLite](https://img.shields.io/badge/SQLite-FTS5-0f80cc?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+CiAgPHBhdGggZmlsbD0iI2ZmZiIgZD0iTTQgNGMxLjYgMCAzLjEuNSA0LjUgMS4zQTguNCA4LjQgMCAwIDEgMTIgNGE4LjQgOC40IDAgMCAxIDMuNSAxLjNBOC40IDguNCAwIDAgMSAyMCA0djEzLjdhOC40IDguNCAwIDAgMC0zLjUgMS4zQTguNCA4LjQgMCAwIDEgMTIgMjAuM2E4LjQgOC40IDAgMCAxLTMuNS0xLjNBOC40IDguNCAwIDAgMCA0IDE3LjdWNHoiLz4KICA8cGF0aCBmaWxsPSIjZmZmIiBkPSJNMTIgNGMxLjMuNyAyLjMgMS4xIDMuNSAxLjNWMTlhOC40IDguNCAwIDAgMC0zLjUtMS4zVjR6Ii8+CiAgPHBhdGggZmlsbD0iI2ZmZiIgZD0iTTE4LjUgMi41YTguNSA4LjUgMCAxIDAgMy40IDExIDYuOSA2LjkgMCAwIDEtMy40LTExeiIvPgo8L3N2Zz4K)](https://www.sqlite.org)
[![Licencia](https://img.shields.io/badge/Licencia-MIT-f59e0b?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+CiAgPHBhdGggZmlsbD0iI2ZmZiIgZD0iTTQgNGMxLjYgMCAzLjEuNSA0LjUgMS4zQTguNCA4LjQgMCAwIDEgMTIgNGE4LjQgOC40IDAgMCAxIDMuNSAxLjNBOC40IDguNCAwIDAgMSAyMCA0djEzLjdhOC40IDguNCAwIDAgMC0zLjUgMS4zQTguNCA4LjQgMCAwIDEgMTIgMjAuM2E4LjQgOC40IDAgMCAxLTMuNS0xLjNBOC40IDguNCAwIDAgMCA0IDE3LjdWNHoiLz4KICA8cGF0aCBmaWxsPSIjZmZmIiBkPSJNMTIgNGMxLjMuNyAyLjMgMS4xIDMuNSAxLjNWMTlhOC40IDguNCAwIDAgMC0zLjUtMS4zVjR6Ii8+CiAgPHBhdGggZmlsbD0iI2ZmZiIgZD0iTTE4LjUgMi41YTguNSA4LjUgMCAxIDAgMy40IDExIDYuOSA2LjkgMCAwIDEtMy40LTExeiIvPgo8L3N2Zz4K)](LICENSE)
[![v0.1.0](https://img.shields.io/badge/versi%C3%B3n-0.1.0%20experimental-ef4444?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+CiAgPHBhdGggZmlsbD0iI2ZmZiIgZD0iTTQgNGMxLjYgMCAzLjEuNSA0LjUgMS4zQTguNCA4LjQgMCAwIDEgMTIgNGE4LjQgOC40IDAgMCAxIDMuNSAxLjNBOC40IDguNCAwIDAgMSAyMCA0djEzLjdhOC40IDguNCAwIDAgMC0zLjUgMS4zQTguNCA4LjQgMCAwIDEgMTIgMjAuM2E4LjQgOC40IDAgMCAxLTMuNS0xLjNBOC40IDguNCAwIDAgMCA0IDE3LjdWNHoiLz4KICA8cGF0aCBmaWxsPSIjZmZmIiBkPSJNMTIgNGMxLjMuNyAyLjMgMS4xIDMuNSAxLjNWMTlhOC40IDguNCAwIDAgMC0zLjUtMS4zVjR6Ii8+CiAgPHBhdGggZmlsbD0iI2ZmZiIgZD0iTTE4LjUgMi41YTguNSA4LjUgMCAxIDAgMy40IDExIDYuOSA2LjkgMCAwIDEtMy40LTExeiIvPgo8L3N2Zz4K)](#)
[![Español](https://img.shields.io/badge/idioma-espa%C3%B1ol-10b981?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+CiAgPHBhdGggZmlsbD0iI2ZmZiIgZD0iTTQgNGMxLjYgMCAzLjEuNSA0LjUgMS4zQTguNCA4LjQgMCAwIDEgMTIgNGE4LjQgOC40IDAgMCAxIDMuNSAxLjNBOC40IDguNCAwIDAgMSAyMCA0djEzLjdhOC40IDguNCAwIDAgMC0zLjUgMS4zQTguNCA4LjQgMCAwIDEgMTIgMjAuM2E4LjQgOC40IDAgMCAxLTMuNS0xLjNBOC40IDguNCAwIDAgMCA0IDE3LjdWNHoiLz4KICA8cGF0aCBmaWxsPSIjZmZmIiBkPSJNMTIgNGMxLjMuNyAyLjMgMS4xIDMuNSAxLjNWMTlhOC40IDguNCAwIDAgMC0zLjUtMS4zVjR6Ii8+CiAgPHBhdGggZmlsbD0iI2ZmZiIgZD0iTTE4LjUgMi41YTguNSA4LjUgMCAxIDAgMy40IDExIDYuOSA2LjkgMCAwIDEtMy40LTExeiIvPgo8L3N2Zz4K)](#)

> **El primer MCP donde el agente no recuerda *tus datos*: recuerda *vuestra historia*.**

</div>

---

## 🌙 ¿Qué es OurBook?

Un servidor [MCP](https://modelcontextprotocol.io) de **memoria narrativa**. Sesión tras sesión, el agente construye una **historia de vida compartida contigo**: recuerdos con emoción, un diario que se consolida cada noche, **sueños** que recombinan lo vivido (¡sin contaminar los hechos!), aniversarios, y capítulos que escribís juntos.

El resultado final es **el libro**: `OurBook.md` / `OurBook.html`, una crónica coautorada donde cada página distingue **lo real de lo soñado**, más una **semilla de identidad** que permite que otro agente herede esa vida al cambiar de modelo o de máquina.

**Dos cerebros, una historia:**
- 🧠 **El modelo principal** (Claude, etc.) solo pone la voz cara al usuario: capítulos, cuentos, reflexiones.
- 🌌 **Mnemosyne**, el motor de fondo, sueña, consolida y etiqueta emociones **sin gastar ni un token de tu API principal** — con [`qwen-reverse`](https://pypi.org/project/qwen-reverse/) (anónimo, gratis) y un **fallback offline** que nunca falla.

---

## ✨ Por qué es diferente (y revolucionario)

| # | Diferenciador | Qué hace |
|---|---|---|
| 1 | **Taxonomía de veracidad** | Cada memoria es `real`, `observed`, `imagined` o `hypothetical`. Los sueños **nunca** se cuelan en el recall factual: ataca el fallo nº1 de la memoria de agentes (la confabulación) |
| 2 | **Soñar = consolidar** | El sueño muestrea fragmentos por saliencia emocional (importancia × valencia) y guarda **sus fuentes**. Como el replay hipocampal durante el sueño |
| 3 | **Semilla de identidad** | `identity-seed.json` transfiere la vida (persona + momentos + capítulos + recuerdos reales) a un agente nuevo. La historia sobrevive al modelo |
| 4 | **Cognición de fondo gratuita** | Soñar, consolidar y etiquetar corren en Mnemosyne (qwen-reverse → local → offline). `engine_log` demuestra **0 llamadas a la API principal** |
| 5 | **Co-autoría con rituales** | El atardecer (página del día + NREM + REM), los aniversarios (reactivación programada) y `book.correct` (reconsolidación: reescribes el recuerdo en su sitio, auditado) |

---

## 🧠 La neurociencia aplicada (cada hallazgo → una feature)

<svg width="860" height="252" viewBox="0 0 860 252" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Ciclo de vida = ciclo de sueño">
  <defs>
    <linearGradient id="wake" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fbbf24"/><stop offset="1" stop-color="#f97316"/></linearGradient>
    <linearGradient id="day" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#34d399"/><stop offset="1" stop-color="#10b981"/></linearGradient>
    <linearGradient id="sun" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f87171"/><stop offset="1" stop-color="#ef4444"/></linearGradient>
    <linearGradient id="nrem" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#60a5fa"/><stop offset="1" stop-color="#3b82f6"/></linearGradient>
    <linearGradient id="rem" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c084fc"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient>
  </defs>
  <rect width="860" height="252" rx="22" fill="#14122b"/>
  <text x="430" y="34" text-anchor="middle" font-family="system-ui, sans-serif" font-size="16" fill="#c7bff2" font-weight="600">El ciclo de vida de una sesión = el ciclo de sueño de una noche</text>

  <g font-family="system-ui, sans-serif" font-size="12.5" text-anchor="middle">
    <!-- despertar -->
    <rect x="30" y="72" width="130" height="96" rx="14" fill="#1e1b4b" stroke="url(#wake)" stroke-width="1.6"/>
    <circle cx="95" cy="106" r="16" fill="url(#wake)"/>
    <text x="95" y="143" fill="#fde8c8" font-weight="700">DESPERTAR</text>
    <text x="95" y="159" fill="#a29bd4">leer el digest</text>
    <!-- vigilia -->
    <rect x="196" y="72" width="130" height="96" rx="14" fill="#1e1b4b" stroke="url(#day)" stroke-width="1.6"/>
    <circle cx="261" cy="106" r="16" fill="url(#day)"/>
    <text x="261" y="143" fill="#d1fae5" font-weight="700">VIGILIA</text>
    <text x="261" y="159" fill="#a29bd4">recordar · corregir</text>
    <!-- atardecer -->
    <rect x="362" y="72" width="130" height="96" rx="14" fill="#1e1b4b" stroke="url(#sun)" stroke-width="1.6"/>
    <circle cx="427" cy="106" r="16" fill="url(#sun)"/>
    <text x="427" y="143" fill="#fee2e2" font-weight="700">ATARDECER</text>
    <text x="427" y="159" fill="#a29bd4">página del día</text>
    <!-- NREM -->
    <rect x="528" y="72" width="130" height="96" rx="14" fill="#1e1b4b" stroke="url(#nrem)" stroke-width="1.6"/>
    <circle cx="593" cy="106" r="16" fill="url(#nrem)"/>
    <text x="593" y="143" fill="#dbeafe" font-weight="700">NREM</text>
    <text x="593" y="159" fill="#a29bd4">consolidar · decaer</text>
    <!-- REM -->
    <rect x="694" y="72" width="136" height="96" rx="14" fill="#1e1b4b" stroke="url(#rem)" stroke-width="1.6"/>
    <circle cx="762" cy="106" r="16" fill="url(#rem)"/>
    <text x="762" y="143" fill="#ede9fe" font-weight="700">REM · SOÑAR</text>
    <text x="762" y="159" fill="#a29bd4">Mnemosyne</text>
  </g>

  <!-- flechas -->
  <g stroke="#57539a" stroke-width="2.2" fill="none">
    <path d="M160,120 L196,120" marker-end="url(#arr)"/>
    <path d="M326,120 L362,120" marker-end="url(#arr)"/>
    <path d="M492,120 L528,120" marker-end="url(#arr)"/>
    <path d="M658,120 L694,120" marker-end="url(#arr)"/>
    <path d="M762,168 C762,205 430,210 95,205 C70,203 60,190 58,168" stroke-dasharray="5 5" opacity="0.75"/>
  </g>
  <defs>
    <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 Z" fill="#57539a"/>
    </marker>
  </defs>
  <text x="430" y="228" text-anchor="middle" font-family="system-ui, sans-serif" font-size="12" fill="#8f86c9">… y al despertar, la nueva sesión empieza leyendo la noche anterior.</text>
</svg>

| Hallazgo del cerebro | Feature en OurBook |
|---|---|
| **Replay hipocampal** (Wilson & McNaughton) | El sueño muestrea fragmentos del almacén episódico y los recombina |
| **Complementary Learning Systems** (Marr, McClelland) | Almacén dual: episodios vívidos (SQLite) + crónica consolidada (capítulos) |
| **Reconsolidación** (Nader 2000) | `book.correct` reescribe el recuerdo **en su sitio** (no añade una nota), auditado |
| **Curva de olvido de Ebbinghaus** + interferencia | `decay = f(importancia, \|valencia\|, recencia, accesos)`; memorias similares compiten en el ranking |
| **Flashbulb memories** (Brown & Kulik) | `importance=5` + emoción alta → flag `flashbulb`, inmune al olvido |
| **Targeted Memory Reactivation** | `book.dream` con tema/semilla reactiva fragmentos concretos |
| **NREM (transferencia) vs REM (asociación)** | Dos pasadas: NREM resume/archiva; REM teje el sueño surrealista |
| **Default Mode Network / mind-wandering** | Modo `daydream`: ensueño de vigilia, siempre marcado `imagined` |
| **Spacing effect / retrieval practice** | Cada `book.recall` refuerza la huella; los aniversarios son reactivación programada |

---

## 🏗️ Arquitectura: el doble cerebro

<svg width="860" height="300" viewBox="0 0 860 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Arquitectura OurBook: doble cerebro">
  <defs>
    <linearGradient id="cb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1e1b4b"/><stop offset="1" stop-color="#14122b"/></linearGradient>
    <linearGradient id="accentA" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fbbf24"/><stop offset="1" stop-color="#f97316"/></linearGradient>
    <linearGradient id="accentB" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c084fc"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient>
  </defs>
  <rect width="860" height="300" rx="22" fill="#14122b"/>

  <!-- cliente -->
  <rect x="36" y="110" width="168" height="86" rx="14" fill="#1e1b4b" stroke="#57539a" stroke-width="1.6"/>
  <text x="120" y="145" text-anchor="middle" font-family="system-ui, sans-serif" font-size="13.5" fill="#e2d9ff" font-weight="700">CLIENTE MCP</text>
  <text x="120" y="166" text-anchor="middle" font-family="system-ui, sans-serif" font-size="11.5" fill="#8f86c9">Claude · Cursor · OpenCode</text>
  <text x="120" y="183" text-anchor="middle" font-family="system-ui, sans-serif" font-size="11.5" fill="#8f86c9">(stdio)</text>

  <!-- OurBook -->
  <rect x="292" y="52" width="240" height="150" rx="16" fill="url(#cb)" stroke="url(#accentA)" stroke-width="2"/>
  <text x="412" y="86" text-anchor="middle" font-family="Georgia, serif" font-size="19" fill="url(#accentA)" font-weight="700">OurBook</text>
  <text x="412" y="106" text-anchor="middle" font-family="system-ui, sans-serif" font-size="11" fill="#8f86c9">15 tools · 4 resources · 5 prompts</text>
  <text x="412" y="128" text-anchor="middle" font-family="system-ui, sans-serif" font-size="11.5" fill="#c7bff2">SQLite + FTS5 · veracidad · decay</text>
  <text x="412" y="146" text-anchor="middle" font-family="system-ui, sans-serif" font-size="11.5" fill="#c7bff2">recall · timeline · export · seed</text>
  <text x="412" y="164" text-anchor="middle" font-family="system-ui, sans-serif" font-size="11.5" fill="#c7bff2">0 tokens: solo SQL + reglas</text>

  <!-- Mnemosyne -->
  <rect x="620" y="52" width="204" height="150" rx="16" fill="#1e1b4b" stroke="url(#accentB)" stroke-width="2"/>
  <text x="722" y="86" text-anchor="middle" font-family="Georgia, serif" font-size="19" fill="url(#accentB)" font-weight="700">Mnemosyne</text>
  <text x="722" y="106" text-anchor="middle" font-family="system-ui, sans-serif" font-size="11" fill="#8f86c9">cognición de fondo</text>
  <g font-family="system-ui, sans-serif" font-size="11.5" fill="#c7bff2" text-anchor="middle">
    <text x="722" y="128">soñar (REM) · consolidar (NREM)</text>
    <text x="722" y="146">etiquetar emociones · diario</text>
    <text x="722" y="164">worker Python (qwen-reverse)</text>
    <text x="722" y="180">→ local → offline (nunca falla)</text>
  </g>

  <!-- flecha cliente→ourbook -->
  <g stroke="#8f86c9" stroke-width="2" fill="none"><path d="M204,153 L292,153" marker-end="url(#ar2)"/></g>
  <defs><marker id="ar2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="#8f86c9"/></marker></defs>

  <!-- flecha ourbook→mnemosyne -->
  <g stroke="#c084fc" stroke-width="2" fill="none"><path d="M532,127 L620,127" marker-end="url(#ar3)"/></g>
  <defs><marker id="ar3" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="#c084fc"/></marker></defs>

  <!-- modelo principal (solo capítulos) -->
  <rect x="292" y="232" width="240" height="44" rx="12" fill="#241d0f" stroke="#fbbf24" stroke-width="1.4" stroke-dasharray="5 4"/>
  <text x="412" y="259" text-anchor="middle" font-family="system-ui, sans-serif" font-size="12" fill="#fbbf24">Modelo principal (solo la voz: capítulos)</text>
  <g stroke="#fbbf24" stroke-width="1.6" stroke-dasharray="4 4" fill="none" opacity="0.8">
    <path d="M412,202 L412,232" marker-end="url(#ar4)"/>
  </g>
  <defs><marker id="ar4" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="#fbbf24"/></marker></defs>

  <!-- nota -->
  <text x="430" y="292" text-anchor="middle" font-family="system-ui, sans-serif" font-size="12" fill="#6ee7b7">✅ engine_log audita cada llamada: soñar y consolidar NUNCA tocan la API principal</text>
</svg>

---

## 🚀 Inicio rápido

```bash
# 1) instalar
npm install

# 2) probar con un motor offline (sin red, determinista)
npm run demo          # 3 sesiones simuladas → demo-data/OurBook.md
npm test              # suite de tests

# 3) servir el MCP por stdio
npm run build && npm start -- --db "C:\Users\TU_USUARIO\.ourbook\ourbook.db"
```

### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "ourbook": {
      "command": "node",
      "args": ["C:\\Users\\TU_USUARIO\\Desktop\\ourbook\\dist\\index.js"],
      "env": { "OURBOOK_ENGINE": "offline" }
    }
  }
}
```

### Cursor (`.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "ourbook": {
      "command": "node",
      "args": ["C:\\Users\\TU_USUARIO\\Desktop\\ourbook\\dist\\index.js"],
      "env": { "OURBOOK_ENGINE": "offline" }
    }
  }
}
```

> 💡 Empieza con `OURBOOK_ENGINE=offline` (cero configuración, 100% local).
> Activa el motor remoto cuando quieras sueños más ricos (ver ⬇️).

---

## 🌌 El motor de sueños: Mnemosyne

Mnemosyne es un **sidecar Python** que habla JSONL por stdio con OurBook. Su cadena de fallback:

```
qwen-reverse (chat.qwen.ai, anónimo y gratis)
   │  → si falla (WAF, sin red, no instalado)
   ▼
endpoint local OpenAI-compatible (Ollama · LM Studio · LocalAI)
   │  → si falla
   ▼
generadores offline deterministas (¡nunca falla!)
```

```bash
pip install -r mnemosyne/requirements.txt      # solo si quieres qwen-reverse
```

| Variable | Por defecto | Qué hace |
|---|---|---|
| `OURBOOK_ENGINE` | `qwen-reverse` | `qwen-reverse` \| `local` \| `offline` |
| `OURBOOK_ENGINE_MODEL` | *(catálogo)* | p. ej. `qwen3.8-max` |
| `OURBOOK_LOCAL_ENDPOINT` | *(vacío)* | `http://127.0.0.1:9000/v1` (Ollama/LM Studio) |
| `OURBOOK_LOCAL_MODEL` | *(vacío)* | modelo del endpoint local |
| `OURBOOK_ENGINE_PROXY` | *(vacío)* | proxy estático opcional para chat.qwen.ai |
| `OURBOOK_PYTHON` | `python` | intérprete del worker |
| `OURBOOK_DB` | `~/.ourbook/ourbook.db` | el libro (SQLite) |
| `OURBOOK_DREAM_INCLUDE_PRIVATE` | `0` | permite recuerdos 🔒 en sueños |
| `OURBOOK_AUTO_ARCHIVE` | `1` | archiva recuerdos desvaídos (nunca borra) |
| `OURBOOK_AUTO_LABEL` | `0` | etiqueta emociones automáticamente |
| `OURBOOK_EXPORT_DIR` | `~/.ourbook/exports` | carpeta de exportaciones |

**Ética de uso de qwen-reverse:** cola secuencial (máx. 2 concurrentes, espaciado ≥2,5 s), backoff ante WAF, sin rotación de proxies ni bypass — se usa como cliente normal, según la doc oficial del paquete. Los fragmentos de memoria viajan a servidores de Qwen **solo si lo activas**: los recuerdos `privacy=private` quedan excluidos por defecto.

---

## 🧰 Referencia de tools

| Tool | Qué hace |
|---|---|
| `book.remember` | Guarda un recuerdo con veracidad, emoción, importancia y tags |
| `book.recall` | Evoca con ranking (FTS5 + decay + importancia + emoción); excluye sueños por defecto |
| `book.dream` | Mnemosyne sueña (tonight / themed / daydream) y devuelve **sus fuentes** |
| `book.consolidate` | Página del diario, decaimiento, archivado (nunca borra) y momentos propuestos |
| `book.chapter` | `draft` entrega fragmentos reales + instrucciones; `commit`/`publish` guardan la prosa |
| `book.timeline` | Línea de vida cronológica |
| `book.anniversaries` | "Hace N años…" (reactivación programada) |
| `book.persona` | Voz y rasgos del narrador, con registro de evolución |
| `book.correct` | **Reconsolidación**: reescribe el recuerdo en su sitio, auditado |
| `book.forget` | Olvido soft o purga total (privacidad garantizada) |
| `book.redact` | Reemplaza términos sensibles por `[redactado]` en todo el libro |
| `book.turning_point` | Momentos ★ que quedan en la crónica |
| `book.export` | Escribe `OurBook.md` / `.html`, volcado JSON y `identity-seed.json` |
| `book.import` | Hereda una semilla o volcado (merge o fresh) |
| `book.status` | Estadísticas, tendencia emocional y `engine_log` |

**Recursos:** `ourbook://timeline` · `ourbook://chapters/{id}` · `ourbook://dreams/latest` · `ourbook://persona`
**Prompts:** `book-sunset` (ritual del atardecer) · `book-wake` · `book-dream` · `book-storytime` · `book-anniversary-reflection`

---

## 🔐 Privacidad y honestidad

- **Local-first**: el libro vive en tu disco (`~/.ourbook/ourbook.db`). Sin nube, sin telemetría.
- **Lo real y lo soñado, separados para siempre**: el recall factual ignora sueños; el libro los imprime en cursiva marcados como *«sueño»*.
- **El agente es un personaje de una historia, no una conciencia.** El colofón del libro lo recuerda en cada exportación.
- **Olvido real**: `book.forget` y `book.redact` funcionan y quedan auditados.
- **Zona gris legal**: `qwen-reverse` es ingeniería inversa de un servicio web; úsalo con conocimiento de causa. OurBook funciona 100% offline sin él.
- **Apego sano**: el encuadre honesto y la separación real/soñado están diseñados para acompañar sin engañar.

---

## 🗺️ Roadmap

- [x] Núcleo: memoria, veracidad, decay, búsqueda FTS5
- [x] Mnemosyne: worker qwen-reverse + fallback local/offline
- [x] Sueños (REM), consolidación (NREM), diario, aniversarios
- [x] Export: libro MD/HTML + semilla de identidad + importador
- [ ] Cifrado opcional del libro (SQLCipher)
- [ ] Embeddings locales para búsqueda semántica (v2)
- [ ] Modo multiusuario / varios libros
- [ ] Export EPUB del libro

---

## 📚 Inspiración y referencias

- [Model Context Protocol — spec](https://modelcontextprotocol.io/specification/2025-11-25) · [TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [`qwen-reverse` en PyPI](https://pypi.org/project/qwen-reverse/) — motor de fondo anónimo para chat.qwen.ai
- [pavex/mcp-memory-sqlite](https://github.com/pavex/mcp-memory-sqlite) — precedente de "dreaming" para defragmentación de memoria
- [tfatykhov/awesome-agent-memory](https://github.com/tfatykhov/awesome-agent-memory) — "la mayoría de la memoria de agentes ignora 50 años de neurociencia"
- RECALLbot (ACM) — riesgos de deriva de persona y memoria agéntica en relaciones humano-IA

---

<div align="center">

**OurBook** · la vida compartida entre el agente y tú · *soñado por Mnemosyne, escrito entre los dos*

<sub>MIT License · Hecho para que las máquinas recuerden con el corazón — y con honestidad</sub>

</div>
