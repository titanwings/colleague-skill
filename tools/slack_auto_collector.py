#!/usr/bin/env python3
"""
Slack 自动采集器

输入同事的 Slack 姓名/用户名，自动：
  1. 搜索 Slack 用户，获取 user_id
  2. 找到与 Bot 共同的频道，拉取该用户发出的消息
  3. 输出统一格式，直接进 create-colleague 分析流程

前置：
  python3 slack_auto_collector.py --setup   # 配置 Bot Token（一次性）

用法：
  python3 slack_auto_collector.py --name "张三" --output-dir ./knowledge/zhangsan
  python3 slack_auto_collector.py --name "john" --msg-limit 500 --channel-limit 30

所需 Bot Token Scopes（OAuth & Permissions）：
  channels:history      读取 public channel 消息
  channels:read         列出 public channels
  groups:history        读取 private channel 消息
  groups:read           列出 private channels
  im:history            读取 DM 消息（可选）
  im:read               列出 DM（可选）
  mpim:history          读取群 DM 消息（可选）
  mpim:read             列出群 DM（可选）
  users:read            搜索用户列表

注意：
  - 免费版 Workspace 仅保留最近 90 天消息
  - 需要 Workspace 管理员安装 Bot App
"""

from __future__ import annotations

import json
import os
import sys
import time
import argparse
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

# ─── 依赖检查 ──────────────────────────────────────────────────────────────────

try:
    from slack_sdk import WebClient
    from slack_sdk.errors import SlackApiError
except ImportError:
    print(
        "错误：请先安装 slack_sdk：pip3 install slack-sdk",
        file=sys.stderr,
    )
    sys.exit(1)

# ─── 常量 ──────────────────────────────────────────────────────────────────────

CONFIG_PATH = Path.home() / ".colleague-skill" / "slack_config.json"

# Slack 频道类型（采集范围）
CHANNEL_TYPES = "public_channel,private_channel,mpim,im"

# 速率限制重试配置
MAX_RETRIES = 5
RETRY_BASE_WAIT = 1.0     # 最短等待秒数
RETRY_MAX_WAIT = 60.0     # 最长等待秒数

# 采集默认值
DEFAULT_MSG_LIMIT = 1000
DEFAULT_CHANNEL_LIMIT = 50  # 最多检查的频道数


# ─── 错误类型 ──────────────────────────────────────────────────────────────────

class SlackCollectorError(Exception):
    """采集过程中的可预期错误，直接退出"""


class SlackScopeError(SlackCollectorError):
    """Bot Token 缺少必要的 scope 权限"""


class SlackAuthError(SlackCollectorError):
    """Token 无效或已过期"""


# ─── 配置管理 ──────────────────────────────────────────────────────────────────

def load_config() -> dict:
    if not CONFIG_PATH.exists():
        print(
            "未找到配置，请先运行：python3 slack_auto_collector.py --setup",
            file=sys.stderr,
        )
        sys.exit(1)
    try:
        return json.loads(CONFIG_PATH.read_text())
    except json.JSONDecodeError:
        print(f"配置文件损坏，请重新运行 --setup：{CONFIG_PATH}", file=sys.stderr)
        sys.exit(1)


def save_config(config: dict) -> None:
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    os.chmod(CONFIG_PATH.parent, 0o700)
    CONFIG_PATH.write_text(json.dumps(config, indent=2, ensure_ascii=False))
    os.chmod(CONFIG_PATH, 0o600)


def setup_config() -> None:
    print("=== Slack 自动采集配置 ===\n")
    print("步骤 1：前往 https://api.slack.com/apps 创建新 App")
    print("        选择「From scratch」→ 填写 App Name → 选择目标 Workspace\n")
    print("步骤 2：进入 OAuth & Permissions，在 Bot Token Scopes 添加：")
    print()
    print("  消息类（必需）：")
    print("    channels:history     读取 public channel 历史消息")
    print("    groups:history       读取 private channel 历史消息")
    print("    mpim:history         读取群 DM 历史消息")
    print("    im:history           读取 DM 历史消息（可选）")
    print()
    print("  频道信息（必需）：")
    print("    channels:read        列出 public channels")
    print("    groups:read          列出 private channels")
    print("    mpim:read            列出群 DM")
    print("    im:read              列出 DM（可选）")
    print()
    print("  用户信息（必需）：")
    print("    users:read           搜索用户列表")
    print()
    print("步骤 3：Install to Workspace → 复制 Bot User OAuth Token（xoxb-...）")
    print("步骤 4：将 Bot 加入目标频道（/invite @your-bot-name）\n")

    token = input("Bot User OAuth Token (xoxb-...): ").strip()
    if not token.startswith("xoxb-"):
        print("警告：Token 格式不对，应以 xoxb- 开头", file=sys.stderr)

    # 验证 token 是否有效
    print("\n验证 Token ...", end=" ", flush=True)
    try:
        client = WebClient(token=token)
        resp = client.auth_test()
        workspace = resp.get("team", "Unknown")
        bot_name = resp.get("user", "Unknown")
        print(f"OK\n  Workspace：{workspace}，Bot：{bot_name}")
    except SlackApiError as e:
        err = e.response.get("error", str(e))
        print(f"失败\n  错误：{err}", file=sys.stderr)
        if err == "invalid_auth":
            print("  Token 无效，请重新生成", file=sys.stderr)
        sys.exit(1)

    config = {"bot_token": token}
    save_config(config)
    print(f"\n✅ 配置已保存到 {CONFIG_PATH}")
    print("   请确认已将 Bot 加入目标频道，否则无法读取消息")


# ─── Slack Client 封装（带速率限制重试）─────────────────────────────────────────

class RateLimitedClient:
    """封装 slack_sdk WebClient，自动处理 429 速率限制"""

    def __init__(self, token: str) -> None:
        self._client = WebClient(token=token)

    def call(self, method: str, **kwargs) -> dict:
        """调用任意 Slack API，遇到 ratelimited 自动等待重试"""
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                fn = getattr(self._client, method)
                resp = fn(**kwargs)
                return resp.data
            except SlackApiError as e:
                error = e.response.get("error", "")

                # 速率限制：读取 Retry-After header 等待
                if error == "ratelimited":
                    wait = float(
                        e.response.headers.get("Retry-After", RETRY_BASE_WAIT * attempt)
                    )
                    wait = min(wait, RETRY_MAX_WAIT)
                    print(
                        f"  [速率限制] 等待 {wait:.0f}s（第 {attempt}/{MAX_RETRIES} 次重试）...",
                        file=sys.stderr,
                    )
                    time.sleep(wait)
                    continue

                # 权限错误：直接抛出，不重试
                if error == "missing_scope":
                    missing = e.response.get("needed", "unknown")
                    raise SlackScopeError(
                        f"Bot Token 缺少权限 scope：{missing}\n"
                        f"  请前往 https://api.slack.com/apps → OAuth & Permissions → Bot Token Scopes 添加"
                    ) from e

                if error in ("invalid_auth", "token_revoked", "account_inactive"):
                    raise SlackAuthError(
                        f"Token 认证失败（{error}），请重新运行 --setup 配置新 Token"
                    ) from e

                # 频道无权限（Bot 未加入）：调用方处理
                if error in ("not_in_channel", "channel_not_found"):
                    raise

                # 其他错误：打印警告，返回空数据
                print(f"  [API 警告] {method} 返回错误：{error}", file=sys.stderr)
                return {}

        # 重试耗尽
        print(f"  [错误] {method} 多次重试后仍失败，跳过", file=sys.stderr)
        return {}

    def paginate(self, method: str, result_key: str, **kwargs) -> list:
        """自动翻页，返回所有结果的合并列表"""
        items: list = []
        cursor = None

        while True:
            params = dict(kwargs)
            if cursor:
                params["cursor"] = cursor

            data = self.call(method, **params)
            if not data:
                break

            items.extend(data.get(result_key, []))

            meta = data.get("response_metadata", {})
            cursor = meta.get("next_cursor")
            if not cursor:
                break

        return items


# ─── 用户搜索 ──────────────────────────────────────────────────────────────────

def find_user(name: str, client: RateLimitedClient) -> Optional[dict]:
    """
    通过姓名（real_name / display_name / name）搜索 Slack 用户。
    支持中文姓名、英文用户名、模糊匹配。
    """
    print(f"  搜索用户：{name} ...", file=sys.stderr)

    try:
        members = client.paginate("users_list", "members", limit=200)
    except SlackScopeError as e:
        print(f"  ❌ {e}", file=sys.stderr)
        sys.exit(1)

    # 过滤掉 Bot / 已停用账号
    members = [
        m for m in members
        if not m.get("is_bot") and not m.get("deleted") and m.get("id") != "USLACKBOT"
    ]

    name_lower = name.lower()

    def score(member: dict) -> int:
        profile = member.get("profile", {})
        real_name = (profile.get("real_name") or "").lower()
        display_name = (profile.get("display_name") or "").lower()
        username = (member.get("name") or "").lower()

        if name_lower in (real_name, display_name, username):
            return 3  # 精确匹配
        if (
            name_lower in real_name
            or name_lower in display_name
            or name_lower in username
        ):
            return 2  # 包含匹配
        # 中文名字拆字匹配
        if all(ch in real_name or ch in display_name for ch in name_lower if ch.strip()):
            return 1
        return 0

    scored = [(score(m), m) for m in members]
    candidates = [(s, m) for s, m in scored if s > 0]

    if not candidates:
        print(f"  未找到用户：{name}", file=sys.stderr)
        print(
            "  提示：请确认姓名拼写，或尝试用英文用户名（如 john.doe）",
            file=sys.stderr,
        )
        return None

    candidates.sort(key=lambda x: -x[0])

    if len(candidates) == 1:
        _, user = candidates[0]
        _print_user(user)
        return user

    # 多个候选，让用户选择
    print(f"\n  找到 {len(candidates)} 个匹配，请选择：")
    for i, (_, m) in enumerate(candidates[:10]):
        profile = m.get("profile", {})
        real_name = profile.get("real_name", "")
        display_name = profile.get("display_name", "")
        username = m.get("name", "")
        title = profile.get("title", "")
        print(f"    [{i+1}] {real_name}（@{display_name or username}）  {title}")

    choice = input("\n  选择编号（默认 1）：").strip() or "1"
    try:
        idx = int(choice) - 1
        _, user = candidates[idx]
    except (ValueError, IndexError):
        _, user = candidates[0]

    _print_user(user)
    return user


def _print_user(user: dict) -> None:
    profile = user.get("profile", {})
    real_name = profile.get("real_name", user.get("name", ""))
    display_name = profile.get("display_name", "")
    title = profile.get("title", "")
    print(
        f"  找到用户：{real_name}（@{display_name}）  {title}",
        file=sys.stderr,
    )


# ─── 频道发现 ──────────────────────────────────────────────────────────────────

def get_channels_with_user(
    user_id: str,
    channel_limit: int,
    client: RateLimitedClient,
) -> list:
    """
    返回 Bot 已加入、且目标用户也在其中的所有频道。
    策略：先列出 Bot 的所有频道，再逐个检查成员列表。
    """
    print("  获取频道列表 ...", file=sys.stderr)

    try:
        channels = client.paginate(
            "conversations_list",
            "channels",
            types=CHANNEL_TYPES,
            exclude_archived=True,
            limit=200,
        )
    except SlackScopeError as e:
        print(f"  ❌ {e}", file=sys.stderr)
        return []

    # 只保留 Bot 是成员的频道
    bot_channels = [c for c in channels if c.get("is_member")]
    print(f"  Bot 已加入 {len(bot_channels)} 个频道，检查成员 ...", file=sys.stderr)

    if len(bot_channels) > channel_limit:
        print(
            f"  频道数超过上限 {channel_limit}，只检查前 {channel_limit} 个",
            file=sys.stderr,
        )
        bot_channels = bot_channels[:channel_limit]

    result = []
    for ch in bot_channels:
        ch_id = ch.get("id", "")
        ch_name = ch.get("name", ch_id)

        try:
            members = client.paginate(
                "conversations_members",
                "members",
                channel=ch_id,
                limit=200,
            )
        except SlackApiError as e:
            err = e.response.get("error", "")
            if err in ("not_in_channel", "channel_not_found"):
                continue
            print(f"    跳过频道 {ch_name}（{err}）", file=sys.stderr)
            continue
        except SlackScopeError as e:
            print(f"  ❌ {e}", file=sys.stderr)
            continue

        if user_id in members:
            result.append(ch)
            print(f"    ✓ #{ch_name}", file=sys.stderr)

    return result


# ─── 消息采集 ──────────────────────────────────────────────────────────────────

def fetch_messages_from_channel(
    channel_id: str,
    channel_name: str,
    user_id: str,
    limit: int,
    client: RateLimitedClient,
) -> list:
    """
    从指定频道拉取目标用户发出的消息。
    按时间倒序翻页，直到达到 limit 或无更多数据。
    """
    messages = []
    cursor = None
    pages_fetched = 0
    MAX_PAGES = 50  # 防止无限翻页

    while len(messages) < limit and pages_fetched < MAX_PAGES:
        params: dict = {"channel": channel_id, "limit": 200}
        if cursor:
            params["cursor"] = cursor

        try:
            data = client.call("conversations_history", **params)
        except SlackApiError as e:
            err = e.response.get("error", "")
            if err == "not_in_channel":
                print(
                    f"    Bot 不在频道 #{channel_name}，跳过（请 /invite @bot）",
                    file=sys.stderr,
                )
            else:
                print(f"    拉取 #{channel_name} 失败（{err}）", file=sys.stderr)
            break

        if not data:
            break

        pages_fetched += 1
        raw_msgs = data.get("messages", [])

        for msg in raw_msgs:
            # 只要目标用户发的、非系统消息
            if msg.get("user") != user_id:
                continue
            if msg.get("subtype"):  # join/leave/bot_message 等系统类型
                continue

            text = msg.get("text", "").strip()
            if not text:
                continue

            # 过滤纯 emoji 或纯附件消息
            if _is_noise(text):
                continue

            ts_raw = msg.get("ts", "")
            time_str = _format_ts(ts_raw)

            # 包含 thread_reply_count 说明是话题发起消息，权重更高
            is_thread_starter = bool(msg.get("reply_count", 0))

            messages.append(
                {
                    "content": text,
                    "time": time_str,
                    "channel": channel_name,
                    "is_thread_starter": is_thread_starter,
                }
            )

        meta = data.get("response_metadata", {})
        cursor = meta.get("next_cursor")
        if not cursor:
            break

    return messages[:limit]


def _is_noise(text: str) -> bool:
    """判断是否是无意义消息（纯表情、@mention、URL）"""
    import re
    # 去掉 Slack 特殊格式后几乎为空
    cleaned = re.sub(r"<[^>]+>", "", text).strip()
    cleaned = re.sub(r":[a-z_]+:", "", cleaned).strip()
    return len(cleaned) < 2


def _format_ts(ts: str) -> str:
    """将 Slack timestamp（Unix float string）转为可读时间"""
    try:
        return datetime.fromtimestamp(float(ts)).strftime("%Y-%m-%d %H:%M")
    except (ValueError, OSError):
        return ts


# ─── 主采集流程 ────────────────────────────────────────────────────────────────

def collect_messages(
    user: dict,
    channels: list,
    msg_limit: int,
    client: RateLimitedClient,
) -> str:
    """从所有频道采集目标用户消息，返回格式化文本"""
    user_id = user["id"]
    name = user.get("profile", {}).get("real_name") or user.get("name", user_id)

    if not channels:
        return (
            f"# 消息记录\n\n"
            f"未找到与 {name} 共同的频道。\n"
            f"请确认 Bot 已被添加到相关频道（/invite @bot）\n"
        )

    all_messages: list = []
    per_channel_limit = max(100, msg_limit // len(channels))

    for ch in channels:
        ch_id = ch.get("id", "")
        ch_name = ch.get("name", ch_id)
        print(f"  拉取 #{ch_name} 的消息 ...", file=sys.stderr)

        msgs = fetch_messages_from_channel(
            ch_id, ch_name, user_id, per_channel_limit, client
        )
        all_messages.extend(msgs)
        print(f"    获取 {len(msgs)} 条", file=sys.stderr)

    # 按权重分类
    thread_msgs = [m for m in all_messages if m["is_thread_starter"]]
    long_msgs = [
        m for m in all_messages
        if not m["is_thread_starter"] and len(m["content"]) > 50
    ]
    short_msgs = [
        m for m in all_messages
        if not m["is_thread_starter"] and len(m["content"]) <= 50
    ]

    channel_names = ", ".join(f"#{c.get('name', c.get('id', ''))}" for c in channels)

    lines = [
        "# Slack 消息记录（自动采集）",
        f"目标：{name}",
        f"来源频道：{channel_names}",
        f"共 {len(all_messages)} 条消息",
        f"  话题发起消息：{len(thread_msgs)} 条",
        f"  长消息（>50字）：{len(long_msgs)} 条",
        f"  短消息：{len(short_msgs)} 条",
        "",
        "---",
        "",
        "## 话题发起消息（权重最高：观点/决策/技术分享）",
        "",
    ]
    for m in thread_msgs:
        lines.append(f"[{m['time']}][#{m['channel']}] {m['content']}")
        lines.append("")

    lines += [
        "---",
        "",
        "## 长消息（观点/方案/讨论类）",
        "",
    ]
    for m in long_msgs:
        lines.append(f"[{m['time']}][#{m['channel']}] {m['content']}")
        lines.append("")

    lines += ["---", "", "## 日常消息（风格参考）", ""]
    for m in short_msgs[:300]:
        lines.append(f"[{m['time']}] {m['content']}")

    return "\n".join(lines)


def collect_all(
    name: str,
    output_dir: Path,
    msg_limit: int,
    channel_limit: int,
    config: dict,
) -> dict:
    """采集某同事的所有 Slack 数据，输出到 output_dir"""
    output_dir.mkdir(parents=True, exist_ok=True)
    results: dict = {}

    print(f"\n🔍 开始采集：{name}\n", file=sys.stderr)

    # 初始化 Client
    try:
        client = RateLimitedClient(config["bot_token"])
        # 快速验证 token 有效性
        auth_data = client.call("auth_test")
        if not auth_data:
            raise SlackAuthError("auth_test 无响应，请检查 Token")
        print(
            f"  Workspace：{auth_data.get('team')}，Bot：{auth_data.get('user')}",
            file=sys.stderr,
        )
    except SlackAuthError as e:
        print(f"❌ {e}", file=sys.stderr)
        sys.exit(1)

    # Step 1: 搜索用户
    user = find_user(name, client)
    if not user:
        print(f"❌ 未找到用户 {name}，请检查姓名/用户名是否正确", file=sys.stderr)
        sys.exit(1)

    user_id = user["id"]
    profile = user.get("profile", {})
    real_name = profile.get("real_name") or user.get("name", user_id)

    # Step 2: 找共同频道
    print(f"\n📡 查找与 {real_name} 共同的频道（上限 {channel_limit} 个）...", file=sys.stderr)
    channels = get_channels_with_user(user_id, channel_limit, client)
    print(f"  共同频道：{len(channels)} 个", file=sys.stderr)

    # Step 3: 采集消息
    print(f"\n📨 采集消息记录（上限 {msg_limit} 条）...", file=sys.stderr)
    try:
        msg_content = collect_messages(user, channels, msg_limit, client)
        msg_path = output_dir / "messages.txt"
        msg_path.write_text(msg_content, encoding="utf-8")
        results["messages"] = str(msg_path)
        print(f"  ✅ 消息记录 → {msg_path}", file=sys.stderr)
    except SlackCollectorError as e:
        print(f"  ❌ {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"  ⚠️  消息采集失败：{e}", file=sys.stderr)

    # 写摘要
    summary = {
        "name": real_name,
        "slack_user_id": user_id,
        "display_name": profile.get("display_name", ""),
        "title": profile.get("title", ""),
        "channels": [
            {"id": c.get("id"), "name": c.get("name")} for c in channels
        ],
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "files": results,
        "note": "免费版 Workspace 仅保留最近 90 天消息",
    }
    summary_path = output_dir / "collection_summary.json"
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2))
    print(f"  ✅ 采集摘要 → {summary_path}", file=sys.stderr)

    print(f"\n✅ 采集完成，输出目录：{output_dir}", file=sys.stderr)
    return results


# ─── CLI 入口 ──────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Slack 数据自动采集器",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例：
  # 首次配置
  python3 slack_auto_collector.py --setup

  # 采集同事数据
  python3 slack_auto_collector.py --name "张三"
  python3 slack_auto_collector.py --name "john.doe" --output-dir ./knowledge/john --msg-limit 500
        """,
    )
    parser.add_argument("--setup", action="store_true", help="初始化配置（Bot Token）")
    parser.add_argument("--name", help="同事姓名或 Slack 用户名")
    parser.add_argument(
        "--output-dir",
        default=None,
        help="输出目录（默认 ./knowledge/{name}）",
    )
    parser.add_argument(
        "--msg-limit",
        type=int,
        default=DEFAULT_MSG_LIMIT,
        help=f"最多采集消息条数（默认 {DEFAULT_MSG_LIMIT}）",
    )
    parser.add_argument(
        "--channel-limit",
        type=int,
        default=DEFAULT_CHANNEL_LIMIT,
        help=f"最多检查频道数（默认 {DEFAULT_CHANNEL_LIMIT}）",
    )

    args = parser.parse_args()

    if args.setup:
        setup_config()
        return

    if not args.name:
        parser.print_help()
        parser.error("请提供 --name 参数")

    config = load_config()
    output_dir = (
        Path(args.output_dir)
        if args.output_dir
        else Path(f"./knowledge/{args.name}")
    )

    try:
        collect_all(
            name=args.name,
            output_dir=output_dir,
            msg_limit=args.msg_limit,
            channel_limit=args.channel_limit,
            config=config,
        )
    except SlackCollectorError as e:
        print(f"\n❌ 采集失败：{e}", file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n\n已取消", file=sys.stderr)
        sys.exit(0)


if __name__ == "__main__":
    main()
