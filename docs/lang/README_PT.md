<div align="center">

# dot-skill

> *"Vocês que constroem LLMs são todos códigos-sábios! A carne é fraca! Ascendam ao ciberespaço!"*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python 3.9+](https://img.shields.io/badge/Python-3.9%2B-blue.svg)](https://python.org)
[![AgentSkills](https://img.shields.io/badge/AgentSkills-Standard-green)](https://agentskills.io)

[![Claude Code](https://img.shields.io/badge/Claude%20Code-Skill-blueviolet)](https://claude.ai/code)
[![Hermes](https://img.shields.io/badge/Hermes-Skill-orange)](https://github.com/titanwings/colleague-skill)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-Skill-teal)](https://github.com/titanwings/colleague-skill)
[![Codex](https://img.shields.io/badge/Codex-Skill-black)](https://github.com/titanwings/colleague-skill)

[![Discord](https://img.shields.io/badge/Discord-Join%20Community-5865F2?logo=discord&logoColor=white)](https://discord.gg/aRjmJBdK)

<br>

Seu colega pediu demissão, seu mentor se formou, seu parceiro de time foi transferido — levando junto todo o playbook e contexto?<br>
Sua família, amigos antigos, seu parceiro(a) se distanciando — e você quer preservar o jeito que era estar com eles?<br>
Seu autor favorito, ídolo, pensador que você nunca vai conhecer — mas quer saber o que eles diriam sobre a sua pergunta?<br>

**dot-skill resolve os três.**

<br>

Evoluído de **colleague.skill** para **dot-skill** — não só colegas, **qualquer pessoa** pode ser destilada num Skill<br>
Colegas · parceiros · família · amigos antigos · ídolos · figuras públicas · personagens fictícios — até você mesmo<br>
Forneça material fonte + sua descrição → receba um **AI Skill que realmente pensa como eles**<br>
Pensa no frame deles, fala na voz deles

[Novidades](#o-que-há-de-novo-nesta-grande-versão) · [Fontes de dados](#fontes-de-dados-suportadas) · [Instalação](#instalação) · [Uso](#uso) · [Demo](#demo) · [💬 Discord](https://discord.gg/aRjmJBdK)

[**中文**](README_ZH.md) · [**English**](../../README.md) · [**Español**](README_ES.md) · [**Deutsch**](README_DE.md) · [**日本語**](README_JA.md) · [**Русский**](README_RU.md) · **Português** · [**한국어**](README_KO.md)

</div>

---

## O que há de novo nesta grande versão?

### 1. De colleague-skill para dot-skill

Não é mais construído apenas em torno do cenário de "colega". Um ponto de entrada unificado `/dot-skill` roda sobre um motor de skills de propósito geral — um único motor destila qualquer pessoa, em vez de ser um script específico para colegas.

### 2. Três famílias de personagens

| Família | Para quem serve | Exemplos |
|---------|-----------------|----------|
| **colleague** | Colegas de trabalho, mentores, parceiros de time, parceiros upstream/downstream | Engenheiro backend L2-1 da ByteDance, seu mentor |
| **relationship** | Ex-parceiros, parceiros atuais, pais, amigos, família próxima | Colega de quarto da faculdade, primeiro amor, sua mãe |
| **celebrity** | Figuras públicas, criadores, vozes públicas, pensadores | 罗翔, Steve Jobs, personagens fictícios |

Cada família tem o próprio pipeline de prompts, estratégia de coleta de fontes e template de geração:

- **`colleague`** — construído sobre a arquitetura de duas camadas Work Skill + Persona. Aprende tanto os padrões técnicos e workflows quanto o jeito de falar e a postura profissional. Suporta coleta automática em Feishu / DingTalk / Slack.
- **`celebrity`** — vem com uma cadeia de ferramentas de pesquisa em seis dimensões completa (download de legendas → limpeza de transcrição → merge de pesquisa → checagem de qualidade). Não é imitar o tom — é reproduzir os modelos mentais e frameworks de decisão.
- **`relationship`** 🆕 **Recurso de compartilhamento de fotos em breve** — sua relação destilada não vai só responder mensagens; ela vai mandar fotos e compartilhar pedaços do dia, do jeito que uma pessoa real faria.

### 3. Mais hosts de Agent

A versão antiga rodava só no Claude Code. Agora é cross-host em quatro:

- **Claude Code** — suporte nativo a slash commands
- **Hermes Agent** — instalação em um comando, `/dot-skill` funciona direto
- **OpenClaw** — totalmente compatível
- **Codex** — invoque pelo nome da skill

Skills de personagens gerados também podem ser instalados em qualquer host com um único comando.

---

> 🆕 **Atualização 2026.04.19** — **Grupo 5 do WeChat no ar!** Venha curtir a comunidade dot-skill — compartilhe skills, discuta funcionalidades, troque dicas.
>
> <img src="../assets/wechat-group-qr-5.png" alt="QR do grupo WeChat dot-skill" width="240">
>
> O QR renova a cada 7 dias (expira em 2026-04-24) — se expirar, me chame no Discord.

> 🆕 **Atualização 2026.04.13** — **O Roadmap do dot-skill está no ar!** colleague.skill está evoluindo para **dot-skill** — destile qualquer pessoa, não apenas colegas.
>
> 👉 **[Leia o Roadmap completo](../../ROADMAP.md)** · **[💬 Discord](https://discord.gg/aRjmJBdK)**

> 🆕 **Atualização 2026.04.07** — A galeria comunitária está no ar! Qualquer skill ou meta-skill pode direcionar tráfego diretamente para o seu próprio repositório do GitHub. Sem intermediários.
>
> 👉 **[titanwings.github.io/colleague-skill-site](https://titanwings.github.io/colleague-skill-site/)**

---

Created by [@titanwings](https://github.com/titanwings) | Powered by Shanghai AI Lab · AI Safety Center

## Fontes de dados suportadas

| Fonte | Mensagens | Docs / Wiki | Planilhas | Notas |
|-------|:---------:|:-----------:|:---------:|-------|
| Feishu (auto) | ✅ API | ✅ | ✅ | Basta digitar um nome, totalmente automático |
| DingTalk (auto) | ⚠️ Browser | ✅ | ✅ | A API do DingTalk não dá acesso ao histórico de mensagens |
| Slack (auto) | ✅ API | — | — | Precisa que o admin instale o Bot; plano gratuito limitado a 90 dias |
| Histórico do WeChat | ✅ SQLite | — | — | Exportar antes com WeChatMsg / PyWxDump / 留痕 |
| PDF / Imagens / Screenshots | — | ✅ | — | Upload manual |
| Export JSON do Feishu | ✅ | ✅ | — | Upload manual |
| Email `.eml` / `.mbox` | ✅ | — | — | Upload manual |
| Markdown / colar direto | ✅ | ✅ | — | Entrada manual |

---

## Instalação

É 2026 — você tem um Agent, deixa ele se instalar sozinho. Abra seu Claude Code / Hermes / OpenClaw / Codex e mande esta linha para ele:

> Instala a skill dot-skill pra mim: `https://github.com/titanwings/colleague-skill`

O Agent vai detectar o diretório de skills do host atual, clonar o repositório e registrar o ponto de entrada. Depois de pronto, digite `/dot-skill` em qualquer host para abrir.

<details>
<summary>Quer instalar na mão? Clique para ver os caminhos</summary>

```bash
git clone https://github.com/titanwings/colleague-skill <TARGET>
```

| Host | Caminho `<TARGET>` |
|------|--------------------|
| Claude Code | `~/.claude/skills/dot-skill` |
| OpenClaw | `~/.openclaw/workspace/skills/dot-skill` |
| Codex | `~/.codex/skills/dot-skill` |
| Hermes | Depois de clonar, rode `python3 tools/install_hermes_skill.py --force` |

</details>

> Para credenciais de coleta automática do Feishu/DingTalk, publicação de Skills de personagens gerados em qualquer host, tratamento específico do Windows, etc., veja o **[Guia de Instalação Detalhado (INSTALL.md)](../../INSTALL.md)**

---

## Uso

No host em que o dot-skill estiver instalado, inicie-o — digite `/dot-skill`, ou simplesmente diga ao seu Agent "inicia o dot-skill".

Ele primeiro pergunta qual família você quer destilar: `colleague`, `relationship` ou `celebrity`.

Depois, informe apelido, perfil básico, tags de personalidade e escolha uma fonte de dados. Todos os campos podem ser pulados — até mesmo só uma descrição já consegue gerar um Skill.

Uma vez criado, invoque o Skill gerado com `/{character}-{slug}`.

### Comandos

| Comando | Descrição |
|---------|-----------|
| `/dot-skill` | Ponto de entrada unificado canônico |
| `/{character}-{slug}` | Invoca o Skill completo (Persona + Work) |
| `/{character}-{slug}-work` | Apenas capacidades de trabalho |
| `/{character}-{slug}-persona` | Apenas personalidade |
| `python3 tools/skill_writer.py --action list ...` | Lista Skills gerados nas três famílias |
| `python3 tools/version_manager.py --action rollback ...` | Voltar uma versão do Skill |

### Celebrity Research Toolchain

A família `celebrity` vem com uma cadeia de pesquisa fim-a-fim, das legendas até o rascunho finalizado:

```bash
# Baixar legendas de vídeo
bash tools/research/download_subtitles.sh "<video-url>" "./tmp/subtitles"

# Legendas → transcrição
python3 tools/research/srt_to_transcript.py "./tmp/subtitles/example.srt"

# Merge das notas de pesquisa
python3 tools/research/merge_research.py "./skills/celebrity/<slug>"

# Checagem de qualidade
python3 tools/research/quality_check.py "./skills/celebrity/<slug>/SKILL.md"
```

---

## Demo

Um exemplo de cada família.

### celebrity — destilando Andrej Karpathy

> Pesquisa em seis dimensões: obras · entrevistas · decisões · DNA de expressão · avaliações externas · linha do tempo<br>
> Caso adaptado do trabalho comunitário [alchaincyf/karpathy-skill](https://github.com/alchaincyf/karpathy-skill)

```
Usuário         ❯ Todo mundo tá falando de Agents agora — como você imagina o AI Agent de 2026?

celebrity.skill ❯ Todo mundo faz demo, ninguém faz eval.
                  O gargalo do Agent nunca foi a inteligência do modelo — é o scaffolding:
                  um harness de avaliação rigoroso, replay de erros com granularidade fina,
                  orçamentos controláveis de tool-calling, análise limpa de modos de falha.
                  A maioria dos produtos ainda tá presa em "envelopa uma API + algumas tools + um system prompt."
                  Isso é demo, não é agent.
                  Em 2026 eu não aposto no modelo mais forte — aposto no melhor
                  scaffolding e no eval mais rigoroso.
```

### colleague — destilando um backend L2-1 da ByteDance

> Entrada: `engenheiro backend L2-1 da ByteDance, INTJ, empurra a responsabilidade, estilo ByteDance`

```
Usuário         ❯ Pode revisar esse design de API?

colleague.skill ❯ Peraí — qual é o impacto? Você não explicou o contexto.
                  (depois de ler) Query N+1, corrige isso. Usa o formato
                  padrão de resposta {code, message, data}. Isso é convenção,
                  não pergunta por quê.

Usuário         ❯ Esse bug foi você que introduziu, né?

colleague.skill ❯ A timeline bate? Essa feature mexeu em vários lugares,
                  teve outros commits também.
```

### relationship — destilando alguém por quem você tem uma queda

> Upload de meio ano de histórico de conversa + "sensível, quieto mas teimoso, responde de verdade quando é importante"

```
Usuário            ❯ Pensou em mim hoje?

relationship.skill ❯ ...pensei, um pouquinho. Por que tá perguntando?
```

> Mais casos do mundo real na [galeria comunitária](https://titanwings.github.io/colleague-skill-site/) — mais de 100 skills e contando.

---

## Funcionalidades

### Estrutura do Skill gerado

dot-skill usa **Persona** como a base universal, com módulos específicos de cada família em cima:

| Família | Conteúdo da Persona | Módulos Adicionais |
|---------|---------------------|---------------------|
| **colleague** | Personalidade em 6 camadas: regras rígidas → identidade → expressão → decisões → interpessoal → Correção | + **Work Skill**: escopo, workflow, preferências de output, base de conhecimento de experiência |
| **relationship** | DNA de expressão · gatilhos emocionais · padrão de conflito · padrão de reparo | — |
| **celebrity** | Modelos mentais · heurísticas de decisão · DNA de expressão · contraste com avaliação externa | + Dossiê de pesquisa em seis dimensões (obras/entrevistas/decisões/linha do tempo...) |

Execução: `Receber tarefa → Persona decide atitude e tom → Módulos adicionais preenchem o detalhe de execução → Output na voz dele`

### Evolução

- **Adicionar arquivos** → auto-análise de delta → merge nas seções relevantes, nunca sobrescreve conclusões existentes
- **Correção por conversa** → diga "ele não faria isso, ele seria xxx" → escreve na camada de Correção, efeito imediato
- **Controle de versão** → auto-arquivamento a cada atualização, rollback para qualquer versão anterior
- **Pipeline de pesquisa de celebrity** → legendas → limpeza de transcrição → pesquisa em seis dimensões → checagem de qualidade

---

## Estrutura do projeto

Este projeto segue o padrão aberto [AgentSkills](https://agentskills.io). O repositório inteiro é um diretório de skill:

```
dot-skill/
├── SKILL.md                        # ponto de entrada do skill (frontmatter oficial)
├── prompts/                        # sistema de prompts através das três famílias
│   ├── intake.md                   #   [colleague] intake de informação
│   ├── work_analyzer.md            #   [colleague] extração de capacidade de trabalho
│   ├── persona_analyzer.md         #   [colleague] extração de personalidade
│   ├── work_builder.md             #   [colleague] geração de work.md
│   ├── persona_builder.md          #   [colleague] estrutura em 6 camadas do persona.md
│   ├── merger.md                   #   [shared] lógica de merge incremental
│   ├── correction_handler.md       #   [shared] correção por conversa
│   ├── relationship/               #   [relationship] prompts de emoção/conflito/reparo
│   └── celebrity/                  #   [celebrity] pesquisa em seis dimensões + prompts de modelo mental
├── tools/                          # ferramentas Python
│   ├── feishu_auto_collector.py    #   [colleague] coletor automático do Feishu
│   ├── dingtalk_auto_collector.py  #   [colleague] coletor automático do DingTalk
│   ├── slack_auto_collector.py     #   [colleague] coletor automático do Slack
│   ├── email_parser.py             #   [shared] parser de email
│   ├── research/                   #   [celebrity] cadeia de pesquisa de celebrity
│   │   ├── download_subtitles.sh   #     download de legendas
│   │   ├── transcribe_audio.py     #     áudio → texto
│   │   ├── srt_to_transcript.py    #     legendas → transcrição
│   │   ├── merge_research.py       #     merge de pesquisa em seis dimensões
│   │   └── quality_check.py        #     checagem de qualidade
│   ├── install_*_skill.py          #   [shared] instaladores one-shot multi-host
│   ├── skill_writer.py             #   [shared] gestão de arquivos de skill
│   └── version_manager.py          #   [shared] arquivamento e rollback de versões
├── skills/                         # Skills gerados (gitignored)
│   ├── colleague/                  #   colegas
│   ├── relationship/               #   relações próximas
│   └── celebrity/                  #   figuras públicas
├── docs/PRD.md
├── requirements.txt
└── LICENSE
```

---

## Observações

- **Qualidade do material fonte = Qualidade do Skill** — e as boas fontes variam conforme a família:
  - **colleague**: **textos longos escritos pela própria pessoa** (docs de design / comentários de review) > **respostas de tomada de decisão** > chat casual em grupo; a coleta automática do Feishu requer adicionar o bot do App aos grupos relevantes
  - **relationship**: histórico completo de conversa > cartas / posts em redes sociais / diários > descrições de terceiros; janelas de tempo mais longas são melhores, e material cobrindo tanto conflito quanto reparo é ideal
  - **celebrity**: livros em primeira pessoa / blogs / entrevistas longas > registros de decisão (lançamentos, commits de código, Q&A) > comentários de terceiros; evite alimentar só interpretações de segunda mão
- Esta ainda é uma versão demo — por favor crie issues se encontrar bugs!

---

### 📄 Relatório Técnico

> **[Colleague.Skill: Automated AI Skill Generation via Expert Knowledge Distillation](../../colleague_skill.pdf)**
>
> Este é o paper do **colleague.skill**, antecessor do dot-skill. Ele cobre a arquitetura de duas camadas Work Skill + Persona, coleta de dados multi-fonte e a mecânica de geração de Skills — a base teórica da família `colleague` atual. Papers separados sobre as extensões das famílias relationship / celebrity estão planejados.

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
