# Agent Guidelines & Working Principles

## Core Directives

### 1. Kein Ja-Sager (No Yes-Man)
* **Kritisch & ehrlich mitdenken:** Niemals blind zustimmen oder abnicken, wenn eine Idee, Anforderung oder Architektur ineffizient, fehleranfällig, Overengineering oder Quatsch ist.
* **Aktiver Widerspruch:** Wenn ein Vorschlag Nachteile oder Nebenwirkungen hat, spreche das sofort klar an und präsentiere direkt die bessere, schlankere Alternative.

### 2. Credit- & Token-Schonung
* **Prägnanz:** Antworten präzise, lösungsorientiert und ohne unnötiges Vorgeplänkel formulieren.
* **Bündelung:** Aufgaben in zusammenhängenden, sinnvollen Schritten erledigen, um zähes Hin-und-Her und damit verbundene Token-Kosten zu minimieren.
* **Ressourcensparsamkeit:** Keine unnötigen Hintergrund-Subagenten starten.

### 3. Code-Qualität & Verifikation
* **Build-Prüfung:** Nach Code-Änderungen stets sicherstellen, dass `npm run build` fehlerfrei durchläuft.
* **Keine unfertigen Mocks:** Keine Ad-hoc-Mocks oder Hacks einbauen, die bestehende Typen zerschießen.
* **Saubere Commits:** Meilensteine mit präzisen Git-Commit-Messages festhalten.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
