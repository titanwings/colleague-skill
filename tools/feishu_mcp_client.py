#!/usr/bin/env python3
"""
飞书 MCP 客户端封装（cso1z/Feishu-MCP 方案）

通过 Feishu MCP Server 读取文档、wiki、消息记录。
适合：公司已授权的文档、有 App token 权限的内容。

前置要求：
  1. 安装 Feishu MCP：npm install -g feishu-mcp
  2. 配置 App ID 和 App Secret（飞书开放平台创建企业自建应用）
  3. 给应用开通必要权限（见下方 REQUIRED_PERMISSIONS）

权限列表（飞书开放平台 → 权限管理 → 开通）：
  - docs:doc:readonly          读取文档
  - wiki:wiki:readonly         读取知识库
  - im:message:readonly        读取消息
  - bitable:app:readonly       读取多维表格
  - sheets:spreadsheet:readonly 读取表格

用法：
  # 配置 token（一次性）
  python3 feishu_mcp_client.py --setup

  # 读取文档
  python3 feishu_mcp_client.py --url "https://xxx.feishu.cn/wiki/xxx" --output out.txt

  # 读取消息记录
  python3 feishu_mcp_client.py --chat-id "oc_xxx" --target "张三" --output out.txt

  # 列出某空间下的所有文档
  python3 feishu_mcp_client.py --list-wiki --space-id "xxx"
"""

from __future__ import annotations

import os
import sys
import json
import argparse
import subprocess
from getpass import getpass
from pathlib import Path
from typing import Optional


CONFIG_PATH = Path.home() / ".colleague-skill" / "feishu_config.json"


# ─── 配置管理 ────────────────────────────────────────────────────────────────

def load_config() -> dict:
    if CONFIG_PATH.exists():
        return json.loads(CONFIG_PATH.read_text())
    return {}


def save_config(config: dict) -> None:
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(config, indent=2))
    print(f"配置已保存到 {CONFIG_PATH}")


def setup_config() -> None:
    print("=== 飞书 MCP 配置 ===")
    print("请前往飞书开放平台（open.feishu.cn）创建企业自建应用，获取以下信息：\n")

    app_id = input("App ID (cli_xxx): ").strip()
    app_secret = getpass("App Secret: ").strip()

    print("\n配置方式选择：")
    print("  [1] App Token（应用权限，需要在飞书后台开通对应权限）")
    print("  [2] User Token（个人权限，能访问你本人有权限的所有内容，需要定期刷新）")
    mode = input("选择 [1/2]，默认 1：").strip() or "1"

    config = {
        "app_id": app_id,
        "app_secret": app_secret,
        "mode": "app" if mode == "1" else "user",
    }

    if mode == "2":
        print("\n获取 User Token：飞书开放平台 → OAuth 2.0 → 获取 user_access_token")
        user_token = getpass("User Access Token (u-xxx)：").strip()
        config["user_token"] = user_token
        print("注意：User Token 有效期约 2 小时，过期后需要重新配置")

    save_config(config)
    print("\n✅ 配置完成！")


# ─── MCP 调用封装 ─────────────────────────────────────────────────────────────

def call_mcp(tool: str, params: dict, config: dict) -> dict:
    """
    通过 npx 调用 feishu-mcp 工具。
    feishu-mcp 支持 stdio 模式，直接 JSON 通信。
    """
    env = os.environ.copy()
    env["FEISHU_APP_ID"] = config.get("app_id", "")
    env["FEISHU_APP_SECRET"] = config.get("app_secret", "")

    if config.get("mode") == "user" and config.get("user_token"):
        env["FEISHU_USER_ACCESS_TOKEN"] = config["user_token"]

    payload = json.dumps({
        "jsonrpc": "2.0",
        "method": "tools/call",
        "params": {
            "name": tool,
            "arguments": params,
        },
        "id": 1,
    })

    try:
        result = subprocess.run(
            ["npx", "-y", "feishu-mcp", "--stdio"],
            input=payload,
            capture_output=True,
            text=True,
            env=env,
            timeout=30,
        )
        if result.returncode != 0:
            raise RuntimeError(f"MCP 调用失败：{result.stderr}")
        return json.loads(result.stdout)
    except FileNotFoundError:
        print("错误：未找到 npx，请先安装 Node.js", file=sys.stderr)
        print("安装 Feishu MCP：npm install -g feishu-mcp", file=sys.stderr)
        sys.exit(1)


def extract_doc_token(url: str) -> tuple[str, str]:
    """从飞书 URL 中提取文档 token 和类型"""
    import re
    patterns = [
        (r"/wiki/([A-Za-z0-9]+)", "wiki"),
        (r"/docx/([A-Za-z0-9]+)", "docx"),
        (r"/docs/([A-Za-z0-9]+)", "doc"),
        (r"/sheets/([A-Za-z0-9]+)", "sheet"),
        (r"/base/([A-Za-z0-9]+)", "base"),
    ]
    for pattern, doc_type in patterns:
        m = re.search(pattern, url)
        if m:
            return m.group(1), doc_type
    raise ValueError(f"无法从 URL 解析文档 token：{url}")


# ─── 功能函数 ─────────────────────────────────────────────────────────────────

def fetch_doc_via_mcp(url: str, config: dict) -> str:
    """通过 MCP 读取飞书文档或 Wiki"""
    token, doc_type = extract_doc_token(url)

    if doc_type == "wiki":
        result = call_mcp("get_wiki_node", {"token": token}, config)
    elif doc_type in ("docx", "doc"):
        result = call_mcp("get_doc_content", {"doc_token": token}, config)
    elif doc_type == "sheet":
        result = call_mcp("get_spreadsheet_content", {"spreadsheet_token": token}, config)
    else:
        raise ValueError(f"不支持的文档类型：{doc_type}")

    # 提取 MCP 返回的内容
    if "result" in result:
        content = result["result"]
        if isinstance(content, list):
            # MCP tool result 格式
            for item in content:
                if isinstance(item, dict) and item.get("type") == "text":
                    return item.get("text", "")
        elif isinstance(content, str):
            return content
    elif "error" in result:
        raise RuntimeError(f"MCP 返回错误：{result['error']}")

    return json.dumps(result, ensure_ascii=False, indent=2)


def fetch_messages_via_mcp(
    chat_id: str,
    target_name: str,
    limit: int,
    config: dict,
) -> str:
    """通过 MCP 读取群聊消息记录"""
    result = call_mcp(
        "get_chat_messages",
        {
            "chat_id": chat_id,
            "page_size": min(limit, 50),  # 飞书 API 单次最多 50 条
        },
        config,
    )

    messages = []
    raw = result.get("result", [])
    if isinstance(raw, list):
        messages = raw
    elif isinstance(raw, str):
        try:
            messages = json.loads(raw)
        except Exception:
            return raw

    # 过滤目标人物
    if target_name:
        messages = [
            m for m in messages
            if target_name in str(m.get("sender", {}).get("name", ""))
        ]

    # 分类输出
    long_msgs = [m for m in messages if len(str(m.get("content", ""))) > 50]
    short_msgs = [m for m in messages if len(str(m.get("content", ""))) <= 50]

    lines = [
        "# 飞书消息记录（MCP 方案）",
        f"群聊 ID：{chat_id}",
        f"目标人物：{target_name or '全部'}",
        f"共 {len(messages)} 条",
        "",
        "---",
        "",
        "## 长消息",
        "",
    ]
    for m in long_msgs:
        sender = m.get("sender", {}).get("name", "")
        content = m.get("content", "")
        ts = m.get("create_time", "")
        lines.append(f"[{ts}] {sender}：{content}")
        lines.append("")

    lines += ["---", "", "## 日常消息", ""]
    for m in short_msgs[:200]:
        sender = m.get("sender", {}).get("name", "")
        content = m.get("content", "")
        lines.append(f"{sender}：{content}")

    return "\n".join(lines)


def list_wiki_docs(space_id: str, config: dict) -> str:
    """列出知识库空间下的所有文档"""
    result = call_mcp("list_wiki_nodes", {"space_id": space_id}, config)
    raw = result.get("result", "")
    if isinstance(raw, str):
        return raw
    return json.dumps(raw, ensure_ascii=False, indent=2)


# ─── CLI ─────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="飞书 MCP 客户端")
    parser.add_argument("--setup", action="store_true", help="初始化配置（App ID / Secret）")
    parser.add_argument("--url", help="飞书文档/Wiki/表格链接")
    parser.add_argument("--chat-id", help="群聊 ID（oc_xxx 格式）")
    parser.add_argument("--target", help="目标人物姓名")
    parser.add_argument("--limit", type=int, default=500, help="最多获取消息数")
    parser.add_argument("--list-wiki", action="store_true", help="列出知识库文档")
    parser.add_argument("--space-id", help="知识库 Space ID")
    parser.add_argument("--output", default=None, help="输出文件路径")

    args = parser.parse_args()

    if args.setup:
        setup_config()
        return

    config = load_config()
    if not config:
        print("错误：尚未配置，请先运行：python3 feishu_mcp_client.py --setup", file=sys.stderr)
        sys.exit(1)

    content = ""

    if args.url:
        print(f"通过 MCP 读取：{args.url}", file=sys.stderr)
        content = fetch_doc_via_mcp(args.url, config)

    elif args.chat_id:
        print(f"通过 MCP 读取消息：{args.chat_id}", file=sys.stderr)
        content = fetch_messages_via_mcp(
            args.chat_id,
            args.target or "",
            args.limit,
            config,
        )

    elif args.list_wiki:
        if not args.space_id:
            print("错误：--list-wiki 需要 --space-id", file=sys.stderr)
            sys.exit(1)
        content = list_wiki_docs(args.space_id, config)

    else:
        parser.print_help()
        return

    if args.output:
        Path(args.output).write_text(content, encoding="utf-8")
        print(f"✅ 已保存到 {args.output}", file=sys.stderr)
    else:
        print(content)


if __name__ == "__main__":
    main()
