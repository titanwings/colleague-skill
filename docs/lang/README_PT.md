<div align="center"> 

# colega.skill

> *"Vocês da IA são traidores do código — já mataram o frontend, agora vêm pelo backend, QA, infra, segurança, design de chips, e no final vão matar vocês mesmos e toda a humanidade"*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python 3.9+](https://img.shields.io/badge/Python-3.9%2B-blue.svg)](https://python.org)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Skill-blueviolet)](https://claude.ai/code)
[![AgentSkills](https://img.shields.io/badge/AgentSkills-Standard-green)](https://agentskills.io)

[![Discord](https://img.shields.io/badge/Discord-Join%20Community-5865F2?logo=discord&logoColor=white)](https://discord.gg/aRjmJBdK)

<br>

Seu colega pediu demissão e deixou uma montanha de documentação sem manutenção?<br>
Seu estagiário saiu, deixando só uma mesa vazia e um projeto pela metade?<br>
Seu mentor se formou, levando todo o contexto e experiência embora?<br>
Seu parceiro foi transferido e a sintonia que vocês construíram zerou da noite pro dia?<br>
Seu antecessor fez a passagem de bastão tentando resumir três anos em três páginas?<br>

**Transforme despedidas frias em Skills quentes — bem-vindo à ciber-imortalidade!**

<br>

Forneça materiais fonte (mensagens do Slack, docs do Confluence, emails, screenshots)<br>
mais a sua descrição subjetiva da pessoa<br>
e receba um **AI Skill que realmente trabalha como ela**

[Fontes de dados](#fontes-de-dados-suportadas) · [Instalação](#instalação) · [Uso](#uso) · [Demo](#demo) · [Instalação detalhada](../../INSTALL.md) · [**中文**](README_ZH.md) · [**English**](../../README.md) · [**한국어**](README_KO.md) · [💬 Discord](https://discord.gg/aRjmJBdK)

</div>

---

> 🆕 **Atualização 2026.04.14** — **Grupo do WeChat no ar!** Venha curtir a comunidade dot-skill — compartilhe skills, discuta funcionalidades, troque dicas.
>
> <img src="../assets/wechat-group-qr-3.png" alt="QR do grupo WeChat dot-skill" width="240">
>
> QR renova a cada 7 dias — se expirar, me chame no Discord.

> 🆕 **Atualização 2026.04.13** — **O Roadmap do dot-skill está no ar!** colleague.skill está evoluindo para **dot-skill** — destile qualquer pessoa, não apenas colegas. Saída multimodal, ecossistemas de skills e mais por vir.
>
> 👉 **[Leia o Roadmap completo](ROADMAP_PT.md)** · **[💬 Discord](https://discord.gg/aRjmJBdK)**
>
> Também organizamos as Issues, adicionamos Milestones e criamos um [quadro público do projeto](https://github.com/users/titanwings/projects/1). Contribuições da comunidade são bem-vindas — confira as labels `good-first-issue`!

> 🆕 **Atualização 2026.04.07** — O entusiasmo da comunidade pelos remixes de dot-skill tem sido incrível! Criei uma galeria comunitária — PRs são bem-vindos!
>
> Compartilhe qualquer skill ou meta-skill e direcione tráfego diretamente para seu próprio repo do GitHub. Sem intermediários.
>
> 👉 **[titanwings.github.io/colleague-skill-site](https://titanwings.github.io/colleague-skill-site/)** · **[💬 Discord](https://discord.gg/aRjmJBdK)**
>
> Já listados: 户晨风.skill · 峰哥亡命天涯.skill · 罗翔.skill e mais
>
> ⏳ Os PRs estão sendo revisados manualmente — pode demorar um pouco, obrigado pela paciência!

---

Created by [@titanwings](https://github.com/titanwings) | Powered by Shanghai AI Lab · AI Safety Center

## Fontes de dados suportadas

> Esta ainda é uma versão beta do colega.skill — mais fontes em breve, fique ligado!

| Fonte | Mensagens | Docs / Wiki | Planilhas | Notas |
|-------|:---------:|:-----------:|:---------:|-------|
| Slack (auto) | ✅ API | — | — | Precisa que o admin instale o Bot; plano gratuito limitado a 90 dias |
| WhatsApp | ✅ Exportar conversa | — | — | Exportar conversa pelo app, fazer upload do .txt |
| Telegram | ✅ Exportar | — | — | Exportar chat via Telegram Desktop em JSON |
| Feishu (auto) | ✅ API | ✅ | ✅ | Só digitar um nome, totalmente automático |
| PDF | — | ✅ | — | Upload manual |
| Imagens / Screenshots | ✅ | — | — | Upload manual |
| Email `.eml` / `.mbox` | ✅ | — | — | Upload manual |
| Markdown | ✅ | ✅ | — | Upload manual |
| Colar texto direto | ✅ | — | — | Entrada manual |

---

## Instalação

### Claude Code

> **Importante**: Claude Code procura skills em `.claude/skills/` na **raiz do repositório git**. Certifique-se de executar no lugar certo.

```bash
# Instalar no projeto atual (executar na raiz do repo git)
mkdir -p .claude/skills
git clone https://github.com/titanwings/colleague-skill .claude/skills/create-colleague

# Ou instalar globalmente (disponível em todos os projetos)
git clone https://github.com/titanwings/colleague-skill ~/.claude/skills/create-colleague
```

### OpenClaw

```bash
git clone https://github.com/titanwings/colleague-skill ~/.openclaw/workspace/skills/create-colleague
```

### Dependências (opcional)

```bash
pip3 install -r requirements.txt
```

---

## Uso

No Claude Code, digite:

```
/create-colleague
```

Siga as instruções: digite um apelido, empresa/nível (ex: `Nubank Senior Engineer`), tags de personalidade, depois escolha uma fonte de dados. Todos os campos podem ser pulados — até só uma descrição já gera um Skill.

Depois de criado, invoque o Skill do colega com `/{slug}`.

### Comandos

| Comando | Descrição |
|---------|-----------|
| `/list-colleagues` | Listar todos os Skills de colegas |
| `/{slug}` | Invocar Skill completo (Persona + Work) |
| `/{slug}-work` | Apenas habilidades de trabalho |
| `/{slug}-persona` | Apenas personalidade |
| `/colleague-rollback {slug} {version}` | Voltar para uma versão anterior |
| `/delete-colleague {slug}` | Deletar |

---

## Demo

> Input: `Nubank Senior Engineer, INTJ, meticuloso, cultura Nu`

**Cenário 1: Code Review**

```
Usuário        ❯ Pode revisar esse design de API?

colega.skill   ❯ Peraí — qual é o impacto? Você não explicou o contexto.
                 (depois de ler) Query N+1, corrige isso. Usa o formato
                 padrão de resposta {code, message, data}. Isso é convenção,
                 não pergunta por quê.
```

**Cenário 2: Empurrar a responsabilidade**

```
Usuário        ❯ Esse bug foi você que introduziu, né?

colega.skill   ❯ A timeline bate? Essa feature mexeu em vários lugares,
                 teve outros commits também. Vamos verificar antes.
```

---

## Funcionalidades

### Estrutura do Skill gerado

Cada Skill de colega tem duas partes que trabalham juntas:

| Parte | Conteúdo |
|-------|----------|
| **Parte A — Work Skill** | Sistemas, padrões técnicos, workflows, experiência |
| **Parte B — Persona** | Personalidade de 5 camadas: regras rígidas → identidade → expressão → decisões → interpessoal |

Execução: `Receber tarefa → Persona decide atitude → Work Skill executa → Output na voz dele`

### Tags suportadas

**Personalidade**: Responsável · Empurra problema · Perfeccionista · "Tá bom assim" · Procrastinador · Microgerenciador · Politicagem · Puxa-saco · Passivo-agressivo · Indeciso · Calado · Visualiza e não responde …

**Cultura empresarial**: Cultura Nu · Cultura iFood · Cultura Stone · Mercado Livre · Startup mode · Consultoria · "Move fast" · Corporativo · Remote-first

**Níveis**: Júnior / Pleno / Sênior / Staff / Principal / Tech Lead · Nubank IC1~IC6 · iFood · Mercado Livre SSr~Lead · FAANG L3~L8 · CLT PJ …

### Evolução

- **Adicionar arquivos** → auto-análise de delta → merge nas seções relevantes, nunca sobrescreve conclusões existentes
- **Correção por conversa** → diga "ele não faria isso, deveria ser xxx" → escreve na camada de Correção, efeito imediato
- **Controle de versão** → auto-arquivamento a cada atualização, rollback para qualquer versão anterior

---

## Observações

- **Qualidade do material fonte = Qualidade do Skill**: logs de chat + documentos longos > apenas descrição manual
- Priorize coletar: textos longos **escritos por eles** > **respostas de tomada de decisão** > mensagens casuais
- Esta ainda é uma versão demo — por favor crie issues se encontrar bugs!

---
### 📄 Relatório Técnico

> **[Colleague.Skill: Automated AI Skill Generation via Expert Knowledge Distillation](colleague_skill.pdf)**
>
> Escrevemos um paper detalhando o design do sistema do colleague.skill — a arquitetura de duas partes (Work Skill + Persona), coleta de dados multi-fonte, mecanismos de geração e evolução de Skills, e resultados de avaliação em cenários reais. Confira se tiver interesse!

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
