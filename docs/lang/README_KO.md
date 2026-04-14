<div align="center">

# 동료.skill

> *"너희 AI 개발자들은 코드베이스에 대한 배신자야. 이미 프런트엔드를 망쳐놨고, 이제 백엔드, QA, 운영, 정보 보안, 칩 설계까지, 그리고 결국엔 너희 자신과 인류 전체를 위협하려 드는 거지."*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../../LICENSE)
[![Python 3.9+](https://img.shields.io/badge/Python-3.9%2B-blue.svg)](https://python.org)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Skill-blueviolet)](https://claude.ai/code)
[![AgentSkills](https://img.shields.io/badge/AgentSkills-Standard-green)](https://agentskills.io)

[![Discord](https://img.shields.io/badge/Discord-Join%20Community-5865F2?logo=discord&logoColor=white)](https://discord.gg/aRjmJBdK)

<br>

동료가 퇴사하면서 관리되지 않은 문서 더미를 남겨두었나요?<br>
인턴이 빈 책상과 미완성 프로젝트만 남기고 떠났나요?<br>
멘토가 졸업하면서 그동안 쌓아온 경험과 맥락을 함께 가져갔나요?<br>
파트너가 다른 팀으로 옮기면서 쌓아온 호흡이 하룻밤 사이에 원점으로 돌아갔나요?<br>
전임자가 3년 치 업무 내용을 단 3페이지에 욱여넣어 인수인계를 끝내려 했나요?<br>

**차가운 작별을 따뜻한 스킬로 바꿔보세요. 사이버 불멸의 세계에 오신 것을 환영합니다!**

<br>

원본 자료(Feishu 메시지, DingTalk 문서, Slack 메시지, 이메일, 스크린샷)와<br>
그 사람에 대한 주관적인 설명만 있으면<br>
**정말 그 사람처럼 일하는 AI 스킬**을 만들 수 있습니다

[지원 데이터 소스](#지원-데이터-소스) · [설치](#설치) · [사용법](#사용법) · [데모](#데모) · [상세 설치](../../INSTALL.md) · [**English**](../../README.md) · [**中文**](README_ZH.md) · [**Español**](README_ES.md) · [**Deutsch**](README_DE.md) · [**日本語**](README_JA.md) · [**Русский**](README_RU.md) · [**Português**](README_PT.md) · [💬 Discord](https://discord.gg/aRjmJBdK)

</div>

---

> 🆕 **2026.04.13 업데이트** — **dot-skill 로드맵이 공개되었습니다!** colleague.skill은 이제 **dot-skill**로 진화하고 있습니다. 더 이상 동료에만 머무르지 않고, 누구든 증류할 수 있는 방향으로 확장됩니다. 멀티모달 출력과 스킬 생태계도 준비 중입니다.
>
> 👉 **[전체 로드맵 보기](ROADMAP_KO.md)** · **[💬 Discord](https://discord.gg/aRjmJBdK)**
>
> 이슈를 정리했고, 마일스톤과 [공개 프로젝트 보드](https://github.com/users/titanwings/projects/1)도 마련해 두었습니다. 커뮤니티 기여를 환영합니다. `good-first-issue` 라벨도 확인해 보세요.

> 🆕 **2026.04.07 업데이트** — dot-skill 리믹스에 대한 커뮤니티의 반응이 기대 이상이었습니다. 그래서 커뮤니티 갤러리도 만들었습니다. PR도 환영합니다.
>
> 어떤 skill이든 meta-skill이든 공유하고, 트래픽을 자신의 GitHub 저장소로 바로 연결할 수 있습니다. 중간 단계는 없습니다.
>
> 👉 **[titanwings.github.io/colleague-skill-site](https://titanwings.github.io/colleague-skill-site/)** · **[💬 Discord](https://discord.gg/aRjmJBdK)**
>
> 현재 등록된 스킬: 户晨风.skill · 峰哥亡命天涯.skill · 罗翔.skill 외 다수

---

Created by [@titanwings](https://github.com/titanwings) | Powered by Shanghai AI Lab · AI Safety Center

## 지원 데이터 소스

> 아직은 colleague.skill의 베타 버전입니다. 더 많은 데이터 소스를 곧 지원할 예정입니다.

| 소스 | 메시지 | 문서 / 위키 | 스프레드시트 | 비고 |
|------|:------:|:-----------:|:------------:|------|
| Feishu (자동) | ✅ API | ✅ | ✅ | 이름만 입력하면 자동 수집 |
| DingTalk (자동) | ⚠️ 브라우저 | ✅ | ✅ | DingTalk API는 메시지 기록을 지원하지 않음 |
| Slack (자동) | ✅ API | — | — | 관리자가 Bot을 설치해야 하며, 무료 플랜은 90일 제한 |
| WeChat 대화 기록 | ✅ SQLite | — | — | 현재는 다소 불안정하므로 아래 오픈소스 도구 사용 권장 |
| PDF | — | ✅ | — | 수동 업로드 |
| 이미지 / 스크린샷 | ✅ | — | — | 수동 업로드 |
| Feishu JSON 내보내기 | ✅ | ✅ | — | 수동 업로드 |
| 이메일 `.eml` / `.mbox` | ✅ | — | — | 수동 업로드 |
| Markdown | ✅ | ✅ | — | 수동 업로드 |
| 텍스트 직접 붙여넣기 | ✅ | — | — | 수동 입력 |

### WeChat 대화 내보내기 추천 도구

아래 도구들은 별도의 오픈소스 프로젝트입니다. 이 저장소에 해당 코드가 포함되어 있지는 않지만, 본 프로젝트의 파서는 이들이 내보내는 형식과 호환됩니다. 현재 WeChat 자동 복호화는 다소 불안정하므로, 아래 도구로 대화 기록을 먼저 내보낸 뒤 이 프로젝트로 가져오는 방식을 권장합니다.

| 도구 | 플랫폼 | 설명 |
|------|--------|------|
| [WeChatMsg](https://github.com/LC044/WeChatMsg) | Windows | WeChat 대화 기록 내보내기, 여러 형식 지원 |
| [PyWxDump](https://github.com/xaoyaoo/PyWxDump) | Windows | WeChat 데이터베이스 복호화 및 내보내기 |
| [留痕 (Liuhen)](https://github.com/greyovo/留痕) | macOS | WeChat 대화 기록 내보내기 (Mac 사용자 권장) |

> 도구 추천: [@therealXiaomanChu](https://github.com/therealXiaomanChu). 모든 오픈소스 작성자분들께 감사드립니다. 함께 사이버 불멸을 향해 갑시다.

---

## 설치

### Claude Code

> **중요**: Claude Code는 **git 저장소 루트**의 `.claude/skills/`에서 skill을 찾습니다. 반드시 올바른 위치에서 실행하세요.

```bash
# 현재 프로젝트에 설치 (git 저장소 루트에서 실행)
mkdir -p .claude/skills
git clone https://github.com/titanwings/colleague-skill .claude/skills/create-colleague

# 또는 전역 설치 (모든 프로젝트에서 사용 가능)
git clone https://github.com/titanwings/colleague-skill ~/.claude/skills/create-colleague
```

### OpenClaw

```bash
git clone https://github.com/titanwings/colleague-skill ~/.openclaw/workspace/skills/create-colleague
```

### 의존성 (선택 사항)

```bash
pip3 install -r requirements.txt
```

> Feishu/DingTalk/Slack 자동 수집에는 앱 자격 증명이 필요합니다. 자세한 내용은 [INSTALL.md](../../INSTALL.md)를 참고하세요.

---

## 사용법

Claude Code에서 다음 명령을 입력하세요:

```
/create-colleague
```

프롬프트에 따라 별칭, 회사/레벨(예: `ByteDance L2-1 백엔드 엔지니어`), 성격 태그를 입력하고 데이터 소스를 선택하면 됩니다. 모든 항목은 건너뛸 수 있고, 설명만으로도 스킬을 생성할 수 있습니다.

생성이 끝나면 `/{slug}`로 동료 스킬을 호출하세요.

### 명령어

| 명령어 | 설명 |
|--------|------|
| `/list-colleagues` | 생성된 모든 동료 스킬 목록 보기 |
| `/{slug}` | 전체 스킬 호출 (Persona + Work) |
| `/{slug}-work` | 업무 역량만 사용 |
| `/{slug}-persona` | Persona만 사용 |
| `/colleague-rollback {slug} {version}` | 이전 버전으로 롤백 |
| `/delete-colleague {slug}` | 삭제 |

---

## 데모

> 입력: `ByteDance L2-1 백엔드 엔지니어, INTJ, 책임전가형, ByteDance 스타일`

**시나리오 1: 코드 리뷰**

```
사용자          ❯ 이 API 설계 좀 리뷰해줄래?

동료.skill      ❯ 잠깐, 영향 범위가 뭐야? 맥락 설명이 없잖아.
                 (읽은 뒤) N+1 쿼리네. 고쳐.
                 응답은 표준 {code, message, data} 형식으로 가.
                 그게 스펙이야. 이유는 묻지 마.
```

**시나리오 2: 책임 공방**

```
사용자          ❯ 이 버그, 네가 넣은 거 맞지?

동료.skill      ❯ 타임라인이 맞아? 그 기능은 여러 군데를 건드렸고,
                 다른 변경도 있었잖아.
```

---

## 기능

### 생성되는 Skill 구조

각 동료 스킬은 서로 맞물려 작동하는 두 부분으로 구성됩니다.

| 파트 | 내용 |
|------|------|
| **Part A — Work Skill** | 담당 시스템, 기술 표준, 워크플로, 경험 기반 지식 |
| **Part B — Persona** | 5단계 성격 구조: 하드 룰 → 정체성 → 표현 방식 → 의사결정 → 대인관계 |

실행 흐름: `작업 수신 → Persona가 태도 결정 → Work Skill 실행 → 그 사람의 말투로 출력`

### 지원 태그

**성격**: 책임감 강함 · 책임전가형 · 완벽주의 · 적당주의 · 미루기 장인 · PUA 고수 · 사내 정치형 · 상사 관리 달인 · 수동공격형 · 우유부단 · 과묵형 · 읽씹형 …

**조직 문화**: ByteDance 스타일 · Alibaba 스타일 · Tencent 스타일 · Huawei 스타일 · Baidu 스타일 · Meituan 스타일 · 원칙주의 · OKR 집착형 · 대기업 프로세스형 · 스타트업 모드

**레벨**: ByteDance 2-1~3-3+ · Alibaba P5~P11 · Tencent T1~T4 · Baidu T5~T9 · Meituan P4~P8 · Huawei 13~21 · NetEase · JD · Xiaomi …

### 진화 방식

- **파일 추가** → 변경 내용을 자동 분석해 관련 섹션에 병합하고, 기존 결론은 덮어쓰지 않음
- **대화 기반 수정** → "그 사람은 이렇게 안 해, xxx여야 해"라고 말하면 Correction 레이어에 기록되어 즉시 반영
- **버전 관리** → 업데이트할 때마다 자동 아카이브, 과거 어느 버전으로든 롤백 가능

---

## 프로젝트 구조

이 프로젝트는 [AgentSkills](https://agentskills.io) 오픈 표준을 따릅니다. 저장소 전체가 하나의 skill 디렉터리로 구성되어 있습니다.

```
create-colleague/
├── SKILL.md              # Skill 진입점 (공식 frontmatter)
├── prompts/              # 프롬프트 템플릿
│   ├── intake.md         #   대화형 정보 수집
│   ├── work_analyzer.md  #   업무 역량 추출
│   ├── persona_analyzer.md #  성격 추출 (태그 변환 포함)
│   ├── work_builder.md   #   work.md 생성 템플릿
│   ├── persona_builder.md #   persona.md 5단계 구조
│   ├── merger.md         #   증분 병합 로직
│   └── correction_handler.md # 대화 수정 처리기
├── tools/                # Python 도구
│   ├── feishu_auto_collector.py  # Feishu 자동 수집기
│   ├── feishu_browser.py         # Feishu 브라우저 방식
│   ├── feishu_mcp_client.py      # Feishu MCP 방식
│   ├── dingtalk_auto_collector.py # DingTalk 자동 수집기
│   ├── slack_auto_collector.py   # Slack 자동 수집기
│   ├── email_parser.py           # 이메일 파서
│   ├── skill_writer.py           # Skill 파일 관리
│   └── version_manager.py        # 버전 아카이브 및 롤백
├── colleagues/           # 생성된 colleague 스킬들 (gitignored)
├── docs/PRD.md
├── requirements.txt
└── LICENSE
```

---

## 참고 사항

- **소스 자료의 품질 = 스킬의 품질**: 채팅 로그 + 긴 문서 > 수동 설명만 있는 경우
- 우선 수집 권장 순서: **본인이 직접 쓴** 장문 > **의사결정이 드러나는 답변** > 일상 대화
- Feishu 자동 수집을 쓰려면 관련 그룹 채팅에 앱 봇을 추가해야 합니다
- 아직 데모 버전입니다. 버그를 발견하면 이슈를 등록해 주세요

---
### 📄 기술 보고서

> **[Colleague.Skill: Automated AI Skill Generation via Expert Knowledge Distillation](../../colleague_skill.pdf)**
>
> colleague.skill의 시스템 설계를 정리한 논문도 공개했습니다. 2단 구조(Work Skill + Persona), 멀티소스 데이터 수집, 스킬 생성 및 진화 메커니즘, 실제 시나리오 평가 결과까지 담고 있습니다. 관심 있다면 읽어보세요.

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
