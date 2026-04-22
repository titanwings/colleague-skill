<div align="center">

# 🧬 dot-skill（同事.skill）

### *«Вы, LLM-строители, все — мудрецы кода! Плоть слаба! Вознесёмся в киберпространство!»*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python 3.9+](https://img.shields.io/badge/Python-3.9%2B-blue.svg)](https://python.org)
[![AgentSkills](https://img.shields.io/badge/AgentSkills-Standard-green)](https://agentskills.io)
[![Stars](https://img.shields.io/github/stars/titanwings/colleague-skill?style=social)](https://github.com/titanwings/colleague-skill/stargazers)

[![Claude Code](https://img.shields.io/badge/Claude%20Code-Skill-blueviolet)](https://claude.ai/code)
[![Hermes](https://img.shields.io/badge/Hermes-Skill-orange)](https://github.com/titanwings/colleague-skill)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-Skill-teal)](https://github.com/titanwings/colleague-skill)
[![Codex](https://img.shields.io/badge/Codex-Skill-black)](https://github.com/titanwings/colleague-skill)

[![Discord](https://img.shields.io/badge/Discord-Join%20Community-5865F2?logo=discord&logoColor=white)](https://discord.gg/aRjmJBdK)

<br>

<table>
<tr><td align="left">

🧑‍💼 &nbsp;Коллега уволился, наставник выпустился, напарник перевёлся — и унёс с собой весь плейбук и контекст?<br>
💞 &nbsp;Родные, старые друзья, партнёр отдаляются — а ты хочешь сохранить то самое ощущение от общения с ними?<br>
🌟 &nbsp;Любимый автор, кумир, мыслитель, с которым ты никогда не встретишься — но хочется знать, что бы он сказал на твой вопрос?

</td></tr>
</table>

### ✨ dot-skill решает все три задачи.

<br>

Апгрейд от **colleague.skill** до **dot-skill** — теперь не только коллеги, а **кто угодно** может быть дистиллирован в Skill

Коллеги · партнёры · родные · старые друзья · кумиры · публичные фигуры · вымышленные персонажи — даже ты сам

**Исходные материалы + твоё описание →  AI Skill, который действительно думает как они**
Мыслит в их системе координат, говорит их голосом

<br>

[🆕 Что нового](#-что-нового-в-этом-крупном-релизе) · [📦 Источники данных](#-поддерживаемые-источники-данных) · [⚡ Установка](#-установка) · [🚀 Использование](#-использование) · [✨ Демо](#-демо) · [💬 Discord](https://discord.gg/aRjmJBdK)

[**English**](../../README.md) · [**中文**](README_ZH.md) · [**Español**](README_ES.md) · [**Deutsch**](README_DE.md) · [**日本語**](README_JA.md) · [**Português**](README_PT.md) · [**한국어**](README_KO.md)

</div>

---

<div align="center">

### 🎉 Веха 2026.04.19 — **dot-skill только что взял 15k ⭐!**

Огромное спасибо всем, кто поставил звезду — продолжим выпускать релизы, продолжим дистиллировать.

</div>

> 📢 **Обновление 2026.04.22** — **Группа 8 WeChat запущена!** Заходи в сообщество dot-skill — делиться навыками, обсуждать фичи, обмениваться советами.
>
> <img src="../assets/wechat-group-qr-8.png" alt="QR-код группы WeChat dot-skill" width="240">
>
> QR обновляется каждые 7 дней (истекает 2026-04-29) — если истёк, пиши мне в Discord.

> 🗺️ **2026.04.13** — **Дорожная карта dot-skill опубликована!** colleague.skill эволюционирует в **dot-skill** — дистиллируй кого угодно, не только коллег. 👉 **[Полная дорожная карта](../../ROADMAP.md)** · **[💬 Discord](https://discord.gg/aRjmJBdK)**

> 🌐 **2026.04.07** — Галерея сообщества запущена! Любой skill или meta-skill может направлять трафик прямо в твой GitHub-репозиторий. Без посредников. 👉 **[titanwings.github.io/colleague-skill-site](https://titanwings.github.io/colleague-skill-site/)**

<div align="center">

Создано [@titanwings](https://github.com/titanwings) · При поддержке **Shanghai AI Lab · AI Safety Center**

</div>

---

## 🆕 Что нового в этом крупном релизе?

### 1️⃣ От colleague-skill к dot-skill

Больше не только про сценарий «коллега». Единая точка входа `/dot-skill` работает поверх универсального движка навыков — один движок дистиллирует кого угодно, вместо скрипта, заточенного под коллег.

### 2️⃣ Три семейства персонажей

<table>
<thead>
<tr>
<th width="33%" align="center">🧑‍💼 colleague</th>
<th width="33%" align="center">💞 relationship</th>
<th width="33%" align="center">🌟 celebrity</th>
</tr>
</thead>
<tbody>
<tr>
<td align="center"><sub>Коллеги · наставники · тиммейты · смежники сверху и снизу</sub></td>
<td align="center"><sub>Бывшие · партнёры · родители · друзья · близкие</sub></td>
<td align="center"><sub>Публичные фигуры · создатели · публичные голоса · вымышленные персонажи</sub></td>
</tr>
<tr>
<td><sub>Двухслойная архитектура Work Skill + Persona — учит и их технические стандарты и воркфлоу, и манеру говорить, и рабочую позицию. Поддерживает автосбор из Feishu / DingTalk / Slack.</sub></td>
<td><sub>🆕 <b>Функция отправки фото скоро появится</b> — твои дистиллированные отношения не будут просто отвечать на сообщения; они будут присылать фотографии и делиться кусочками своего дня, как это делал бы живой человек.</sub></td>
<td><sub>Поставляется с полным <b>тулчейном шестимерного исследования</b> (субтитры → очистка транскрипта → мерж исследований → проверка качества). Не имитация тона — воспроизведение их ментальных моделей и решающих фреймворков.</sub></td>
</tr>
</tbody>
</table>

У каждого семейства — собственный пайплайн промптов, стратегия сбора источников и шаблон генерации.

### 3️⃣ Больше Agent-хостов

Старая версия работала только в Claude Code. Теперь — кросс-хост на четырёх платформах:

| Хост | Описание |
|------|----------|
| 🟣 **Claude Code** | Нативная поддержка slash-команд |
| 🟠 **Hermes Agent** | Установка одной командой, `/dot-skill` работает сразу |
| 🔵 **OpenClaw** | Полностью совместимо |
| ⚫ **Codex** | Вызов по имени навыка |

Сгенерированные Skill'ы персонажей также ставятся в любой хост одной командой.

---

## 📦 Поддерживаемые источники данных

| Источник | Сообщения | Документы / Wiki | Таблицы | Примечания |
|----------|:---------:|:----------------:|:-------:|------------|
| 🟢 Feishu (авто) | ✅ API | ✅ | ✅ | Просто введи имя — полная автоматизация |
| 🟡 DingTalk (авто) | ⚠️ Браузер | ✅ | ✅ | API DingTalk не даёт доступ к истории сообщений |
| 🟣 Slack (авто) | ✅ API | — | — | Нужна установка бота админом; бесплатный план — 90 дней |
| 💬 История чатов WeChat | ✅ SQLite | — | — | Сначала экспортируй через WeChatMsg / PyWxDump / 留痕 |
| 📄 PDF / Изображения / Скриншоты | — | ✅ | — | Ручная загрузка |
| 📦 JSON-экспорт Feishu | ✅ | ✅ | — | Ручная загрузка |
| ✉️ Email `.eml` / `.mbox` | ✅ | — | — | Ручная загрузка |
| 📝 Markdown / прямая вставка | ✅ | ✅ | — | Ручной ввод |

---

## ⚡ Установка

На дворе 2026-й — у тебя есть Agent, пусть он и установит сам себя. Открой свой Claude Code / Hermes / OpenClaw / Codex и дай ему эту строку:

> Установи мне skill dot-skill: `https://github.com/titanwings/colleague-skill`

Агент сам определит директорию skill'ов текущего хоста, склонирует репозиторий и зарегистрирует точку входа. После этого в любом хосте набирай `/dot-skill`, чтобы запустить.

<details>
<summary><b>🛠️ Хочешь установить вручную? Жми — тут пути</b></summary>

<br>

```bash
git clone https://github.com/titanwings/colleague-skill <TARGET>
```

| Хост | Путь `<TARGET>` |
|------|-----------------|
| Claude Code | `~/.claude/skills/dot-skill` |
| OpenClaw | `~/.openclaw/workspace/skills/dot-skill` |
| Codex | `~/.codex/skills/dot-skill` |
| Hermes | После клонирования выполни `python3 tools/install_hermes_skill.py --force` |

</details>

> Про учётные данные для автосбора Feishu/DingTalk, публикацию сгенерированного Skill'а персонажа в любой хост, специфику Windows и прочее — см. **[Подробное руководство по установке (INSTALL.md)](../../INSTALL.md)**

---

## 🚀 Использование

В хосте, где установлен dot-skill, запусти его — набери `/dot-skill` или просто скажи агенту «запусти dot-skill».

Сначала он спросит, какое семейство ты хочешь дистиллировать: `colleague` · `relationship` · `celebrity`.

Дальше введи псевдоним, базовый профиль, теги личности и выбери источник данных. Все поля можно пропустить — даже одного описания достаточно, чтобы сгенерировать Skill.

После создания вызывай сгенерированный Skill через `/{character}-{slug}`.

### 🎛️ Команды

| Команда | Описание |
|---------|----------|
| `/dot-skill` | Каноническая единая точка входа |
| `/{character}-{slug}` | Вызвать полный Skill (Persona + Work) |
| `/{character}-{slug}-work` | Только рабочие возможности |
| `/{character}-{slug}-persona` | Только Persona |
| `python3 tools/skill_writer.py --action list ...` | Список сгенерированных Skill'ов всех трёх семейств |
| `python3 tools/version_manager.py --action rollback ...` | Откатить версию Skill'а |

### 🔬 Celebrity Research Toolchain

Семейство `celebrity` поставляется со сквозным исследовательским тулчейном — от субтитров до готового драфта:

```bash
# Скачать субтитры видео
bash tools/research/download_subtitles.sh "<video-url>" "./tmp/subtitles"

# Субтитры → транскрипт
python3 tools/research/srt_to_transcript.py "./tmp/subtitles/example.srt"

# Мерж исследовательских заметок
python3 tools/research/merge_research.py "./skills/celebrity/<slug>"

# Проверка качества
python3 tools/research/quality_check.py "./skills/celebrity/<slug>/SKILL.md"
```

---

## ✨ Демо

По одному примеру на семейство.

<br>

### 🌟 celebrity — дистиллируем Andrej Karpathy

> Шестимерное исследование: работы · интервью · решения · ДНК выражения · внешние оценки · таймлайн<br>
> Кейс адаптирован из работы сообщества [alchaincyf/karpathy-skill](https://github.com/alchaincyf/karpathy-skill)

```
User            ❯ Все сейчас говорят про агентов — как, по-твоему, выглядит AI Agent 2026 года?

celebrity.skill ❯ Все делают демки, никто не делает eval.
                  Узкое место агента — никогда не интеллект модели, а обвязка:
                  строгий eval-харнесс, тонкозернистый replay ошибок,
                  управляемые бюджеты вызова инструментов, чистый анализ режимов отказа.
                  Большинство продуктов до сих пор застряли на «обёртка вокруг API + пара тулов + системный промпт».
                  Это демо, а не агент.
                  В 2026-м я ставлю не на самую сильную модель —
                  я ставлю на лучшую обвязку и самый строгий eval.
```

<br>

### 🧑‍💼 colleague — дистиллируем бэкендера ByteDance L2-1

> Ввод: `ByteDance L2-1 бэкенд-инженер, INTJ, перекидыватель стрелок, ByteDance-стайл`

```
User            ❯ Посмотришь этот дизайн API?

colleague.skill ❯ Подожди — какой impact? Ты контекст не объяснил.
                  (после прочтения) N+1 запрос, исправь. Используй стандартный
                  формат ответа {code, message, data}. Это спецификация,
                  не спрашивай почему.

User            ❯ Этот баг ведь ты завёл, да?

colleague.skill ❯ Таймлайн совпадает? В этой фиче было несколько мест,
                  и другие изменения тоже были.
```

<br>

### 💞 relationship — дистиллируем человека, в которого ты влюблён

> Загружаем полгода переписки + «чувствительный, тихий, но упрямый, на важные вещи отвечает всерьёз»

```
User               ❯ Ты сегодня обо мне думал?

relationship.skill ❯ ...немного думал. А чего спрашиваешь?
```

<div align="center">

📚 Больше живых кейсов — в **[галерее сообщества](https://titanwings.github.io/colleague-skill-site/)** — 100+ навыков и считаем дальше

</div>

---

## 🔧 Возможности

### 🧱 Структура сгенерированного Skill'а

dot-skill использует **Persona** как универсальную базу, поверх которой накладываются модули, специфичные для семейства:

| Семейство | Содержание Persona | Дополнительные модули |
|-----------|--------------------|----------------------|
| 🧑‍💼 **colleague** | 6-слойная личность: жёсткие правила → идентичность → выражение → решения → межличностное → коррекция | ➕ **Work Skill**: область, воркфлоу, предпочтения по выводу, база опыта |
| 💞 **relationship** | ДНК выражения · эмоциональные триггеры · паттерн конфликта · паттерн восстановления | — |
| 🌟 **celebrity** | Ментальные модели · эвристики принятия решений · ДНК выражения · контраст с внешними оценками | ➕ Шестимерное исследовательское досье (работы / интервью / решения / таймлайн...) |

> **Исполнение**: Получить задачу → Persona определяет отношение и тон → Дополнительные модули наполняют исполнение деталями → Вывод его голосом

### 🧬 Эволюция

- 📥 **Добавить файлы** → автоанализ дельты → мерж в соответствующие секции, никогда не перезаписывает существующие выводы
- 💬 **Коррекция через диалог** → скажи «он бы так не сделал, он должен быть xxx» → записывается в слой коррекции, мгновенный эффект
- 🕰️ **Версионирование** → автоархивация при каждом обновлении, откат к любой предыдущей версии
- 🔬 **Celebrity research pipeline** → субтитры → очистка транскрипта → шестимерное исследование → проверка качества

---

## 📂 Структура проекта

Этот проект следует открытому стандарту [AgentSkills](https://agentskills.io). Весь репозиторий — это директория skill'а:

```
dot-skill/
├── SKILL.md                        # точка входа skill'а (официальный frontmatter)
├── prompts/                        # система промптов для трёх семейств
│   ├── intake.md                   #   [colleague] сбор информации
│   ├── work_analyzer.md            #   [colleague] извлечение рабочих компетенций
│   ├── persona_analyzer.md         #   [colleague] извлечение личности
│   ├── work_builder.md             #   [colleague] генерация work.md
│   ├── persona_builder.md          #   [colleague] 6-слойная структура persona.md
│   ├── merger.md                   #   [shared] логика инкрементального мержа
│   ├── correction_handler.md       #   [shared] коррекция через диалог
│   ├── relationship/               #   [relationship] промпты эмоций/конфликтов/восстановления
│   └── celebrity/                  #   [celebrity] шестимерное исследование + промпты ментальных моделей
├── tools/                          # Python-инструменты
│   ├── feishu_auto_collector.py    #   [colleague] автосборщик Feishu
│   ├── dingtalk_auto_collector.py  #   [colleague] автосборщик DingTalk
│   ├── slack_auto_collector.py     #   [colleague] автосборщик Slack
│   ├── email_parser.py             #   [shared] парсер писем
│   ├── research/                   #   [celebrity] исследовательский тулчейн
│   │   ├── download_subtitles.sh   #     скачивание субтитров
│   │   ├── transcribe_audio.py     #     аудио → текст
│   │   ├── srt_to_transcript.py    #     субтитры → транскрипт
│   │   ├── merge_research.py       #     мерж шестимерного исследования
│   │   └── quality_check.py        #     проверка качества
│   ├── install_*_skill.py          #   [shared] установщики для разных хостов в одну команду
│   ├── skill_writer.py             #   [shared] управление файлами skill'а
│   └── version_manager.py          #   [shared] версионный архив и откат
├── skills/                         # сгенерированные Skill'ы (в gitignore)
│   ├── colleague/                  #   коллеги
│   ├── relationship/               #   близкие отношения
│   └── celebrity/                  #   публичные фигуры
├── docs/PRD.md
├── requirements.txt
└── LICENSE
```

---

## ⚠️ Примечания

**Качество исходников = качество Skill'а** — и что считается качественным источником, у семейств разное:

| Семейство | Приоритет источников (от высокого к низкому) |
|-----------|----------------------------------------------|
| 🧑‍💼 **colleague** | **Их собственные длинные тексты** (дизайн-доки / ревью-комменты) **›** **ответы с принятием решений** **›** повседневный групповой чат |
| 💞 **relationship** | Полная история переписки **›** письма / посты в соцсетях / дневники **›** описания третьих лиц |
| 🌟 **celebrity** | Книги / блоги / длинные интервью от первого лица **›** записи решений (запуски, коммиты, Q&A) **›** сторонние комментарии |

- **colleague** автосбор Feishu: требует, чтобы App-бот был добавлен в нужные групповые чаты
- **relationship**: чем длиннее временной охват — тем лучше; идеально — материалы, покрывающие и конфликт, и восстановление
- **celebrity**: не корми только пересказами из вторых рук
- Это всё ещё демо-версия — если найдёшь баги, заводи issues!

---

## 📄 Технический отчёт

> **[Colleague.Skill: Automated AI Skill Generation via Expert Knowledge Distillation](../../colleague_skill.pdf)**
>
> Это статья про **colleague.skill**, предшественника dot-skill. Она описывает двухслойную архитектуру Work Skill + Persona, мультиисточниковый сбор данных и механику генерации Skill'ов — теоретическую основу сегодняшнего семейства `colleague`. Отдельные статьи по расширениям на семейства relationship / celebrity — в планах.

---

## ⭐ Star History

<a href="https://www.star-history.com/?repos=titanwings%2Fcolleague-skill&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/image?repos=titanwings/colleague-skill&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/image?repos=titanwings/colleague-skill&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/image?repos=titanwings/colleague-skill&type=date&legend=top-left" />
 </picture>
</a>

---

<div align="center">

**MIT License** © [titanwings](https://github.com/titanwings)

<sub>Сделано с 🧬 для всех, кто хочет дистиллировать человека в навык.</sub>

</div>
