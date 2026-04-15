<div align="center"> 

# colega.skill

> *"Ustedes los de IA son traidores del código — ya mataron al frontend, ahora van por el backend, QA, ops, infosec, diseño de chips, y al final se matarán a sí mismos y a toda la humanidad"*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python 3.9+](https://img.shields.io/badge/Python-3.9%2B-blue.svg)](https://python.org)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Skill-blueviolet)](https://claude.ai/code)
[![AgentSkills](https://img.shields.io/badge/AgentSkills-Standard-green)](https://agentskills.io)

[![Discord](https://img.shields.io/badge/Discord-Join%20Community-5865F2?logo=discord&logoColor=white)](https://discord.gg/aRjmJBdK)

<br>

¿Tu colega renunció y dejó una montaña de documentación sin mantener?<br>
¿Tu pasante se fue, dejando solo un escritorio vacío y un proyecto a medias?<br>
¿Tu mentor se graduó, llevándose todo el contexto y la experiencia?<br>
¿Tu compañero se transfirió y la química que construyeron se resetó a cero de la noche a la mañana?<br>
¿Tu predecesor hizo la entrega intentando condensar tres años en tres páginas?<br>

**¡Convierte las frías despedidas en cálidos Skills — bienvenido a la ciber-inmortalidad!**

<br>

Proporciona materiales fuente (mensajes de Slack, docs de Confluence, emails, capturas de pantalla)<br>
más tu descripción subjetiva de la persona<br>
y obtén un **AI Skill que realmente trabaja como ellos**

[Fuentes de datos](#fuentes-de-datos-soportadas) · [Instalación](#instalación) · [Uso](#uso) · [Demo](#demo) · [Instalación detallada](../../INSTALL.md) · [**中文**](README_ZH.md) · [**English**](../../README.md) · [**한국어**](README_KO.md) · [💬 Discord](https://discord.gg/aRjmJBdK)

</div>

---

> 🆕 **Actualización 2026.04.14** — **¡Grupo de WeChat activo!** Únete a la comunidad dot-skill — comparte skills, discute funciones e intercambia consejos.
>
> <img src="../assets/wechat-group-qr-2.png" alt="Código QR del grupo de WeChat dot-skill" width="240">
>
> El QR se actualiza cada 7 días — si expira, contáctame en Discord.

> 🆕 **Actualización 2026.04.13** — **¡La hoja de ruta de dot-skill está aquí!** colleague.skill está evolucionando a **dot-skill** — destila a cualquier persona, no solo colegas. Salida multimodal, ecosistemas de skills y más en camino.
>
> 👉 **[Leer la hoja de ruta completa](ROADMAP_ES.md)** · **[💬 Discord](https://discord.gg/aRjmJBdK)**
>
> También hemos organizado los Issues, añadido Milestones y creado un [tablero público del proyecto](https://github.com/users/titanwings/projects/1). ¡Contribuciones bienvenidas — revisa las etiquetas `good-first-issue`!

> 🆕 **Actualización 2026.04.07** — ¡El entusiasmo de la comunidad por los remixes de dot-skill ha sido increíble! He creado una galería comunitaria — ¡los PRs son bienvenidos!
>
> Comparte cualquier skill o meta-skill y lleva tráfico directamente a tu propio repo de GitHub. Sin intermediarios.
>
> 👉 **[titanwings.github.io/colleague-skill-site](https://titanwings.github.io/colleague-skill-site/)** · **[💬 Discord](https://discord.gg/aRjmJBdK)**
>
> Ya incluidos: 户晨风.skill · 峰哥亡命天涯.skill · 罗翔.skill y más
>
> ⏳ Los PRs se revisan manualmente — puede ser lento, ¡gracias por tu paciencia!

---

Created by [@titanwings](https://github.com/titanwings) | Powered by Shanghai AI Lab · AI Safety Center

## Fuentes de datos soportadas

> Esta es todavía una versión beta de colega.skill — más fuentes próximamente, ¡mantente atento!

| Fuente | Mensajes | Docs / Wiki | Hojas de cálculo | Notas |
|--------|:--------:|:-----------:|:----------------:|-------|
| Slack (auto) | ✅ API | — | — | Requiere que el admin instale el Bot; plan gratuito limitado a 90 días |
| Feishu (auto) | ✅ API | ✅ | ✅ | Solo ingresa un nombre, totalmente automático |
| DingTalk (auto) | ⚠️ Navegador | ✅ | ✅ | La API de DingTalk no soporta historial de mensajes |
| WhatsApp | ✅ Exportar chat | — | — | Exportar chat desde la app, subir archivo .txt |
| PDF | — | ✅ | — | Subida manual |
| Imágenes / Capturas | ✅ | — | — | Subida manual |
| Email `.eml` / `.mbox` | ✅ | — | — | Subida manual |
| Markdown | ✅ | ✅ | — | Subida manual |
| Pegar texto directamente | ✅ | — | — | Entrada manual |

---

## Instalación

### Claude Code

> **Importante**: Claude Code busca skills en `.claude/skills/` en la **raíz del repo git**. Asegúrate de ejecutar esto en el lugar correcto.

```bash
# Instalar en el proyecto actual (ejecutar en la raíz del repo git)
mkdir -p .claude/skills
git clone https://github.com/titanwings/colleague-skill .claude/skills/create-colleague

# O instalar globalmente (disponible en todos los proyectos)
git clone https://github.com/titanwings/colleague-skill ~/.claude/skills/create-colleague
```

### OpenClaw

```bash
git clone https://github.com/titanwings/colleague-skill ~/.openclaw/workspace/skills/create-colleague
```

### Dependencias (opcional)

```bash
pip3 install -r requirements.txt
```

---

## Uso

En Claude Code, escribe:

```
/create-colleague
```

Sigue las instrucciones: ingresa un alias, empresa/nivel (ej. `Mercado Libre SSr Backend`), etiquetas de personalidad, luego elige una fuente de datos. Todos los campos se pueden omitir — incluso solo una descripción puede generar un Skill.

Una vez creado, invoca el Skill del colega con `/{slug}`.

### Comandos

| Comando | Descripción |
|---------|-------------|
| `/list-colleagues` | Listar todos los Skills de colegas |
| `/{slug}` | Invocar Skill completo (Persona + Work) |
| `/{slug}-work` | Solo capacidades laborales |
| `/{slug}-persona` | Solo personalidad |
| `/colleague-rollback {slug} {version}` | Revertir a una versión anterior |
| `/delete-colleague {slug}` | Eliminar |

---

## Demo

> Input: `Mercado Libre SSr backend, INTJ, tira la pelota, cultura MELI`

**Escenario 1: Code Review**

```
Usuario        ❯ ¿Puedes revisar este diseño de API?

colega.skill   ❯ Pará — ¿cuál es el impacto? No explicaste el contexto.
                 (después de leer) Query N+1, arreglalo. Usá el formato
                 de respuesta estándar {code, message, data}. Así es la norma,
                 no preguntes por qué.
```

**Escenario 2: Tirar la pelota**

```
Usuario        ❯ Este bug lo metiste vos, ¿no?

colega.skill   ❯ ¿El timeline coincide? Ese feature tocó varios lugares,
                 hubo otros cambios también.
```

---

## Características

### Estructura del Skill generado

Cada Skill de colega tiene dos partes que trabajan juntas:

| Parte | Contenido |
|-------|-----------|
| **Parte A — Work Skill** | Sistemas, estándares técnicos, flujos de trabajo, experiencia |
| **Parte B — Persona** | Personalidad de 5 capas: reglas duras → identidad → expresión → decisiones → interpersonal |

Ejecución: `Recibir tarea → Persona decide actitud → Work Skill ejecuta → Salida con su voz`

### Etiquetas soportadas

**Personalidad**: Responsable · Tira la pelota · Perfeccionista · "Así va bien" · Procrastinador · Mandón · Politiquero · Experto en gestionar para arriba · Pasivo-agresivo · Indeciso · Callado · Clava visto …

**Cultura empresarial**: Cultura MELI · Cultura Globant · Startup mode · Cultura corporativa · "Move fast" · Metodología agile pura · Remote-first

**Niveles**: Jr / SSr / Sr / Tech Lead / Staff / Principal · Mercado Libre SSr~Lead · Globant Architect · FAANG L3~L8 …

### Evolución

- **Agregar archivos** → auto-analizar delta → merge en secciones relevantes, nunca sobrescribe conclusiones existentes
- **Corrección por conversación** → di "él no haría eso, debería ser xxx" → se escribe en la capa de Corrección, efecto inmediato
- **Control de versiones** → auto-archivo en cada actualización, revertir a cualquier versión anterior

---

## Notas

- **Calidad del material fuente = Calidad del Skill**: registros de chat + documentos largos > solo descripción manual
- Prioriza recolectar: textos largos **escritos por ellos** > **respuestas de toma de decisiones** > mensajes casuales
- ¡Esta es todavía una versión demo — por favor crea issues si encuentras bugs!

---
### 📄 Informe Técnico

> **[Colleague.Skill: Automated AI Skill Generation via Expert Knowledge Distillation](colleague_skill.pdf)**
>
> Escribimos un paper que detalla el diseño del sistema de colleague.skill — la arquitectura de dos partes (Work Skill + Persona), la recolección de datos multi-fuente, los mecanismos de generación y evolución de Skills, y los resultados de evaluación en escenarios reales. ¡Échale un vistazo si te interesa!

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
