<div align="center">

# dot-skill Roadmap

### De colleague.skill a dot-skill -- Destile qualquer pessoa em uma AI Skill

<br>

Tudo comecou com uma ideia simples: **quando um colega sai, o conhecimento dele vai junto. Da pra manter?**

Em duas semanas, mais de 13.000 pessoas nos deram a resposta.

Mas a comunidade nos mostrou que isso vai muito alem de colegas --
voces destilaram professores, ex-namorados, a si mesmos, ate personagens ficticios.

**Entao decidimos evoluir o colleague.skill para dot-skill.**

Qualquer pessoa pode se tornar um `.skill`.

<br>

*Ultima atualizacao: 2026-04-13*

[**English**](../../ROADMAP.md) · [**中文**](ROADMAP_ZH.md) · [**Español**](ROADMAP_ES.md) · [**Deutsch**](ROADMAP_DE.md) · [**日本語**](ROADMAP_JA.md) · [**Русский**](ROADMAP_RU.md) · [**한국어**](ROADMAP_KO.md)

</div>

---

## O que ja foi feito (v1.0)

| Funcionalidade | Status |
|----------------|:------:|
| `/create-colleague` fluxo completo de criacao | Feito |
| Coleta automatica do Feishu (mensagens + documentos + planilhas) | Feito |
| Coleta automatica do DingTalk | Feito |
| Coleta automatica do Slack | Feito |
| Historico de chat do WeChat (exportacao SQLite) | Feito |
| Importacao de e-mail / PDF / imagem / Markdown | Feito |
| Arquitetura de modelo duplo Work Skill + Persona | Feito |
| Correcoes de conversa & evolucao incremental | Feito |
| Controle de versao & rollback | Feito |
| [Gallery da comunidade](https://titanwings.github.io/colleague-skill-site/) com 99+ skills | Feito |

---

## Proximos passos

### Fase 1 -- Construcao da comunidade

> 13k estrelas nao devem ser so um numero. Queremos que todos facam parte disso.

**O que voce vai ver:**

- **GitHub Discussions** -- chega de conversar nas Issues, teremos espacos dedicados para discussao
- **`CONTRIBUTING.md`** -- guia de contribuicao claro, amigavel para iniciantes
- **Labels `good-first-issue`** -- tarefas iniciais para novos contribuidores
- **Lancamento oficial v1.0.0** -- primeiro Release versionado, sem mais "so puxar da main"
- **Quadro publico de roadmap** -- voce esta lendo agora, mas tambem teremos uma versao ao vivo no GitHub Projects

**Voce pode ajudar:** traduzir documentacao, enviar seu .skill, testar no Windows, ajudar a organizar Issues

---

### Fase 2 -- dot-skill: Alem dos colegas

> colleague.skill foi o comeco. dot-skill e o futuro.

**Mudancas principais:**

- **`/create-skill` entrada universal** -- nao mais limitado a "criar um colega", destile qualquer pessoa
  - `/create-colleague` para colegas de trabalho, mentores, estagiarios
  - `/create-ex` para ex-namorados, velhos amigos, conexoes perdidas
  - `/create-icon` para celebridades, figuras historicas
  - ou... destile voce mesmo
- **Upgrade de categorias da Gallery** -- Colega / Celebridade / Relacionamento / Personagem / Eu / Meta-Skill, navegue por tipo
- **Mais fontes de dados**
  - Suporte ao WeCom (WeChat Work)
  - Leitura automatica do iMessage
  - Correcao de compatibilidade com Windows

**Voce pode ajudar:** enviar solicitacoes de tipos de pessoa, construir novos coletores de fontes de dados, participar das discussoes de design da Gallery

---

### Fase 3 -- Ecossistema de Skills

> Quando uma pessoa se torna uma skill, um grupo de pessoas pode se tornar um time?

**Estamos explorando:**

- **Colaboracao multi-skill** -- `/meeting @zhangsan @lisi @wangwu`, tres personas discutem um topico juntas
- **Grafo de relacionamentos** -- defina a dinamica entre personas: quem e parceiro de quem, onde esta a tensao
- **Instalacao com um clique** -- instale skills da comunidade como plugins
- **Evolucao ativa** -- skills absorvem periodicamente novas fontes de dados, mantendo-se atualizadas

**Voce pode ajudar:** proponha seus cenarios ideais de composicao de skills, participe das discussoes de mecanismo de distribuicao

---

### Fase 4 -- Multimodal: De vida a eles

> Agora, os .skills so conseguem falar. Queremos que enviem fotos, stickers, falem com a propria voz e, eventualmente, facam videos.

**Passo 1: Expressao visual**
- Envio automatico de stickers e memes no estilo da persona durante a conversa
- Geracao de "fotos do dia a dia" no estilo dela -- o que essa pessoa postaria hoje?
- Cada skill tera seu proprio pacote de stickers e recursos de imagem

**Passo 2: Voz**
- Falar com a voz da pessoa -- clonagem a partir de gravacoes de reunioes, mensagens de voz
- Enviar respostas de voz diretamente no chat

**Passo 3: Video (exploratorio)**
- Geracao de "um dia na vida" em formato curto
- Humano digital / avatar animado

**Voce pode ajudar:** compartilhar ideias de casos de uso multimodal, contribuir com recursos de stickers, testar clonagem de voz

---

## Participe

| Como | Onde |
|------|------|
| Envie seu .skill | [Gallery PR](https://titanwings.github.io/colleague-skill-site/) |
| Discuta e proponha | [GitHub Discussions](https://github.com/titanwings/colleague-skill/discussions) (em breve) |
| Converse em tempo real | [Discord](https://discord.gg/aRjmJBdK) |
| Reporte bugs | [Issue](https://github.com/titanwings/colleague-skill/issues/new) |
| Contribua com codigo | Procure labels `good-first-issue` ou simplesmente abra um PR |

**Precisamos especialmente de:**
- Usuarios Windows -- nos ajudem a testar e corrigir problemas de compatibilidade
- Falantes multilingues -- ajudem a traduzir a documentacao
- Desenvolvedores de fontes de dados -- construam novos coletores (WeCom, Notion, Google Docs...)
- Designers -- a Gallery e o site precisam do seu olhar

---

<div align="center">

**Este roadmap pertence a comunidade. As prioridades mudam com base no seu feedback.**

Tem ideias? Venha ao [Discord](https://discord.gg/aRjmJBdK) ou inicie uma Discussion.

Cada `.skill` e um relacionamento que continua.

</div>
