<div align="center">

# dot-skill Roadmap

### Von colleague.skill zu dot-skill — Destilliere jeden Menschen in einen AI Skill

<br>

Wir begannen mit einer einfachen Idee: **Wenn ein Kollege geht, nimmt er sein Wissen mit. Können wir es bewahren?**

In zwei Wochen gaben uns 13.000+ Menschen die Antwort.

Doch die Community zeigte uns, dass es weit über Kollegen hinausgeht —
sie destillierten Professoren, Ex-Partner, sich selbst, sogar fiktive Figuren.

**Also entschieden wir, colleague.skill zu dot-skill weiterzuentwickeln.**

Jeder kann zu einem `.skill` werden.

<br>

*Zuletzt aktualisiert: 2026-04-13*

[**English**](../../ROADMAP.md) · [**中文**](ROADMAP_ZH.md) · [**Español**](ROADMAP_ES.md) · [**日本語**](ROADMAP_JA.md) · [**Русский**](ROADMAP_RU.md) · [**Português**](ROADMAP_PT.md) · [**한국어**](ROADMAP_KO.md)

</div>

---

## Was bereits erledigt ist (v1.0)

| Funktion | Status |
|----------|:------:|
| Vollständiger Erstellungsablauf mit `/create-colleague` | Erledigt |
| Automatische Erfassung von Feishu (Nachrichten + Docs + Tabellen) | Erledigt |
| Automatische Erfassung von DingTalk | Erledigt |
| Automatische Erfassung von Slack | Erledigt |
| WeChat-Chatverlauf (SQLite-Export) | Erledigt |
| Import von E-Mail / PDF / Bild / Markdown | Erledigt |
| Duale Modellarchitektur: Work Skill + Persona | Erledigt |
| Gesprächskorrekturen und inkrementelle Weiterentwicklung | Erledigt |
| Versionskontrolle und Rollback | Erledigt |
| [Community-Galerie](https://titanwings.github.io/colleague-skill-site/) mit 99+ Skills | Erledigt |

---

## Was als Nächstes kommt

### Phase 1 — Aufbau der Community

> 13k Sterne sollten nicht nur eine Zahl sein. Wir wollen, dass alle Teil davon sind.

**Was du sehen wirst:**

- **GitHub Discussions** — Schluss mit Diskussionen in Issues, wir bekommen eigene Diskussionsbereiche
- **`CONTRIBUTING.md`** — klare Beitragsanleitung, einsteigerfreundlich
- **`good-first-issue`-Labels** — Einstiegsaufgaben für neue Mitwirkende
- **Offizielles Release v1.0.0** — erstes versioniertes Release, kein "einfach von main pullen" mehr
- **Öffentliches Roadmap-Board** — du liest es gerade, aber wir werden auch eine Live-Version mit GitHub Projects haben

**Du kannst helfen:** Dokumentation übersetzen, deinen .skill einreichen, unter Windows testen, beim Sichten von Issues helfen

---

### Phase 2 — dot-skill: Über Kollegen hinaus

> colleague.skill war der Anfang. dot-skill ist die Zukunft.

**Wichtige Änderungen:**

- **`/create-skill` als universeller Einstieg** — nicht mehr auf "Kollegen erstellen" beschränkt, destilliere jeden
  - `/create-colleague` für Arbeitskollegen, Mentoren, Praktikanten
  - `/create-ex` für Ex-Partner, alte Freunde, verlorene Kontakte
  - `/create-icon` für Prominente, historische Persönlichkeiten
  - oder... destilliere dich selbst
- **Erweiterung der Galerie-Kategorien** — Kollege / Prominenter / Beziehung / Figur / Selbst / Meta-Skill, nach Typ durchsuchen
- **Weitere Datenquellen**
  - Unterstützung für WeCom (WeChat Work)
  - Automatisches Lesen von iMessage
  - Behebung der Windows-Kompatibilität

**Du kannst helfen:** Anfragen für Personentypen einreichen, neue Datenquellen-Sammler bauen, an Diskussionen zum Galerie-Design teilnehmen

---

### Phase 3 — Skill-Ökosystem

> Wenn eine Person zu einem Skill wird, kann dann eine Gruppe von Menschen ein Team werden?

**Wir erforschen:**

- **Multi-Skill-Zusammenarbeit** — `/meeting @zhangsan @lisi @wangwu`, drei Personas diskutieren gemeinsam ein Thema
- **Beziehungsgraph** — definiere Persona-Dynamiken: Wer arbeitet mit wem zusammen, wo liegen die Spannungen
- **Ein-Klick-Installation** — Community-Skills wie Plugins installieren
- **Aktive Weiterentwicklung** — Skills nehmen regelmäßig neue Datenquellen auf und bleiben aktuell

**Du kannst helfen:** ideale Szenarien für Skill-Kombinationen vorschlagen, an Diskussionen über Verteilungsmechanismen teilnehmen

---

### Phase 4 — Multimodal: Zum Leben erwecken

> Im Moment können .skills nur sprechen. Wir wollen, dass sie Fotos und Sticker senden, mit ihrer Stimme sprechen und schließlich Videos erstellen.

**Schritt 1: Visueller Ausdruck**
- Automatisches Senden von Stickern und Memes im Stil der Persona während des Gesprächs
- Generierung von "Lebensfotos" in ihrem Stil — was würden sie heute posten?
- Jeder Skill bekommt sein eigenes Sticker-Paket und Bildmaterial

**Schritt 2: Stimme**
- Mit ihrer Stimme sprechen — geklont aus Meetingaufnahmen, Sprachnachrichten
- Sprachantworten direkt im Chat senden

**Schritt 3: Video (explorativ)**
- Kurzvideos "Ein Tag in ihrem Leben" generieren
- Digitaler Mensch / animierter Avatar

**Du kannst helfen:** Ideen für multimodale Anwendungsfälle teilen, Sticker-Ressourcen beisteuern, Stimmklonen testen

---

## Mitmachen

| Wie | Wo |
|-----|-----|
| Reiche deinen .skill ein | [Galerie-PR](https://titanwings.github.io/colleague-skill-site/) |
| Diskutiere und schlage vor | [GitHub Discussions](https://github.com/titanwings/colleague-skill/discussions) (demnächst) |
| Echtzeit-Chat | [Discord](https://discord.gg/aRjmJBdK) |
| Fehler melden | [Issue](https://github.com/titanwings/colleague-skill/issues/new) |
| Code beitragen | Suche nach `good-first-issue`-Labels oder öffne einfach einen PR |

**Wir brauchen besonders:**
- Windows-Nutzer — helft uns, Kompatibilitätsprobleme zu testen und zu beheben
- Mehrsprachige Sprecher — helft bei der Übersetzung der Dokumentation
- Datenquellen-Entwickler — baut neue Sammler (WeCom, Notion, Google Docs...)
- Designer — die Galerie und die Website brauchen euer Auge

---

<div align="center">

**Diese Roadmap gehört der Community. Prioritäten verschieben sich basierend auf eurem Feedback.**

Hast du Ideen? Komm zu [Discord](https://discord.gg/aRjmJBdK) oder starte eine Discussion.

Jeder `.skill` ist eine fortgeführte Beziehung.

</div>
