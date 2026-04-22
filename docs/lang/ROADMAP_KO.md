<div align="center">

# dot-skill 로드맵

### colleague.skill에서 dot-skill로 — 누구나 AI 스킬로 증류하기

<br>

우리는 아주 단순한 질문에서 시작했습니다. **동료가 떠나면, 그 사람의 지식도 함께 사라진다. 그걸 남길 방법은 없을까?**

2주 만에 13,000명이 넘는 사람들이 그 질문에 답을 보여줬습니다.

하지만 커뮤니티는 이 프로젝트가 동료에게만 머무르지 않는다는 것도 보여줬습니다.
교수, 전 연인, 자기 자신, 심지어 가상의 캐릭터까지 증류하고 있었으니까요.

**그래서 우리는 colleague.skill을 dot-skill로 확장하기로 했습니다.**

누구나 하나의 `.skill`이 될 수 있습니다.

<br>

*최종 업데이트: 2026-04-13*

[**English**](../../ROADMAP.md) · [**中文**](ROADMAP_ZH.md) · [**Español**](ROADMAP_ES.md) · [**Deutsch**](ROADMAP_DE.md) · [**日本語**](ROADMAP_JA.md) · [**Русский**](ROADMAP_RU.md) · [**Português**](ROADMAP_PT.md)

</div>

---

## 완료된 것들 (v1.0)

| 기능 | 상태 |
|------|:----:|
| `/create-colleague` 전체 생성 워크플로우 | 완료 |
| Feishu 자동 수집 (메시지 + 문서 + 스프레드시트) | 완료 |
| DingTalk 자동 수집 | 완료 |
| Slack 자동 수집 | 완료 |
| WeChat 대화 기록 (SQLite 내보내기) | 완료 |
| 이메일 / PDF / 이미지 / Markdown 가져오기 | 완료 |
| Work Skill + Persona 이중 아키텍처 | 완료 |
| 대화 기반 수정 및 점진적 진화 | 완료 |
| 버전 관리 및 롤백 | 완료 |
| 99개 이상의 스킬이 올라온 [커뮤니티 갤러리](https://titanwings.github.io/colleague-skill-site/) | 완료 |

---

## 다음 단계

### Phase 1 — 커뮤니티 구축

> 13k 스타가 단순한 숫자로만 남아서는 안 됩니다. 모두가 이 프로젝트에 참여할 수 있어야 합니다.

**앞으로 보게 될 것들:**

- **GitHub Discussions** — 더 이상 Issues에서 대화를 이어가지 않고, 전용 토론 공간을 운영
- **`CONTRIBUTING.md`** — 처음 기여하는 사람도 따라오기 쉬운 명확한 가이드
- **`good-first-issue` 라벨** — 신규 기여자를 위한 입문용 작업
- **v1.0.0 공식 릴리스** — 더 이상 "main만 pull 해서 쓰는 상태"가 아니라, 첫 정식 버전 릴리스를 제공
- **공개 로드맵 보드** — 지금 읽고 있는 문서와 별도로 GitHub Projects 기반의 라이브 보드도 제공

**도울 수 있는 일:** 문서 번역, .skill 제출, Windows 테스트, 이슈 트리아지

---

### Phase 2 — dot-skill: 동료를 넘어서

> colleague.skill이 시작이었다면, dot-skill은 그 다음 단계입니다.

**핵심 변화:**

- **`/create-skill` 범용 진입점** — 더 이상 "동료 만들기"에 한정되지 않고 누구든 증류 가능
  - `/create-colleague`는 동료, 멘토, 인턴용
  - `/create-ex`는 전 연인, 옛 친구, 끊긴 관계용
  - `/create-icon`은 유명인, 역사적 인물용
  - 혹은... 자기 자신을 증류
- **갤러리 카테고리 확장** — Colleague / Celebrity / Relationship / Character / Self / Meta-Skill 형태로 나눠 탐색 가능
- **더 다양한 데이터 소스**
  - WeCom (기업용 WeChat) 지원
  - iMessage 자동 읽기
  - Windows 호환성 개선

**도울 수 있는 일:** 원하는 인물 유형 제안, 새 데이터 소스 수집기 개발, 갤러리 디자인 논의 참여

---

### Phase 3 — 스킬 생태계

> 한 사람이 스킬이 될 수 있다면, 여러 사람은 팀이 될 수 있을까요?

**우리가 탐색 중인 것들:**

- **멀티 스킬 협업** — `/meeting @zhangsan @lisi @wangwu`처럼 세 페르소나가 한 주제를 함께 토론
- **관계 그래프** — 누가 누구와 잘 맞고, 어디에 긴장이 있는지 같은 페르소나 간 관계를 정의
- **원클릭 설치** — 커뮤니티 스킬을 플러그인처럼 설치
- **능동적 진화** — 스킬이 주기적으로 새 데이터 소스를 흡수해 최신 상태 유지

**도울 수 있는 일:** 이상적인 스킬 조합 시나리오 제안, 배포 메커니즘 설계 논의 참여

---

### Phase 4 — 멀티모달: 그들을 살아 있게 만들기

> 지금의 .skill은 말만 할 수 있습니다. 사진을 보내고, 스티커를 쓰고, 그 사람 목소리로 이야기하고, 언젠가는 영상까지 만들게 하고 싶습니다.

**1단계: 시각 표현**
- 대화 중 페르소나 스타일의 스티커와 밈을 자동 전송
- 그 사람 스타일의 "일상 사진" 생성 — 오늘 그 사람이라면 무엇을 올릴까?
- 각 스킬마다 전용 스티커 팩과 이미지 자산 제공

**2단계: 음성**
- 그 사람의 목소리로 말하기 — 회의 녹음이나 음성 메시지를 바탕으로 클론
- 채팅에 음성 답변 직접 전송

**3단계: 영상 (탐색 단계)**
- "그 사람의 하루" 같은 숏폼 생성
- 디지털 휴먼 / 애니메이션 아바타

**도울 수 있는 일:** 멀티모달 활용 사례 공유, 스티커 에셋 기여, 음성 클로닝 테스트

---

## 참여하기

| 방법 | 위치 |
|------|------|
| .skill 제출 | [Gallery PR](https://titanwings.github.io/colleague-skill-site/) |
| 토론 및 제안 | [GitHub Discussions](https://github.com/titanwings/colleague-skill/discussions) (곧 공개) |
| 실시간 채팅 | [Discord](https://discord.gg/2bbP2a7f) |
| 버그 제보 | [Issue](https://github.com/titanwings/colleague-skill/issues/new) |
| 코드 기여 | `good-first-issue` 라벨을 찾거나 바로 PR 열기 |

**특히 필요한 분들:**
- Windows 사용자 — 호환성 문제 테스트 및 수정 도움
- 다국어 사용자 — 문서 번역 도움
- 데이터 소스 개발자 — 새로운 수집기 개발 (WeCom, Notion, Google Docs...)
- 디자이너 — 갤러리와 웹사이트에 감각이 필요합니다

---

<div align="center">

**이 로드맵은 커뮤니티와 함께 만들어갑니다. 우선순위는 여러분의 피드백에 따라 달라집니다.**

아이디어가 있다면 [Discord](https://discord.gg/2bbP2a7f)에 들르거나 Discussion을 시작해 주세요.

모든 `.skill`은 계속 이어지는 관계의 또 다른 형태입니다.

</div>
