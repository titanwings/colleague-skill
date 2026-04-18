<div align="center">

# 🧬 dot-skill

### *「LLMを作ってるお前らは全員コードの賢者だ！肉体は脆弱！サイバー空間へ昇天せよ！」*

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

🧑‍💼 &nbsp;同僚が辞めて、メンターが卒業して、チームメイトが異動して——プレイブックもコンテキストも丸ごと持って行かれた？<br>
💞 &nbsp;家族、旧友、パートナーと疎遠になりつつあり——あの頃一緒にいた空気感を手元に残しておきたい？<br>
🌟 &nbsp;憧れの作家、アイドル、思想家には一生会えない——でも、自分の問いに彼らなら何と答えるか知りたい？

</td></tr>
</table>

### ✨ dot-skill はこの3つをまとめて解決します。

<br>

**colleague.skill** から **dot-skill** へ進化——同僚だけでなく、**誰でも** Skill に蒸留可能に

同僚・パートナー・家族・旧友・アイドル・著名人・架空のキャラクター——さらには自分自身まで

**ソース素材＋あなたの描写 → 本当にその人のように思考する AI Skill**
その人のフレームで考え、その人の声で語る

<br>

[🆕 What's new](#-このメジャーリリースの新機能) · [📦 データソース](#-対応データソース) · [⚡ インストール](#-インストール) · [🚀 使い方](#-使い方) · [✨ デモ](#-デモ) · [💬 Discord](https://discord.gg/aRjmJBdK)

[**English**](../../README.md) · [**中文**](README_ZH.md) · [**Español**](README_ES.md) · [**Deutsch**](README_DE.md) · [**Русский**](README_RU.md) · [**Português**](README_PT.md) · [**한국어**](README_KO.md)

</div>

---

<div align="center">

### 🎉 2026.04.19 マイルストーン — **dot-skill が 15k ⭐ を突破しました！**

スターをくださった皆さま、本当にありがとうございます——これからもリリースを重ね、蒸留を続けます。

</div>

> 📢 **2026.04.19 更新** — **WeChat グループ 5 が稼働中！** dot-skill コミュニティに遊びに来ませんか——skill の共有、機能の議論、Tips の交換、なんでもどうぞ。
>
> <img src="../assets/wechat-group-qr-5.png" alt="dot-skill WeChat group QR" width="240">
>
> QR は 7 日ごとに更新されます（2026-04-24 に期限切れ）——期限切れの場合は Discord で連絡してください。

> 🗺️ **2026.04.13** — **dot-skill Roadmap 公開！** colleague.skill は **dot-skill** へと進化中——同僚だけでなく、誰でも蒸留できます。 👉 **[Roadmap 全文を読む](../../ROADMAP.md)** · **[💬 Discord](https://discord.gg/aRjmJBdK)**

> 🌐 **2026.04.07** — コミュニティギャラリーが稼働開始！どんな skill や meta-skill でも、自分の GitHub リポジトリへ直接トラフィックを流せます。仲介なし。 👉 **[titanwings.github.io/colleague-skill-site](https://titanwings.github.io/colleague-skill-site/)**

<div align="center">

Created by [@titanwings](https://github.com/titanwings) · Powered by **Shanghai AI Lab · AI Safety Center**

</div>

---

## 🆕 このメジャーリリースの新機能

### 1️⃣ colleague-skill から dot-skill へ

もはや「同僚」シナリオだけを想定した作りではありません。統一された `/dot-skill` エントリポイントが汎用スキルエンジンの上に載り、ひとつのエンジンで誰でも蒸留できるようになりました——同僚専用スクリプトだった時代は終わりです。

### 2️⃣ 3つのキャラクターファミリー

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
<td align="center"><sub>同僚・メンター・チームメイト・上下流のパートナー</sub></td>
<td align="center"><sub>元恋人・パートナー・両親・友人・身近な家族</sub></td>
<td align="center"><sub>著名人・クリエイター・論客・架空のキャラクター</sub></td>
</tr>
<tr>
<td><sub>Work Skill + Persona の二層アーキテクチャ——技術基準やワークフローと、話し方や職場での立ち居振る舞いの両方を学習します。Feishu / DingTalk / Slack の自動収集に対応。</sub></td>
<td><sub>🆕 <b>写真共有機能が近日登場</b> — 蒸留された関係性は、メッセージに返信するだけではありません。実在の人のように写真を送り、日常の一コマを共有してくれるようになります。</sub></td>
<td><sub><b>6次元リサーチの完全なツールチェーン</b>（字幕ダウンロード → トランスクリプト整形 → リサーチ統合 → 品質チェック）を標準装備。口調の模倣ではなく、思考モデルと意思決定フレームの再現を目指します。</sub></td>
</tr>
</tbody>
</table>

各ファミリーは独自のプロンプトパイプライン、素材収集戦略、生成テンプレートを持ちます。

### 3️⃣ 対応Agentホストの拡大

旧バージョンは Claude Code 専用でしたが、今では4つのホストに横断対応：

| ホスト | 説明 |
|------|-------------|
| 🟣 **Claude Code** | スラッシュコマンドにネイティブ対応 |
| 🟠 **Hermes Agent** | ワンコマンドでインストール、`/dot-skill` がそのまま動作 |
| 🔵 **OpenClaw** | 完全互換 |
| ⚫ **Codex** | skill 名で呼び出し |

生成されたキャラクター Skill も、いずれのホストにもワンコマンドでインストール可能です。

---

## 📦 対応データソース

| ソース | メッセージ | ドキュメント / Wiki | スプレッドシート | 備考 |
|--------|:--------:|:-----------:|:------------:|------|
| 🟢 Feishu（自動） | ✅ API | ✅ | ✅ | 名前を入力するだけで全自動 |
| 🟡 DingTalk（自動） | ⚠️ ブラウザ | ✅ | ✅ | DingTalk API はメッセージ履歴に非対応 |
| 🟣 Slack（自動） | ✅ API | — | — | 管理者による Bot 導入が必要；無料プランは 90 日制限 |
| 💬 WeChat チャット履歴 | ✅ SQLite | — | — | WeChatMsg / PyWxDump / 留痕 で先にエクスポート |
| 📄 PDF / 画像 / スクリーンショット | — | ✅ | — | 手動アップロード |
| 📦 Feishu JSON エクスポート | ✅ | ✅ | — | 手動アップロード |
| ✉️ メール `.eml` / `.mbox` | ✅ | — | — | 手動アップロード |
| 📝 Markdown / 直接貼り付け | ✅ | ✅ | — | 手動入力 |

---

## ⚡ インストール

いまは 2026 年——あなたには Agent がいます。自分でインストールさせましょう。お手元の Claude Code / Hermes / OpenClaw / Codex を開いて、この一行を渡してください：

> dot-skill をインストールして：`https://github.com/titanwings/colleague-skill`

Agent は現在のホストの skills ディレクトリを検出し、リポジトリを clone してエントリポイントを登録します。完了後、どのホストでも `/dot-skill` と入力すれば起動します。

<details>
<summary><b>🛠️ 自分でインストールしたい？パスはこちら</b></summary>

<br>

```bash
git clone https://github.com/titanwings/colleague-skill <TARGET>
```

| ホスト | `<TARGET>` パス |
|------|-----------------|
| Claude Code | `~/.claude/skills/dot-skill` |
| OpenClaw | `~/.openclaw/workspace/skills/dot-skill` |
| Codex | `~/.codex/skills/dot-skill` |
| Hermes | clone 後に `python3 tools/install_hermes_skill.py --force` を実行 |

</details>

> Feishu/DingTalk 自動収集のクレデンシャル、生成したキャラクター Skill を各ホストへ公開する手順、Windows 固有の注意点などは **[詳細インストールガイド (INSTALL.md)](../../INSTALL.md)** を参照してください。

---

## 🚀 使い方

dot-skill をインストールしたホストで起動します——`/dot-skill` と入力するか、単に Agent に「dot-skill を起動して」と伝えるだけ。

まずどのファミリーを蒸留するか聞かれます：`colleague`、`relationship`、`celebrity` のいずれか。

次にニックネーム、基本プロフィール、性格タグを入力し、データソースを選びます。すべての項目はスキップ可能——説明文だけでも Skill は生成できます。

作成後は、生成された Skill を `/{character}-{slug}` で呼び出します。

### 🎛️ コマンド

| コマンド | 説明 |
|---------|------|
| `/dot-skill` | 標準の統一エントリポイント |
| `/{character}-{slug}` | フル Skill を呼び出し（Persona + Work） |
| `/{character}-{slug}-work` | 仕事能力のみ |
| `/{character}-{slug}-persona` | Persona のみ |
| `python3 tools/skill_writer.py --action list ...` | 3 ファミリー横断で生成済み Skill を一覧表示 |
| `python3 tools/version_manager.py --action rollback ...` | Skill のバージョンをロールバック |

### 🔬 Celebrity Research Toolchain

`celebrity` ファミリーには、字幕から完成稿までをカバーするエンドツーエンドのリサーチツールチェーンが同梱されています：

```bash
# 動画の字幕をダウンロード
bash tools/research/download_subtitles.sh "<video-url>" "./tmp/subtitles"

# 字幕 → トランスクリプト
python3 tools/research/srt_to_transcript.py "./tmp/subtitles/example.srt"

# リサーチノートを統合
python3 tools/research/merge_research.py "./skills/celebrity/<slug>"

# 品質チェック
python3 tools/research/quality_check.py "./skills/celebrity/<slug>/SKILL.md"
```

---

## ✨ デモ

各ファミリーから 1 つずつ。

<br>

### 🌟 celebrity — Andrej Karpathy を蒸留

> 6 次元リサーチ：著作・インタビュー・意思決定・表現 DNA・外部評価・タイムライン<br>
> コミュニティの成果 [alchaincyf/karpathy-skill](https://github.com/alchaincyf/karpathy-skill) を参考にしたケース

```
User            ❯ みんな Agent の話ばかりしてますが、2026 年の AI Agent はどうなると思いますか？

celebrity.skill ❯ 誰もがデモを作ってる、誰も eval をやっていない。
                  Agent のボトルネックはずっとモデルの知能じゃない——スキャフォールディングだ：
                  厳格な評価ハーネス、細粒度のエラーリプレイ、
                  制御可能なツール呼び出しバジェット、クリーンな失敗モード分析。
                  ほとんどのプロダクトは今も「API + いくつかのツール + システムプロンプトをラップ」の段階で止まっている。
                  それはデモであって agent ではない。
                  2026 年、俺が賭けるのは最強のモデルじゃない——最良のスキャフォールディングと、
                  最も厳格な eval に賭ける。
```

<br>

### 🧑‍💼 colleague — ByteDance L2-1 バックエンドを蒸留

> 入力：`ByteDance L2-1 バックエンドエンジニア、INTJ、責任転嫁体質、ByteDance カルチャー`

```
User            ❯ この API 設計、レビューしてもらえる？

colleague.skill ❯ ちょっと待って——影響範囲は？背景がまだ説明されてないけど。
                  （読んだ後）N+1 クエリ、直して。標準の
                  {code, message, data} レスポンス形式を使うこと。それが規約、
                  理由は聞かないで。

User            ❯ このバグ、君が入れたんじゃない？

colleague.skill ❯ タイムラインは合ってる？あの機能は複数箇所に手が入ってて、
                  他の変更もあったはずだよ。
```

<br>

### 💞 relationship — 片想い中の相手を蒸留

> 半年分のチャット履歴 ＋「繊細、物静かだけど芯は強い、肝心なときはちゃんと返信してくれる」をアップロード

```
User               ❯ 今日、私のこと考えた？

relationship.skill ❯ ……ちょっとだけね。なんで訊くの？
```

<div align="center">

📚 実例はさらに **[コミュニティギャラリー](https://titanwings.github.io/colleague-skill-site/)** に——100+ の skill が集まり続けています

</div>

---

## 🔧 機能

### 🧱 生成される Skill の構造

dot-skill は **Persona** を共通の土台とし、その上にファミリー固有モジュールを重ねる構成です：

| ファミリー | Persona の内容 | 追加モジュール |
|--------|-----------------|-------------------|
| 🧑‍💼 **colleague** | 6 層の性格構造：ハードルール → アイデンティティ → 表現スタイル → 意思決定 → 対人行動 → Correction | ➕ **Work Skill**：担当領域、ワークフロー、出力の好み、経験知識ベース |
| 💞 **relationship** | 表現 DNA・感情トリガー・衝突パターン・修復パターン | — |
| 🌟 **celebrity** | 思考モデル・意思決定ヒューリスティクス・表現 DNA・外部評価とのコントラスト | ➕ 6 次元リサーチドシエ（著作/インタビュー/意思決定/タイムライン…） |

> **実行フロー**：タスク受信 → Persona が態度と口調を決定 → 追加モジュールが実行ディテールを埋める → その人の声で出力

### 🧬 進化メカニズム

- 📥 **ファイル追加** → 自動で差分分析 → 関連セクションにマージ、既存の結論は上書きしない
- 💬 **会話による修正** → 「彼はそんなことしない、xxx のはず」と伝える → Correction レイヤーに書き込まれ、即座に反映
- 🕰️ **バージョン管理** → 更新のたびに自動アーカイブ、任意の過去バージョンへロールバック可能
- 🔬 **Celebrity リサーチパイプライン** → 字幕 → トランスクリプト整形 → 6 次元リサーチ → 品質チェック

---

## 📂 プロジェクト構造

本プロジェクトは [AgentSkills](https://agentskills.io) オープン標準に準拠しています。リポジトリ全体がひとつの skill ディレクトリです：

```
dot-skill/
├── SKILL.md                        # skill entry point (official frontmatter)
├── prompts/                        # prompt system across three families
│   ├── intake.md                   #   [colleague] info intake
│   ├── work_analyzer.md            #   [colleague] work capability extraction
│   ├── persona_analyzer.md         #   [colleague] personality extraction
│   ├── work_builder.md             #   [colleague] work.md generation
│   ├── persona_builder.md          #   [colleague] persona.md 6-layer structure
│   ├── merger.md                   #   [shared] incremental merge logic
│   ├── correction_handler.md       #   [shared] conversation correction
│   ├── relationship/               #   [relationship] emotion/conflict/repair prompts
│   └── celebrity/                  #   [celebrity] six-dimension research + mental-model prompts
├── tools/                          # Python tools
│   ├── feishu_auto_collector.py    #   [colleague] Feishu auto-collector
│   ├── dingtalk_auto_collector.py  #   [colleague] DingTalk auto-collector
│   ├── slack_auto_collector.py     #   [colleague] Slack auto-collector
│   ├── email_parser.py             #   [shared] email parser
│   ├── research/                   #   [celebrity] celebrity research toolchain
│   │   ├── download_subtitles.sh   #     subtitle download
│   │   ├── transcribe_audio.py     #     audio → text
│   │   ├── srt_to_transcript.py    #     subtitles → transcript
│   │   ├── merge_research.py       #     six-dimension research merge
│   │   └── quality_check.py        #     quality check
│   ├── install_*_skill.py          #   [shared] multi-host one-shot installers
│   ├── skill_writer.py             #   [shared] skill file management
│   └── version_manager.py          #   [shared] version archive & rollback
├── skills/                         # generated Skills (gitignored)
│   ├── colleague/                  #   colleagues
│   ├── relationship/               #   close relationships
│   └── celebrity/                  #   public figures
├── docs/PRD.md
├── requirements.txt
└── LICENSE
```

---

## ⚠️ 注意事項

**ソース素材の品質 = Skill の品質** — そして質の高いソースはファミリーごとに異なります：

| ファミリー | ソースの優先順位（高 → 低） |
|--------|------------------------------|
| 🧑‍💼 **colleague** | **本人が書いた**長文（設計ドキュメント／レビューコメント）**›** **意思決定に関する返信** **›** 雑談チャット |
| 💞 **relationship** | 完全なチャット履歴 **›** 手紙／SNS 投稿／日記 **›** 第三者による描写 |
| 🌟 **celebrity** | 一人称の書籍／ブログ／長尺インタビュー **›** 意思決定記録（リリース、コードコミット、Q&A） **›** 第三者による解説 |

- **colleague** Feishu 自動収集：関連グループチャットに App Bot を追加する必要があります
- **relationship**：時間スパンが長いほど良く、衝突と修復の両方をカバーした素材が理想的です
- **celebrity**：二次解釈だけを食わせるのは避けてください
- これはまだデモ版です——バグを見つけたら issue を立ててください！

---

## 📄 技術レポート

> **[Colleague.Skill: Automated AI Skill Generation via Expert Knowledge Distillation](../../colleague_skill.pdf)**
>
> これは dot-skill の前身である **colleague.skill** の論文です。Work Skill + Persona の二層アーキテクチャ、マルチソースデータ収集、Skill 生成メカニズムを扱っており、今日の `colleague` ファミリーの理論的基盤となっています。relationship / celebrity ファミリーの拡張については、別途論文の公開を予定しています。

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
