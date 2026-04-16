<div align="center">

# kollege.skill

> *"Ihr KI-Leute seid Verräter am Code — ihr habt schon das Frontend getötet, jetzt kommt ihr für Backend, QA, Ops, Infosec, Chipdesign, und am Ende tötet ihr euch selbst und die ganze Menschheit"*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python 3.9+](https://img.shields.io/badge/Python-3.9%2B-blue.svg)](https://python.org)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Skill-blueviolet)](https://claude.ai/code)
[![AgentSkills](https://img.shields.io/badge/AgentSkills-Standard-green)](https://agentskills.io)

[![Discord](https://img.shields.io/badge/Discord-Join%20Community-5865F2?logo=discord&logoColor=white)](https://discord.gg/aRjmJBdK)

<br>

Dein Kollege hat gekündigt und einen Berg unwartbarer Dokumentation hinterlassen?<br>
Dein Praktikant ist gegangen — nur ein leerer Schreibtisch und ein halbfertiges Projekt?<br>
Dein Mentor hat seinen Abschluss gemacht und allen Kontext und alle Erfahrung mitgenommen?<br>
Dein Partner wurde versetzt und die Chemie, die ihr aufgebaut habt, war über Nacht auf null?<br>
Dein Vorgänger hat übergeben und versucht, drei Jahre in drei Seiten zu packen?<br>

**Verwandle kalte Abschiede in warme Skills — willkommen zur Cyber-Unsterblichkeit!**

<br>

Liefere Quellmaterialien (Slack-Nachrichten, Confluence-Docs, E-Mails, Screenshots)<br>
plus deine subjektive Beschreibung der Person<br>
und erhalte einen **AI Skill, der tatsächlich wie sie arbeitet**

[Datenquellen](#unterstützte-datenquellen) · [Installation](#installation) · [Nutzung](#nutzung) · [Demo](#demo) · [Detaillierte Installation](../../INSTALL.md) · [**中文**](README_ZH.md) · [**English**](../../README.md) · [**한국어**](README_KO.md) · [💬 Discord](https://discord.gg/aRjmJBdK)

</div>

---

> 🆕 **Update 2026.04.14** — **WeChat-Gruppe ist online!** Komm in die dot-skill Community — teile Skills, diskutiere Features, tausche Tipps aus.
>
> <img src="../assets/wechat-group-qr-3.png" alt="dot-skill WeChat-Gruppen QR" width="240"> 
>
> QR wird alle 7 Tage erneuert — wenn abgelaufen, melde dich auf Discord.

> 🆕 **Update 2026.04.13** — **Die dot-skill Roadmap ist da!** colleague.skill entwickelt sich zu **dot-skill** weiter — destilliere jeden, nicht nur Kollegen. Multimodale Ausgabe, Skill-Ökosysteme und mehr sind in Arbeit.
>
> 👉 **[Vollständige Roadmap lesen](ROADMAP_DE.md)** · **[💬 Discord](https://discord.gg/aRjmJBdK)**
>
> Wir haben auch Issues aufgeräumt, Milestones hinzugefügt und ein [öffentliches Projekt-Board](https://github.com/users/titanwings/projects/1) eingerichtet. Community-Beiträge willkommen — schau dir die `good-first-issue` Labels an!

> 🆕 **Update 2026.04.07** — Die Begeisterung der Community für dot-skill-Remixes ist überwältigend! Ich habe eine Community-Galerie gebaut — PRs willkommen!
>
> Teile jede skill oder meta-skill und leite Traffic direkt zu deinem eigenen GitHub-Repo. Kein Mittelsmann.
>
> 👉 **[titanwings.github.io/colleague-skill-site](https://titanwings.github.io/colleague-skill-site/)** · **[💬 Discord](https://discord.gg/aRjmJBdK)**
>
> Bereits gelistet: 户晨风.skill · 峰哥亡命天涯.skill · 罗翔.skill und mehr
>
> ⏳ PRs werden derzeit manuell geprüft — kann etwas dauern, danke für deine Geduld!

---

Created by [@titanwings](https://github.com/titanwings) | Powered by Shanghai AI Lab · AI Safety Center

## Unterstützte Datenquellen

> Dies ist noch eine Beta-Version von kollege.skill — weitere Quellen kommen bald, bleib dran!

| Quelle | Nachrichten | Docs / Wiki | Tabellen | Hinweise |
|--------|:-----------:|:-----------:|:--------:|----------|
| Slack (auto) | ✅ API | — | — | Admin muss Bot installieren; kostenloser Plan auf 90 Tage begrenzt |
| Microsoft Teams | ✅ Export | — | — | Chat-Export über Compliance oder manuell |
| Feishu (auto) | ✅ API | ✅ | ✅ | Einfach einen Namen eingeben, vollautomatisch |
| PDF | — | ✅ | — | Manueller Upload |
| Bilder / Screenshots | ✅ | — | — | Manueller Upload |
| E-Mail `.eml` / `.mbox` | ✅ | — | — | Manueller Upload |
| Markdown | ✅ | ✅ | — | Manueller Upload |
| Text direkt einfügen | ✅ | — | — | Manuelle Eingabe |

---

## Installation

### Claude Code

> **Wichtig**: Claude Code sucht Skills in `.claude/skills/` im **Git-Repo-Stammverzeichnis**. Stelle sicher, dass du dies am richtigen Ort ausführst.

```bash
# Im aktuellen Projekt installieren (im Git-Repo-Stammverzeichnis ausführen)
mkdir -p .claude/skills
git clone https://github.com/titanwings/colleague-skill .claude/skills/create-colleague

# Oder global installieren (in allen Projekten verfügbar)
git clone https://github.com/titanwings/colleague-skill ~/.claude/skills/create-colleague
```

### OpenClaw

```bash
git clone https://github.com/titanwings/colleague-skill ~/.openclaw/workspace/skills/create-colleague
```

### Abhängigkeiten (optional)

```bash
pip3 install -r requirements.txt
```

---

## Nutzung

In Claude Code eingeben:

```
/create-colleague
```

Folge den Anweisungen: Gib einen Alias ein, Firma/Level (z.B. `SAP Senior Developer`), Persönlichkeits-Tags, dann wähle eine Datenquelle. Alle Felder können übersprungen werden — selbst eine Beschreibung allein kann einen Skill generieren.

Nach der Erstellung rufst du den Kollegen-Skill mit `/{slug}` auf.

### Befehle

| Befehl | Beschreibung |
|--------|--------------|
| `/list-colleagues` | Alle Kollegen-Skills auflisten |
| `/{slug}` | Vollständigen Skill aufrufen (Persona + Work) |
| `/{slug}-work` | Nur Arbeitsfähigkeiten |
| `/{slug}-persona` | Nur Persönlichkeit |
| `/colleague-rollback {slug} {version}` | Auf eine frühere Version zurücksetzen |
| `/delete-colleague {slug}` | Löschen |

---

## Demo

> Input: `SAP Senior Developer, ISTJ, gründlich, deutsche Ingenieurskultur`

**Szenario 1: Code Review**

```
Benutzer        ❯ Kannst du dieses API-Design reviewen?

kollege.skill   ❯ Moment — wo ist die Spezifikation? Ohne Anforderungsdokument
                  kann ich das nicht sinnvoll bewerten.
                  (nach dem Lesen) N+1 Query, beheben. Und die Fehlerbehandlung
                  ist unvollständig — was passiert bei Timeout? Das muss
                  dokumentiert sein.
```

**Szenario 2: Verantwortung**

```
Benutzer        ❯ Dieser Bug wurde von dir eingeführt, oder?

kollege.skill   ❯ Lass mich erst das Ticket prüfen. Die Änderung wurde am
                  Dienstag deployed, der Fehler trat aber schon Montag auf.
                  Bitte prüfe das Deployment-Log nochmal.
```

---

## Features

### Generierte Skill-Struktur

Jeder Kollegen-Skill hat zwei Teile, die zusammenarbeiten:

| Teil | Inhalt |
|------|--------|
| **Teil A — Work Skill** | Systeme, technische Standards, Workflows, Erfahrung |
| **Teil B — Persona** | 5-Schichten-Persönlichkeit: harte Regeln → Identität → Ausdruck → Entscheidungen → Zwischenmenschliches |

Ausführung: `Aufgabe empfangen → Persona entscheidet Haltung → Work Skill führt aus → Ausgabe in ihrer Stimme`

### Unterstützte Tags

**Persönlichkeit**: Gründlich · Pflichtbewusst · Perfektionist · "Läuft schon" · Bürokratisch · Direkt · Diplomatisch · Detailverliebt · Prozesstreuer · Eigenbrötler · Wortkarg · Pünktlich bis zur Sekunde …

**Unternehmenskultur**: SAP-Kultur · Siemens-Stil · Startup-Berlin · Bosch-Ingenieur · "German Engineering" · Mittelstand-Mentalität · Konzern-Prozesse · Remote-first

**Level**: Junior / Senior / Lead / Principal / Staff · SAP T1~T5 · Siemens Grade 7~12 · FAANG L3~L8 · Tarifvertrag E10~E15 …

### Evolution

- **Dateien anfügen** → automatische Delta-Analyse → Merge in relevante Abschnitte, überschreibt nie bestehende Schlussfolgerungen
- **Gesprächskorrektur** → sage „er würde das nicht tun, er sollte xxx sein" → wird in die Korrekturschicht geschrieben, sofortige Wirkung
- **Versionskontrolle** → automatische Archivierung bei jedem Update, Rollback zu jeder früheren Version

---

## Hinweise

- **Quellmaterial-Qualität = Skill-Qualität**: Chat-Protokolle + lange Dokumente > nur manuelle Beschreibung
- Priorisiere das Sammeln von: Langtexten **von ihnen geschrieben** > **Entscheidungsantworten** > beiläufige Nachrichten
- Dies ist noch eine Demo-Version — bitte erstelle Issues, wenn du Bugs findest!

---
### 📄 Technischer Bericht

> **[Colleague.Skill: Automated AI Skill Generation via Expert Knowledge Distillation](colleague_skill.pdf)**
>
> Wir haben ein Paper geschrieben, das das Systemdesign von colleague.skill im Detail beschreibt — die Zwei-Teile-Architektur (Work Skill + Persona), die Multi-Source-Datenerfassung, die Skill-Generierungs- und Evolutionsmechanismen sowie die Evaluierungsergebnisse in realen Szenarien. Schau es dir an, wenn du interessiert bist!

---

## Star History

<a href="https://www.star-history.com/?repos=titanwings%2Fcolleague-skill&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/image?repos=titanwings/colleague-skill&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/image?repos=titanwings/colleague-skill&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/image?repos=titanwings/colleague-skill&type=date&legend=top-left" />
 </picture>
</a>

---

<div align="center">

MIT License © [titanwings](https://github.com/titanwings)

</div>
