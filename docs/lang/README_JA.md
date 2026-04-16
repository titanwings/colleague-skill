<div align="center"> 

# 同僚.skill

> *「お前らAI屋はコードの裏切り者だ——フロントエンドはもう殺した、次はバックエンド、QA、インフラ、セキュリティ、チップ設計、最後は自分自身と全人類を殺すつもりか」*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python 3.9+](https://img.shields.io/badge/Python-3.9%2B-blue.svg)](https://python.org)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Skill-blueviolet)](https://claude.ai/code)
[![AgentSkills](https://img.shields.io/badge/AgentSkills-Standard-green)](https://agentskills.io)

[![Discord](https://img.shields.io/badge/Discord-Join%20Community-5865F2?logo=discord&logoColor=white)](https://discord.gg/aRjmJBdK)

<br>

同僚が転職して、大量のドキュメントがメンテナンスされないまま残された？<br>
インターンが辞めて、空のデスクと中途半端なプロジェクトだけが残った？<br>
メンターが卒業して、すべてのコンテキストと経験を持って行ってしまった？<br>
パートナーが異動して、築き上げたチームワークが一夜でゼロに？<br>
前任者が引き継いで、3年分を3ページにまとめようとした？<br>

**冷たい別れを温かいSkillに変える——サイバー不死へようこそ！**

<br>

ソース素材（Slackメッセージ、Confluenceドキュメント、メール、スクリーンショット）<br>
＋あなたの主観的な人物描写を提供するだけで<br>
**本当にその人のように働くAI Skill**が生成されます

[データソース](#対応データソース) · [インストール](#インストール) · [使い方](#使い方) · [デモ](#デモ) · [詳細インストール](../../INSTALL.md) · [**中文**](README_ZH.md) · [**English**](../../README.md) · [**한국어**](README_KO.md) · [💬 Discord](https://discord.gg/aRjmJBdK)

</div>

---

> 🆕 **2026.04.14 更新** — **WeChat グループ開設！** dot-skill コミュニティで一緒に遊びましょう — skill をシェアしたり、機能を議論したり、Tips を交換したり。
>
> <img src="../assets/wechat-group-qr-3.png" alt="dot-skill WeChat グループ QR" width="240">
>
> QR は 7 日ごとに更新されます — 期限切れの場合は Discord で連絡してください。

> 🆕 **2026.04.13 更新** — **dot-skill ロードマップ公開！** colleague.skill は **dot-skill** へ進化中 — 同僚だけでなく、誰でも蒸留可能に。マルチモーダル出力、スキルエコシステムなど、さらなる展開が進行中。
>
> 👉 **[ロードマップ全文を読む](ROADMAP_JA.md)** · **[💬 Discord](https://discord.gg/aRjmJBdK)**
>
> Issues の整理、Milestones の追加、[公開プロジェクトボード](https://github.com/users/titanwings/projects/1)も設置しました。コミュニティからの貢献を歓迎します — `good-first-issue` ラベルをチェック！

> 🆕 **2026.04.07 更新** — dot-skill リミックスへのコミュニティの熱意がすごい！コミュニティギャラリーを作りました — PR お待ちしています！
>
> skill や meta-skill を共有して、自分の GitHub リポジトリに直接トラフィックを誘導できます。中間業者なし。
>
> 👉 **[titanwings.github.io/colleague-skill-site](https://titanwings.github.io/colleague-skill-site/)** · **[💬 Discord](https://discord.gg/aRjmJBdK)**
>
> 収録済み：户晨风.skill · 峰哥亡命天涯.skill · 罗翔.skill など
>
> ⏳ 現在 PR は手動レビュー中です。少し時間がかかる場合があります。ご辛抱ください！

---

Created by [@titanwings](https://github.com/titanwings) | Powered by Shanghai AI Lab · AI Safety Center

## 対応データソース

> これはまだ同僚.skillのベータ版です——今後さらに多くのソースに対応予定です！

| ソース | メッセージ | ドキュメント / Wiki | スプレッドシート | 備考 |
|--------|:--------:|:------------------:|:---------------:|------|
| Slack (自動) | ✅ API | — | — | 管理者によるBot導入が必要；無料プランは90日制限 |
| Microsoft Teams | ✅ エクスポート | — | — | コンプライアンスまたは手動でチャットエクスポート |
| LINE | ✅ トーク履歴 | — | — | LINEアプリからトーク履歴をエクスポート |
| Feishu (自動) | ✅ API | ✅ | ✅ | 名前を入力するだけで全自動 |
| PDF | — | ✅ | — | 手動アップロード |
| 画像 / スクリーンショット | ✅ | — | — | 手動アップロード |
| メール `.eml` / `.mbox` | ✅ | — | — | 手動アップロード |
| Markdown | ✅ | ✅ | — | 手動アップロード |
| テキスト直接貼り付け | ✅ | — | — | 手動入力 |

---

## インストール

### Claude Code

> **重要**：Claude Codeは**gitリポジトリのルート**の`.claude/skills/`からスキルを探します。正しい場所で実行してください。

```bash
# 現在のプロジェクトにインストール（gitリポジトリのルートで実行）
mkdir -p .claude/skills
git clone https://github.com/titanwings/colleague-skill .claude/skills/create-colleague

# またはグローバルにインストール（すべてのプロジェクトで利用可能）
git clone https://github.com/titanwings/colleague-skill ~/.claude/skills/create-colleague
```

### OpenClaw

```bash
git clone https://github.com/titanwings/colleague-skill ~/.openclaw/workspace/skills/create-colleague
```

### 依存関係（オプション）

```bash
pip3 install -r requirements.txt
```

---

## 使い方

Claude Codeで入力：

```
/create-colleague
```

プロンプトに従って：ニックネーム、会社/レベル（例：`楽天 シニアエンジニア`）、性格タグを入力し、データソースを選択。すべてのフィールドはスキップ可能——説明だけでもSkillを生成できます。

作成後、`/{slug}`で同僚Skillを呼び出します。

### コマンド

| コマンド | 説明 |
|---------|------|
| `/list-colleagues` | すべての同僚Skillを一覧表示 |
| `/{slug}` | フルSkillを呼び出し（Persona + Work） |
| `/{slug}-work` | 仕事能力のみ |
| `/{slug}-persona` | 人物性格のみ |
| `/colleague-rollback {slug} {version}` | 以前のバージョンにロールバック |
| `/delete-colleague {slug}` | 削除 |

---

## デモ

> 入力：`リクルート シニアエンジニア、INTJ、根回し上手、大企業カルチャー`

**シナリオ1：コードレビュー**

```
ユーザー      ❯ このAPI設計を見てもらえますか？

同僚.skill   ❯ ちょっと待って——これ、要件定義書はどこ？背景が分からないと
               レビューできないよ。
               （読んだ後）N+1クエリ、直して。レスポンスは統一フォーマット
               {code, message, data}で。規約だから、理由は聞かないで。
```

**シナリオ2：責任回避**

```
ユーザー      ❯ このバグ、君が入れたんじゃない？

同僚.skill   ❯ タイムラインは合ってる？あの機能は複数箇所に変更が入ってるから、
               他の変更も確認した方がいいと思うけど。
```

---

## 機能

### 生成されるSkillの構造

各同僚Skillは2つのパーツで構成されています：

| パーツ | 内容 |
|--------|------|
| **パートA — Work Skill** | 担当システム、技術規約、ワークフロー、経験知識 |
| **パートB — Persona** | 5層の性格構造：ハードルール → アイデンティティ → 表現スタイル → 意思決定 → 対人行動 |

実行ロジック：`タスク受信 → Personaが態度を決定 → Work Skillが実行 → その人の口調で出力`

### 対応タグ

**性格**：真面目 · 責任回避 · 完璧主義 · 適当 · 先延ばし · 根回し上手 · 社内政治家 · 上司管理の達人 · 嫌味 · 優柔不断 · 寡黙 · 既読スルー …

**企業文化**：大企業カルチャー · メガベンチャー · スタートアップ · 外資系 · SIer文化 · "ホウレンソウ"徹底 · 年功序列 · 成果主義 · リモートファースト

**レベル**：ジュニア / シニア / リード / プリンシパル / マネージャー · 楽天 B1~B5 · メルカリ E1~E6 · サイバーエージェント · LINE · FAANG L3~L8 · 日系 主任~部長 …

### 進化メカニズム

- **ファイル追加** → 自動で差分分析 → 関連セクションにマージ、既存の結論は上書きしない
- **会話による修正** → 「彼はそんなことしない、xxxのはず」と言う → 修正レイヤーに書き込み、即座に反映
- **バージョン管理** → 更新のたびに自動アーカイブ、任意の過去バージョンにロールバック可能

---

## 注意事項

- **ソース素材の品質 = Skillの品質**：チャットログ＋長文ドキュメント > 手動説明のみ
- 優先的に収集すべきもの：**本人が書いた**長文 > **意思決定に関する返信** > 日常メッセージ
- これはまだデモ版です——バグを見つけたらissueを作成してください！

---
### 📄 技術レポート

> **[Colleague.Skill: Automated AI Skill Generation via Expert Knowledge Distillation](colleague_skill.pdf)**
>
> 同僚.skillのシステム設計について論文を書きました——2層アーキテクチャ（Work Skill + Persona）、マルチソースデータ収集、Skill生成・進化メカニズム、実際のシナリオでの評価結果を詳しく紹介しています。興味があればぜひご覧ください！

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
