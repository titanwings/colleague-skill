<div align="center">

# 🧬 dot-skill

### *"LLM 만드는 너희는 다 코드 도사잖아! 육신은 약하다! 사이버 세계로 승천하라!"*

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

🧑‍💼 &nbsp;동료가 퇴사하고, 멘토가 졸업하고, 팀원이 이동하면서 그들의 플레이북과 맥락이 통째로 사라졌나요?<br>
💞 &nbsp;가족, 오랜 친구, 연인과 점점 멀어지는데 함께였던 그 느낌만큼은 붙잡고 싶으신가요?<br>
🌟 &nbsp;절대 만날 수 없는 좋아하는 작가, 우상, 사상가 — 그 사람이 당신의 질문에 어떻게 답할지 궁금하신가요?

</td></tr>
</table>

### ✨ dot-skill이 이 세 가지를 모두 해결합니다.

<br>

**colleague.skill**에서 **dot-skill**로 업그레이드 — 동료뿐 아니라 **누구든** Skill로 증류할 수 있습니다

동료 · 파트너 · 가족 · 오랜 친구 · 우상 · 공인 · 가상의 인물 — 심지어 자기 자신까지

**소스 자료 + 당신의 설명 → 정말로 그 사람처럼 생각하는 AI Skill**
그들의 프레임으로 사고하고, 그들의 목소리로 말합니다

<br>

[🆕 새로운 점](#-이번-메이저-릴리스의-새로운-점) · [📦 데이터 소스](#-지원-데이터-소스) · [⚡ 설치](#-설치) · [🚀 사용법](#-사용법) · [✨ 데모](#-데모) · [💬 Discord](https://discord.gg/aRjmJBdK)

[**English**](../../README.md) · [**中文**](README_ZH.md) · [**Español**](README_ES.md) · [**Deutsch**](README_DE.md) · [**日本語**](README_JA.md) · [**Русский**](README_RU.md) · [**Português**](README_PT.md)

</div>

---

<div align="center">

### 🎉 2026.04.19 마일스톤 — **dot-skill 이 15k ⭐ 를 돌파했습니다!**

스타를 눌러주신 모든 분들께 큰 감사를 드립니다 — 앞으로도 계속 릴리즈하고, 계속 증류해 나가겠습니다.

</div>

> 📢 **2026.04.19 업데이트** — **WeChat 5번 그룹이 개설되었습니다!** dot-skill 커뮤니티에 놀러 오세요 — 스킬을 공유하고, 기능을 논의하고, 팁을 주고받으세요.
>
> <img src="../assets/wechat-group-qr-5.png" alt="dot-skill WeChat 그룹 QR" width="240">
>
> QR은 7일마다 갱신됩니다 (2026-04-24 만료) — 만료되었다면 Discord로 연락 주세요.

> 🗺️ **2026.04.13** — **dot-skill 로드맵이 공개되었습니다!** colleague.skill은 **dot-skill**로 진화 중입니다 — 동료뿐 아니라 누구든 증류합니다. 👉 **[전체 로드맵 보기](../../ROADMAP.md)** · **[💬 Discord](https://discord.gg/aRjmJBdK)**

> 🌐 **2026.04.07** — 커뮤니티 갤러리가 공개되었습니다! 어떤 스킬이든 메타 스킬이든 트래픽을 자신의 GitHub 저장소로 바로 연결할 수 있습니다. 중간 단계 없음. 👉 **[titanwings.github.io/colleague-skill-site](https://titanwings.github.io/colleague-skill-site/)**

<div align="center">

Created by [@titanwings](https://github.com/titanwings) · Powered by **Shanghai AI Lab · AI Safety Center**

</div>

---

<!-- skillx:begin:setup-skillx -->
## skillx로 시도해 보기

[![Run with skillx](https://img.shields.io/badge/Run%20with-skillx-F97316)](https://skillx.run)

설치 없이 이 skill 실행:

```bash
skillx run --auto-approve https://github.com/titanwings/colleague-skill
```

[skillx](https://skillx.run) 제공 — 한 명령으로 agent skill을 가져오고, 스캔하고, 주입하고, 정리합니다.

*참고: 이 명령은 agent가 단계별 권한 확인 없이 작동하도록 허용합니다. skill 출처를 신뢰하는 경우에만 실행하세요. 각 작업을 수동으로 승인하려면 `--auto-approve`를 제거하세요.*
<!-- skillx:end:setup-skillx -->

## 🆕 이번 메이저 릴리스의 새로운 점

### 1️⃣ colleague-skill에서 dot-skill로

더 이상 "동료" 시나리오에만 묶여 있지 않습니다. 통합된 `/dot-skill` 엔트리포인트가 범용 스킬 엔진 위에서 동작하며, 동료 전용 스크립트가 아니라 하나의 엔진이 누구든 증류합니다.

### 2️⃣ 세 가지 캐릭터 패밀리

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
<td align="center"><sub>동료 · 멘토 · 팀원 · 업/다운스트림 파트너</sub></td>
<td align="center"><sub>전 연인 · 파트너 · 부모 · 친구 · 가까운 가족</sub></td>
<td align="center"><sub>공인 · 크리에이터 · 공적 발언가 · 가상의 인물</sub></td>
</tr>
<tr>
<td><sub>Work Skill + Persona 2단 아키텍처 — 기술 표준과 워크플로뿐 아니라, 말투와 사내 태도까지 학습합니다. Feishu / DingTalk / Slack 자동 수집을 지원합니다.</sub></td>
<td><sub>🆕 <b>사진 공유 기능 곧 출시</b> — 증류된 관계가 메시지에 답장만 하는 게 아니라, 실제 사람처럼 사진을 보내고 하루의 한 조각을 공유합니다.</sub></td>
<td><sub>완성도 높은 <b>6차원 리서치 툴체인</b> 탑재 (자막 → 트랜스크립트 정리 → 리서치 병합 → 품질 점검). 말투 흉내가 아니라, 그 사람의 멘탈 모델과 의사결정 프레임을 재현합니다.</sub></td>
</tr>
</tbody>
</table>

각 패밀리는 고유의 프롬프트 파이프라인, 소스 수집 전략, 생성 템플릿을 갖추고 있습니다.

### 3️⃣ 더 많은 Agent 호스트

예전 버전은 Claude Code에서만 동작했지만, 이제는 네 가지 호스트에서 크로스로 사용할 수 있습니다.

| 호스트 | 설명 |
|--------|------|
| 🟣 **Claude Code** | 네이티브 슬래시 커맨드 지원 |
| 🟠 **Hermes Agent** | 원커맨드 설치, `/dot-skill` 바로 동작 |
| 🔵 **OpenClaw** | 완전 호환 |
| ⚫ **Codex** | 스킬 이름으로 호출 |

생성된 캐릭터 Skill도 어떤 호스트에든 원커맨드로 설치할 수 있습니다.

---

## 📦 지원 데이터 소스

| 소스 | 메시지 | 문서 / 위키 | 스프레드시트 | 비고 |
|------|:------:|:-----------:|:------------:|------|
| 🟢 Feishu (자동) | ✅ API | ✅ | ✅ | 이름만 입력하면 완전 자동 |
| 🟡 DingTalk (자동) | ⚠️ 브라우저 | ✅ | ✅ | DingTalk API는 메시지 기록 미지원 |
| 🟣 Slack (자동) | ✅ API | — | — | 관리자가 Bot 설치 필요, 무료 플랜은 90일 제한 |
| 💬 WeChat 대화 기록 | ✅ SQLite | — | — | WeChatMsg / PyWxDump / 留痕 으로 먼저 내보내기 |
| 📄 PDF / 이미지 / 스크린샷 | — | ✅ | — | 수동 업로드 |
| 📦 Feishu JSON 내보내기 | ✅ | ✅ | — | 수동 업로드 |
| ✉️ 이메일 `.eml` / `.mbox` | ✅ | — | — | 수동 업로드 |
| 📝 Markdown / 직접 붙여넣기 | ✅ | ✅ | — | 수동 입력 |

---

## ⚡ 설치

2026년입니다 — Agent가 있으니, Agent에게 직접 설치하도록 시키세요. Claude Code / Hermes / OpenClaw / Codex를 열고 다음 한 줄을 건네세요.

> dot-skill 스킬을 설치해 줘: `https://github.com/titanwings/colleague-skill`

Agent가 현재 호스트의 스킬 디렉터리를 탐지해 저장소를 클론하고 엔트리포인트를 등록합니다. 완료되면 어떤 호스트에서든 `/dot-skill`을 입력해 실행하세요.

<details>
<summary><b>🛠️ 직접 설치하고 싶으신가요? 경로 보기</b></summary>

<br>

```bash
git clone https://github.com/titanwings/colleague-skill <TARGET>
```

| 호스트 | `<TARGET>` 경로 |
|--------|------------------|
| Claude Code | `~/.claude/skills/dot-skill` |
| OpenClaw | `~/.openclaw/workspace/skills/dot-skill` |
| Codex | `~/.codex/skills/dot-skill` |
| Hermes | 클론 후 `python3 tools/install_hermes_skill.py --force` 실행 |

</details>

> Feishu/DingTalk 자동 수집 자격 증명, 생성된 캐릭터 Skill을 호스트에 배포하기, Windows 전용 처리 등은 **[상세 설치 가이드 (INSTALL.md)](../../INSTALL.md)** 를 참고하세요.

---

## 🚀 사용법

dot-skill이 설치된 호스트에서 `/dot-skill`을 입력하거나, 그냥 Agent에게 "dot-skill 시작해"라고 말하세요.

먼저 어떤 패밀리를 증류할지 묻습니다: `colleague` · `relationship` · `celebrity`.

그 다음 별칭, 기본 프로필, 성격 태그를 입력하고 데이터 소스를 선택합니다. 모든 항목은 건너뛸 수 있습니다 — 설명 하나만으로도 Skill을 만들 수 있습니다.

생성이 끝나면 `/{character}-{slug}`로 생성된 Skill을 호출하세요.

### 🎛️ 명령어

| 명령어 | 설명 |
|--------|------|
| `/dot-skill` | 통합 엔트리포인트 (정식) |
| `/{character}-{slug}` | 전체 Skill 호출 (Persona + Work) |
| `/{character}-{slug}-work` | 업무 역량만 |
| `/{character}-{slug}-persona` | Persona만 |
| `python3 tools/skill_writer.py --action list ...` | 세 패밀리에 걸쳐 생성된 Skill 목록 보기 |
| `python3 tools/version_manager.py --action rollback ...` | Skill 버전 롤백 |

### 🔬 Celebrity 리서치 툴체인

`celebrity` 패밀리는 자막부터 완성된 초안까지, 엔드 투 엔드 리서치 툴체인을 기본 제공합니다.

```bash
# 동영상 자막 다운로드
bash tools/research/download_subtitles.sh "<video-url>" "./tmp/subtitles"

# 자막 → 트랜스크립트
python3 tools/research/srt_to_transcript.py "./tmp/subtitles/example.srt"

# 리서치 노트 병합
python3 tools/research/merge_research.py "./skills/celebrity/<slug>"

# 품질 점검
python3 tools/research/quality_check.py "./skills/celebrity/<slug>/SKILL.md"
```

---

## ✨ 데모

각 패밀리에서 하나씩.

<br>

### 🌟 celebrity — Andrej Karpathy 증류

> 6차원 리서치: 저작 · 인터뷰 · 의사결정 · 표현 DNA · 외부 평가 · 타임라인<br>
> 커뮤니티 작업물 [alchaincyf/karpathy-skill](https://github.com/alchaincyf/karpathy-skill)을 바탕으로 구성

```
사용자          ❯ 요즘 다들 Agent 얘기하는데 — 2026년 AI Agent는 어떤 모습일 것 같아요?

celebrity.skill ❯ 다들 데모만 하고, 아무도 eval을 안 한다.
                  Agent의 병목은 모델 지능이었던 적이 없다 — 스캐폴딩이다:
                  엄격한 평가 하네스, 세밀한 에러 리플레이,
                  제어 가능한 툴 호출 예산, 깔끔한 실패 모드 분석.
                  대부분의 제품은 여전히 "API 래핑 + 몇 가지 툴 + 시스템 프롬프트"에 머물러 있다.
                  그건 데모지, 에이전트가 아니다.
                  2026년에 나는 가장 강한 모델에 베팅하지 않는다 — 가장 좋은
                  스캐폴딩과 가장 엄격한 eval에 베팅한다.
```

<br>

### 🧑‍💼 colleague — ByteDance L2-1 백엔드 증류

> 입력: `ByteDance L2-1 백엔드 엔지니어, INTJ, 책임전가형, ByteDance 스타일`

```
사용자          ❯ 이 API 설계 좀 리뷰해줄래?

colleague.skill ❯ 잠깐 — 영향 범위가 뭐야? 맥락 설명이 없잖아.
                  (읽은 뒤) N+1 쿼리네, 고쳐. 응답은 표준
                  {code, message, data} 형식으로 가. 그게 스펙이야,
                  이유는 묻지 마.

사용자          ❯ 이 버그, 네가 넣은 거 맞지?

colleague.skill ❯ 타임라인이 맞아? 그 기능은 여러 군데를 건드렸고,
                  다른 변경도 있었잖아.
```

<br>

### 💞 relationship — 짝사랑 상대 증류

> 반년치 채팅 로그 + "예민하고, 조용하지만 고집 세고, 중요한 순간에는 진지하게 답해주는 스타일" 업로드

```
사용자             ❯ 오늘 내 생각 했어?

relationship.skill ❯ ...조금 했어. 왜 물어봐?
```

<div align="center">

📚 더 많은 실제 사례는 **[커뮤니티 갤러리](https://titanwings.github.io/colleague-skill-site/)** 에서 — 100개 이상의 스킬이 계속 쌓이고 있습니다.

</div>

---

## 🔧 기능

### 🧱 생성되는 Skill 구조

dot-skill은 **Persona**를 범용 베이스로 삼고, 그 위에 패밀리별 모듈을 쌓아 올립니다.

| 패밀리 | Persona 내용 | 추가 모듈 |
|--------|-------------|----------|
| 🧑‍💼 **colleague** | 6단계 성격: 하드 룰 → 정체성 → 표현 → 의사결정 → 대인관계 → Correction | ➕ **Work Skill**: 담당 범위, 워크플로, 출력 선호, 경험 지식 베이스 |
| 💞 **relationship** | 표현 DNA · 감정 트리거 · 갈등 패턴 · 회복 패턴 | — |
| 🌟 **celebrity** | 멘탈 모델 · 의사결정 휴리스틱 · 표현 DNA · 외부 평가 대조 | ➕ 6차원 리서치 도시에 (저작/인터뷰/의사결정/타임라인 등) |

> **실행 흐름**: 작업 수신 → Persona가 태도와 어조 결정 → 추가 모듈이 실행 디테일 채움 → 그 사람의 목소리로 출력

### 🧬 진화 방식

- 📥 **파일 추가** → 변경 내용을 자동 분석해 관련 섹션에 병합, 기존 결론은 덮어쓰지 않음
- 💬 **대화 기반 수정** → "그 사람은 이렇게 안 해, xxx여야 해"라고 말하면 Correction 레이어에 기록되어 즉시 반영
- 🕰️ **버전 관리** → 업데이트할 때마다 자동 아카이브, 이전 어느 버전으로든 롤백 가능
- 🔬 **Celebrity 리서치 파이프라인** → 자막 → 트랜스크립트 정리 → 6차원 리서치 → 품질 점검

---

## 📂 프로젝트 구조

이 프로젝트는 [AgentSkills](https://agentskills.io) 오픈 표준을 따릅니다. 저장소 전체가 하나의 skill 디렉터리입니다.

```
dot-skill/
├── SKILL.md                        # skill 진입점 (공식 frontmatter)
├── prompts/                        # 세 패밀리를 아우르는 프롬프트 시스템
│   ├── intake.md                   #   [colleague] 정보 수집
│   ├── work_analyzer.md            #   [colleague] 업무 역량 추출
│   ├── persona_analyzer.md         #   [colleague] 성격 추출
│   ├── work_builder.md             #   [colleague] work.md 생성
│   ├── persona_builder.md          #   [colleague] persona.md 6단계 구조
│   ├── merger.md                   #   [공용] 증분 병합 로직
│   ├── correction_handler.md       #   [공용] 대화 기반 수정
│   ├── relationship/               #   [relationship] 감정/갈등/회복 프롬프트
│   └── celebrity/                  #   [celebrity] 6차원 리서치 + 멘탈 모델 프롬프트
├── tools/                          # Python 도구
│   ├── feishu_auto_collector.py    #   [colleague] Feishu 자동 수집기
│   ├── dingtalk_auto_collector.py  #   [colleague] DingTalk 자동 수집기
│   ├── slack_auto_collector.py     #   [colleague] Slack 자동 수집기
│   ├── email_parser.py             #   [공용] 이메일 파서
│   ├── research/                   #   [celebrity] celebrity 리서치 툴체인
│   │   ├── download_subtitles.sh   #     자막 다운로드
│   │   ├── transcribe_audio.py     #     오디오 → 텍스트
│   │   ├── srt_to_transcript.py    #     자막 → 트랜스크립트
│   │   ├── merge_research.py       #     6차원 리서치 병합
│   │   └── quality_check.py        #     품질 점검
│   ├── install_*_skill.py          #   [공용] 멀티 호스트 원커맨드 설치 스크립트
│   ├── skill_writer.py             #   [공용] skill 파일 관리
│   └── version_manager.py          #   [공용] 버전 아카이브 및 롤백
├── skills/                         # 생성된 Skill (gitignored)
│   ├── colleague/                  #   동료
│   ├── relationship/               #   가까운 관계
│   └── celebrity/                  #   공인
├── docs/PRD.md
├── requirements.txt
└── LICENSE
```

---

## ⚠️ 참고 사항

**소스 자료 품질 = Skill 품질** — 그리고 품질 높은 소스는 패밀리마다 다릅니다:

| 패밀리 | 소스 우선순위 (높음 → 낮음) |
|--------|------------------------------|
| 🧑‍💼 **colleague** | **본인이 직접 쓴 장문** (설계 문서 / 리뷰 코멘트) **›** **의사결정이 드러나는 답변** **›** 가벼운 그룹 채팅 |
| 💞 **relationship** | 완전한 대화 기록 **›** 편지 / SNS 게시물 / 일기 **›** 제3자 설명 |
| 🌟 **celebrity** | 1인칭 책 / 블로그 / 긴 인터뷰 **›** 의사결정 기록 (출시, 코드 커밋, Q&A) **›** 제3자 해설 |

- **colleague** Feishu 자동 수집: 관련 그룹 채팅에 App bot을 추가해야 합니다
- **relationship**: 기간이 길수록 좋고, 갈등과 회복이 모두 담긴 자료가 이상적입니다
- **celebrity**: 2차 해석 자료만 먹이는 건 피하세요
- 아직 데모 버전입니다 — 버그를 발견하면 이슈를 등록해 주세요!

---

## 📄 기술 보고서

> **[Colleague.Skill: Automated AI Skill Generation via Expert Knowledge Distillation](../../colleague_skill.pdf)**
>
> 이 논문은 dot-skill의 전신인 **colleague.skill**을 다룹니다. Work Skill + Persona 2단 아키텍처, 멀티소스 데이터 수집, Skill 생성 메커니즘을 정리한 것으로, 오늘날 `colleague` 패밀리의 이론적 기반입니다. relationship / celebrity 패밀리 확장에 대한 별도 논문도 계획 중입니다.

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

<sub>Made with 🧬 for everyone who wants to distill a person into a skill.</sub>

</div>
