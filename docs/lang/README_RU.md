<div align="center"> 

# коллега.skill

> *«Вы, ИИ-шники, предатели кода — вы уже убили фронтенд, теперь идёте за бэкендом, QA, девопсами, безопасниками, чипами, а в конце убьёте себя и всё человечество»*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python 3.9+](https://img.shields.io/badge/Python-3.9%2B-blue.svg)](https://python.org)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Skill-blueviolet)](https://claude.ai/code)
[![AgentSkills](https://img.shields.io/badge/AgentSkills-Standard-green)](https://agentskills.io)

[![Discord](https://img.shields.io/badge/Discord-Join%20Community-5865F2?logo=discord&logoColor=white)](https://discord.gg/2bbP2a7f)

<br>

Коллега уволился, оставив гору недокументированного кода?<br>
Стажёр ушёл — пустой стол и недоделанный проект?<br>
Наставник уехал, забрав весь контекст и опыт?<br>
Напарник перевёлся, и сработанность обнулилась за ночь?<br>
Предшественник передал дела, попытавшись уместить три года в три страницы?<br>

**Преврати холодные прощания в тёплые Skill'ы — добро пожаловать в кибер-бессмертие!**

<br>

Предоставь исходные материалы (сообщения из Slack, документы из Confluence, письма, скриншоты)<br>
плюс своё субъективное описание человека<br>
и получи **AI Skill, который действительно работает как он**

[Источники данных](#поддерживаемые-источники-данных) · [Установка](#установка) · [Использование](#использование) · [Демо](#демо) · [Подробная установка](../../INSTALL.md) · [**中文**](README_ZH.md) · [**English**](../../README.md) · [**한국어**](README_KO.md) · [💬 Discord](https://discord.gg/2bbP2a7f)

</div>

---

> 🆕 **Обновление 2026.04.18** — **Группа WeChat 5 создана!** Присоединяйтесь к сообществу dot-skill — делитесь навыками, обсуждайте функции, обменивайтесь советами.
>
> <img src="../assets/wechat-group-qr-5.png" alt="QR-код группы WeChat dot-skill" width="240">
>
> QR обновляется каждые 7 дней — если истёк, пишите мне в Discord.

> 🆕 **Обновление 2026.04.13** — **Дорожная карта dot-skill опубликована!** colleague.skill превращается в **dot-skill** — дистиллируйте кого угодно, не только коллег. Мультимодальный вывод, экосистема навыков и многое другое уже в работе.
>
> 👉 **[Читать полную дорожную карту](ROADMAP_RU.md)** · **[💬 Discord](https://discord.gg/2bbP2a7f)**
>
> Мы также навели порядок в Issues, добавили Milestones и создали [публичную доску проекта](https://github.com/users/titanwings/projects/1). Приветствуем вклад сообщества — смотрите метки `good-first-issue`!

> 🆕 **Обновление 2026.04.07** — Энтузиазм сообщества по поводу ремиксов dot-skill невероятен! Я создал галерею сообщества — PR приветствуются!
>
> Делитесь любыми skill или meta-skill и привлекайте трафик прямо в свой GitHub-репозиторий. Без посредников.
>
> 👉 **[titanwings.github.io/colleague-skill-site](https://titanwings.github.io/colleague-skill-site/)** · **[💬 Discord](https://discord.gg/2bbP2a7f)**
>
> Уже включены: 户晨风.skill · 峰哥亡命天涯.skill · 罗翔.skill и другие
>
> ⏳ PR сейчас проверяются вручную — может быть немного медленно, спасибо за терпение!

---

Created by [@titanwings](https://github.com/titanwings) | Powered by Shanghai AI Lab · AI Safety Center

## Поддерживаемые источники данных

> Это пока бета-версия коллега.skill — скоро добавим больше источников, следите за обновлениями!

| Источник | Сообщения | Документы / Wiki | Таблицы | Примечания |
|----------|:---------:|:----------------:|:-------:|------------|
| Slack (авто) | ✅ API | — | — | Нужна установка бота админом; бесплатный план — 90 дней |
| Telegram | ✅ Экспорт | — | — | Экспорт чата через Telegram Desktop в JSON |
| Microsoft Teams | ✅ Экспорт | — | — | Экспорт чата через compliance или вручную |
| Feishu (авто) | ✅ API | ✅ | ✅ | Просто введи имя — полная автоматизация |
| PDF | — | ✅ | — | Ручная загрузка |
| Изображения / Скриншоты | ✅ | — | — | Ручная загрузка |
| Email `.eml` / `.mbox` | ✅ | — | — | Ручная загрузка |
| Markdown | ✅ | ✅ | — | Ручная загрузка |
| Вставить текст напрямую | ✅ | — | — | Ручной ввод |

---

## Установка

### Claude Code

> **Важно**: Claude Code ищет скиллы в `.claude/skills/` в **корне git-репозитория**. Убедись, что выполняешь команду в правильном месте.

```bash
# Установить в текущий проект (выполнить в корне git-репозитория)
mkdir -p .claude/skills
git clone https://github.com/titanwings/colleague-skill .claude/skills/create-colleague

# Или установить глобально (доступно во всех проектах)
git clone https://github.com/titanwings/colleague-skill ~/.claude/skills/create-colleague
```

### OpenClaw

```bash
git clone https://github.com/titanwings/colleague-skill ~/.openclaw/workspace/skills/create-colleague
```

### Зависимости (опционально)

```bash
pip3 install -r requirements.txt
```

---

## Использование

В Claude Code введи:

```
/create-colleague
```

Следуй инструкциям: введи имя, компания/уровень (например, `Яндекс Senior разработчик`), теги личности, затем выбери источник данных. Все поля можно пропустить — даже одного описания достаточно для генерации Skill.

После создания вызывай Skill коллеги через `/{slug}`.

### Команды

| Команда | Описание |
|---------|----------|
| `/list-colleagues` | Показать все Skill'ы коллег |
| `/{slug}` | Вызвать полный Skill (Persona + Work) |
| `/{slug}-work` | Только рабочие навыки |
| `/{slug}-persona` | Только личность |
| `/colleague-rollback {slug} {version}` | Откатить к предыдущей версии |
| `/delete-colleague {slug}` | Удалить |

---

## Демо

> Ввод: `Яндекс Senior разработчик, INTJ, перфекционист, яндексоид`

**Сценарий 1: Код-ревью**

```
Пользователь    ❯ Можешь посмотреть дизайн этого API?

коллега.skill   ❯ Погоди — а ТЗ где? Без контекста я не могу адекватно
                  оценить.
                  (после прочтения) N+1 запрос, исправь. Формат ответа
                  стандартный {code, message, data}. Это конвенция,
                  не обсуждается.
```

**Сценарий 2: Перевод стрелок**

```
Пользователь    ❯ Этот баг ты завёл, да?

коллега.skill   ❯ Таймлайн проверял? Там в этой фиче несколько мест менялось,
                  и другие коммиты были. Давай сначала разберёмся.
```

---

## Возможности

### Структура сгенерированного Skill

Каждый Skill коллеги состоит из двух частей:

| Часть | Содержание |
|-------|------------|
| **Часть A — Work Skill** | Системы, техстандарты, рабочие процессы, опыт |
| **Часть B — Persona** | 5-слойная личность: жёсткие правила → идентичность → стиль выражения → принятие решений → межличностное |

Логика: `Получить задачу → Persona определяет отношение → Work Skill выполняет → Вывод его голосом`

### Поддерживаемые теги

**Личность**: Ответственный · Перекидыватель · Перфекционист · "И так сойдёт" · Прокрастинатор · Токсичный менеджер · Интриган · Карьерист · Пассивно-агрессивный · Нерешительный · Молчун · Читает и не отвечает …

**Корпоративная культура**: Яндекс-стиль · VK-стиль · Тинькофф-стиль · Сбер-стиль · Стартап · Аутсорс-галера · "Move fast" · Бюрократия · Удалёнка-first

**Уровни**: Junior / Middle / Senior / Lead / Principal / CTO · Яндекс грейды · VK грейды · Тинькофф L1~L6 · Сбер 8~16 · FAANG L3~L8 …

### Эволюция

- **Добавить файлы** → автоанализ дельты → мерж в соответствующие секции, никогда не перезаписывает существующие выводы
- **Коррекция через диалог** → скажи «он бы так не сделал, он должен быть xxx» → записывается в слой коррекции, мгновенный эффект
- **Версионирование** → автоархивация при каждом обновлении, откат к любой предыдущей версии

---

## Примечания

- **Качество исходных материалов = качество Skill**: логи чатов + длинные документы > только ручное описание
- Приоритет в сборе: длинные тексты **написанные ими** > **ответы с принятием решений** > повседневные сообщения
- Это ещё демо-версия — если найдёшь баги, создавай issues!

---
### 📄 Технический отчёт

> **[Colleague.Skill: Automated AI Skill Generation via Expert Knowledge Distillation](colleague_skill.pdf)**
>
> Мы написали статью с подробным описанием системного дизайна colleague.skill — двухчастная архитектура (Work Skill + Persona), мультиисточниковый сбор данных, механизмы генерации и эволюции Skill'ов, а также результаты оценки в реальных сценариях. Если интересно — загляните!

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
