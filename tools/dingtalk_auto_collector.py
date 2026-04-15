#!/usr/bin/env python3
"""
钉钉自动采集器

输入同事姓名，自动：
  1. 搜索钉钉用户，获取 userId
  2. 搜索他创建/编辑的文档和知识库内容
  3. 拉取多维表格（如有）
  4. 消息记录（API 不支持历史拉取，自动切换浏览器方案）
  5. 输出统一格式，直接进 create-colleague 分析流程

钉钉限制说明：
  钉钉 Open API 不提供历史消息拉取接口，
  消息记录部分自动使用 Playwright 浏览器方案采集。

前置：
  pip3 install requests playwright
  playwright install chromium
  python3 dingtalk_auto_collector.py --setup

用法：
  python3 dingtalk_auto_collector.py --name "张三" --output-dir ./knowledge/zhangsan
  python3 dingtalk_auto_collector.py --name "张三" --skip-messages   # 跳过消息采集
  python3 dingtalk_auto_collector.py --name "张三" --doc-limit 20
"""

from __future__ import annotations

import json
import sys
import time
import argparse
import platform
from getpass import getpass
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

try:
    import requests
except ImportError:
    print("错误：请先安装依赖：pip3 install requests", file=sys.stderr)
    sys.exit(1)


CONFIG_PATH = Path.home() / ".colleague-skill" / "dingtalk_config.json"
API_BASE = "https://api.dingtalk.com"


# ─── 配置 ────────────────────────────────────────────────────────────────────

def load_config() -> dict:
    if not CONFIG_PATH.exists():
        print("未找到配置，请先运行：python3 dingtalk_auto_collector.py --setup", file=sys.stderr)
        sys.exit(1)
    return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))


def save_config(config: dict) -> None:
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(config, indent=2, ensure_ascii=False))


def setup_config() -> None:
    print("=== 钉钉自动采集配置 ===\n")
    print("请前往 https://open-dev.dingtalk.com 创建企业内部应用，开通以下权限：\n")
    print("  通讯录类：")
    print("    qyapi_get_member_detail     查询用户详情")
    print("    Contact.User.mobile         读取用户手机号（可选）")
    print()
    print("  消息类（可选，仅用于发消息，历史消息需浏览器方案）：")
    print("    qyapi_robot_sendmsg         机器人发消息")
    print()
    print("  文档类：")
    print("    Doc.WorkSpace.READ          读取工作空间")
    print("    Doc.File.READ               读取文件")
    print()
    print("  多维表格：")
    print("    Bitable.Record.READ         读取记录")
    print()

    app_key = input("AppKey (ding_xxx): ").strip()
    app_secret = getpass("AppSecret: ").strip()

    config = {"app_key": app_key, "app_secret": app_secret}
    save_config(config)
    print(f"\n✅ 配置已保存到 {CONFIG_PATH}")
    print("\n注意：消息记录采集需要 Playwright，请确认已安装：")
    print("  pip3 install playwright && playwright install chromium")


# ─── Token ───────────────────────────────────────────────────────────────────

_token_cache: dict = {}


def get_access_token(config: dict) -> str:
    """获取钉钉 access_token，带缓存"""
    now = time.time()
    if _token_cache.get("token") and _token_cache.get("expire", 0) > now + 60:
        return _token_cache["token"]

    resp = requests.post(
        f"{API_BASE}/v1.0/oauth2/accessToken",
        json={"appKey": config["app_key"], "appSecret": config["app_secret"]},
        timeout=10,
    )
    data = resp.json()

    if "accessToken" not in data:
        print(f"获取 token 失败：{data}", file=sys.stderr)
        sys.exit(1)

    token = data["accessToken"]
    _token_cache["token"] = token
    _token_cache["expire"] = now + data.get("expireIn", 7200)
    return token


def api_get(path: str, params: dict, config: dict) -> dict:
    token = get_access_token(config)
    resp = requests.get(
        f"{API_BASE}{path}",
        params=params,
        headers={"x-acs-dingtalk-access-token": token},
        timeout=15,
    )
    return resp.json()


def api_post(path: str, body: dict, config: dict) -> dict:
    token = get_access_token(config)
    resp = requests.post(
        f"{API_BASE}{path}",
        json=body,
        headers={"x-acs-dingtalk-access-token": token},
        timeout=15,
    )
    return resp.json()


# ─── 用户搜索 ─────────────────────────────────────────────────────────────────

def find_user(name: str, config: dict) -> Optional[dict]:
    """通过姓名搜索钉钉用户"""
    print(f"  搜索用户：{name} ...", file=sys.stderr)

    data = api_post(
        "/v1.0/contact/users/search",
        {"searchText": name, "offset": 0, "size": 10},
        config,
    )

    users = data.get("list", []) or data.get("result", {}).get("list", [])

    if not users:
        # 降级：通过部门遍历搜索
        print("  API 搜索无结果，尝试遍历通讯录 ...", file=sys.stderr)
        users = search_users_by_dept(name, config)

    if not users:
        print(f"  未找到用户：{name}", file=sys.stderr)
        return None

    if len(users) == 1:
        u = users[0]
        print(f"  找到用户：{u.get('name')}（{u.get('deptNameList', [''])[0] if isinstance(u.get('deptNameList'), list) else ''}）", file=sys.stderr)
        return u

    print(f"\n  找到 {len(users)} 个结果，请选择：")
    for i, u in enumerate(users):
        dept = u.get("deptNameList", [""])
        dept_str = dept[0] if isinstance(dept, list) and dept else ""
        print(f"    [{i+1}] {u.get('name')}  {dept_str}  {u.get('unionId', '')}")

    choice = input("\n  选择编号（默认 1）：").strip() or "1"
    try:
        return users[int(choice) - 1]
    except (ValueError, IndexError):
        return users[0]


def search_users_by_dept(name: str, config: dict, dept_id: int = 1, depth: int = 0) -> list:
    """递归遍历部门搜索用户（深度限制 3 层）"""
    if depth > 3:
        return []

    results = []

    # 获取部门用户列表
    data = api_post(
        "/v1.0/contact/users/simplelist",
        {"deptId": dept_id, "cursor": 0, "size": 100},
        config,
    )
    users = data.get("list", [])
    for u in users:
        if name in u.get("name", ""):
            # 获取详细信息
            detail = api_get(f"/v1.0/contact/users/{u.get('userId')}", {}, config)
            results.append(detail.get("result", u))

    # 获取子部门
    sub_data = api_get(
        "/v1.0/contact/departments/listSubDepts",
        {"deptId": dept_id},
        config,
    )
    for sub in sub_data.get("result", []):
        results.extend(search_users_by_dept(name, config, sub.get("deptId"), depth + 1))

    return results


# ─── 文档采集 ─────────────────────────────────────────────────────────────────

def list_workspaces(config: dict) -> list:
    """获取所有工作空间"""
    data = api_get("/v1.0/doc/workspaces", {"maxResults": 50}, config)
    return data.get("workspaceModels", []) or data.get("result", {}).get("workspaceModels", [])


def search_docs_by_user(user_id: str, name: str, doc_limit: int, config: dict) -> list:
    """搜索用户创建的文档"""
    print(f"  搜索 {name} 的文档 ...", file=sys.stderr)

    # 方式一：全局搜索
    data = api_post(
        "/v1.0/doc/search",
        {
            "keyword": name,
            "size": doc_limit,
            "offset": 0,
        },
        config,
    )

    docs = []
    items = data.get("docList", []) or data.get("result", {}).get("docList", [])

    for item in items:
        creator_id = item.get("creatorId", "") or item.get("creator", {}).get("userId", "")
        # 过滤：只保留目标用户创建的
        if user_id and creator_id and creator_id != user_id:
            continue
        docs.append({
            "title": item.get("title", "无标题"),
            "docId": item.get("docId", ""),
            "spaceId": item.get("spaceId", ""),
            "type": item.get("docType", ""),
            "url": item.get("shareUrl", ""),
            "creator": item.get("creatorName", name),
        })

    if not docs:
        # 方式二：遍历工作空间找文档
        print("  搜索无结果，遍历工作空间 ...", file=sys.stderr)
        workspaces = list_workspaces(config)
        for ws in workspaces[:5]:  # 最多查 5 个空间
            ws_id = ws.get("spaceId") or ws.get("workspaceId")
            if not ws_id:
                continue
            files_data = api_get(
                f"/v1.0/doc/workspaces/{ws_id}/files",
                {"maxResults": 20, "orderBy": "modified_time", "order": "DESC"},
                config,
            )
            for f in files_data.get("files", []):
                creator_id = f.get("creatorId", "")
                if user_id and creator_id and creator_id != user_id:
                    continue
                docs.append({
                    "title": f.get("fileName", "无标题"),
                    "docId": f.get("docId", ""),
                    "spaceId": ws_id,
                    "type": f.get("docType", ""),
                    "url": f.get("shareUrl", ""),
                    "creator": name,
                })

    print(f"  找到 {len(docs)} 篇文档", file=sys.stderr)
    return docs[:doc_limit]


def fetch_doc_content(doc_id: str, space_id: str, config: dict) -> str:
    """拉取单篇文档的文本内容"""
    # 方式一：直接获取文档内容
    data = api_get(
        f"/v1.0/doc/workspaces/{space_id}/files/{doc_id}/content",
        {},
        config,
    )

    content = (
        data.get("content")
        or data.get("result", {}).get("content")
        or data.get("markdown")
        or data.get("result", {}).get("markdown")
        or ""
    )

    if content:
        return content

    # 方式二：获取下载链接后下载
    dl_data = api_get(
        f"/v1.0/doc/workspaces/{space_id}/files/{doc_id}/download",
        {},
        config,
    )
    dl_url = dl_data.get("downloadUrl") or dl_data.get("result", {}).get("downloadUrl")
    if dl_url:
        try:
            resp = requests.get(dl_url, timeout=15)
            return resp.text
        except Exception:
            pass

    return ""


def collect_docs(user: dict, doc_limit: int, config: dict) -> str:
    """采集目标用户的文档"""
    user_id = user.get("userId", "")
    name = user.get("name", "")

    docs = search_docs_by_user(user_id, name, doc_limit, config)
    if not docs:
        return f"# 文档内容\n\n未找到 {name} 相关文档\n"

    lines = [
        "# 文档内容（钉钉自动采集）",
        f"目标：{name}",
        f"共 {len(docs)} 篇",
        "",
    ]

    for doc in docs:
        title = doc.get("title", "无标题")
        doc_id = doc.get("docId", "")
        space_id = doc.get("spaceId", "")
        url = doc.get("url", "")

        if not doc_id or not space_id:
            continue

        print(f"  拉取文档：{title} ...", file=sys.stderr)
        content = fetch_doc_content(doc_id, space_id, config)

        if not content or len(content.strip()) < 20:
            print(f"    内容为空，跳过", file=sys.stderr)
            continue

        lines += [
            "---",
            f"## 《{title}》",
            f"链接：{url}",
            f"创建人：{doc.get('creator', '')}",
            "",
            content.strip(),
            "",
        ]

    return "\n".join(lines)


# ─── 多维表格 ─────────────────────────────────────────────────────────────────

def search_bitables(user_id: str, name: str, config: dict) -> list:
    """搜索目标用户的多维表格"""
    print(f"  搜索 {name} 的多维表格 ...", file=sys.stderr)

    data = api_post(
        "/v1.0/doc/search",
        {"keyword": name, "size": 20, "offset": 0, "docTypes": ["bitable"]},
        config,
    )

    tables = []
    for item in data.get("docList", []):
        if item.get("docType") != "bitable":
            continue
        creator_id = item.get("creatorId", "")
        if user_id and creator_id and creator_id != user_id:
            continue
        tables.append(item)

    print(f"  找到 {len(tables)} 个多维表格", file=sys.stderr)
    return tables


def fetch_bitable_content(base_id: str, config: dict) -> str:
    """拉取多维表格内容"""
    # 获取所有 sheet
    sheets_data = api_get(
        f"/v1.0/bitable/bases/{base_id}/sheets",
        {},
        config,
    )
    sheets = sheets_data.get("sheets", []) or sheets_data.get("result", {}).get("sheets", [])

    if not sheets:
        return "（多维表格为空或无权限）\n"

    lines = []
    for sheet in sheets:
        sheet_id = sheet.get("sheetId") or sheet.get("id")
        sheet_name = sheet.get("name", sheet_id)

        # 获取字段
        fields_data = api_get(
            f"/v1.0/bitable/bases/{base_id}/sheets/{sheet_id}/fields",
            {"maxResults": 100},
            config,
        )
        fields = [f.get("name", "") for f in fields_data.get("fields", [])]

        # 获取记录
        records_data = api_get(
            f"/v1.0/bitable/bases/{base_id}/sheets/{sheet_id}/records",
            {"maxResults": 200},
            config,
        )
        records = records_data.get("records", []) or records_data.get("result", {}).get("records", [])

        lines.append(f"### 表：{sheet_name}")
        lines.append("")

        if fields:
            lines.append("| " + " | ".join(fields) + " |")
            lines.append("| " + " | ".join(["---"] * len(fields)) + " |")

        for rec in records:
            row_data = rec.get("fields", {})
            row = []
            for f in fields:
                val = row_data.get(f, "")
                if isinstance(val, list):
                    val = " ".join(
                        v.get("text", str(v)) if isinstance(v, dict) else str(v)
                        for v in val
                    )
                row.append(str(val).replace("|", "｜").replace("\n", " "))
            lines.append("| " + " | ".join(row) + " |")

        lines.append("")

    return "\n".join(lines)


def collect_bitables(user: dict, config: dict) -> str:
    """采集目标用户的多维表格"""
    user_id = user.get("userId", "")
    name = user.get("name", "")

    tables = search_bitables(user_id, name, config)
    if not tables:
        return f"# 多维表格\n\n未找到 {name} 的多维表格\n"

    lines = [
        "# 多维表格（钉钉自动采集）",
        f"目标：{name}",
        f"共 {len(tables)} 个",
        "",
    ]

    for t in tables:
        title = t.get("title", "无标题")
        doc_id = t.get("docId", "")
        print(f"  拉取多维表格：{title} ...", file=sys.stderr)

        content = fetch_bitable_content(doc_id, config)
        lines += [
            "---",
            f"## 《{title}》",
            "",
            content,
        ]

    return "\n".join(lines)


# ─── 消息记录（浏览器方案）────────────────────────────────────────────────────

def get_default_chrome_profile() -> str:
    system = platform.system()
    if system == "Darwin":
        return str(Path.home() / "Library/Application Support/Google/Chrome/Default")
    elif system == "Linux":
        return str(Path.home() / ".config/google-chrome/Default")
    elif system == "Windows":
        import os
        return str(Path(os.environ.get("LOCALAPPDATA", "")) / "Google/Chrome/User Data/Default")
    return str(Path.home() / ".config/google-chrome/Default")


def collect_messages_browser(
    name: str,
    msg_limit: int,
    chrome_profile: Optional[str],
    headless: bool,
) -> str:
    """通过 Playwright 浏览器抓取钉钉网页版消息记录"""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return (
            "# 消息记录\n\n"
            "⚠️  未安装 Playwright，无法采集消息记录。\n"
            "请运行：pip3 install playwright && playwright install chromium\n"
        )

    import re

    profile = chrome_profile or get_default_chrome_profile()
    print(f"  启动浏览器抓取钉钉消息（{'无头' if headless else '有界面'}）...", file=sys.stderr)

    messages = []

    with sync_playwright() as p:
        try:
            ctx = p.chromium.launch_persistent_context(
                user_data_dir=profile,
                headless=headless,
                args=["--disable-blink-features=AutomationControlled"],
                ignore_default_args=["--enable-automation"],
                viewport={"width": 1280, "height": 900},
            )
        except Exception as e:
            return f"# 消息记录\n\n⚠️  无法启动浏览器：{e}\n"

        page = ctx.new_page()

        # 打开钉钉网页版
        page.goto("https://im.dingtalk.com", wait_until="domcontentloaded", timeout=20000)
        time.sleep(3)

        # 检查登录状态
        if "login" in page.url.lower() or page.query_selector(".login-wrap"):
            if headless:
                ctx.close()
                return (
                    "# 消息记录\n\n"
                    "⚠️  检测到未登录。请用 --show-browser 参数重新运行，在弹出窗口中登录钉钉。\n"
                )
            print("  请在浏览器中登录钉钉，登录完成后按回车继续...", file=sys.stderr)
            input()

        # 搜索目标联系人的消息
        try:
            # 点击搜索框
            search_selectors = [
                '[placeholder*="搜索"]',
                '.search-input',
                '[data-testid="search"]',
                '.im-search',
            ]
            for sel in search_selectors:
                el = page.query_selector(sel)
                if el:
                    el.click()
                    time.sleep(0.5)
                    page.keyboard.type(name)
                    time.sleep(2)
                    break

            # 点击第一个结果
            result_selectors = [
                '.search-result-item',
                '.contact-item',
                '.result-item',
            ]
            for sel in result_selectors:
                result = page.query_selector(sel)
                if result:
                    result.click()
                    time.sleep(2)
                    break
        except Exception as e:
            print(f"  自动导航失败：{e}", file=sys.stderr)
            if not headless:
                print(f"  请手动打开与「{name}」的对话，然后按回车继续...", file=sys.stderr)
                input()

        # 向上滚动加载历史消息
        print("  加载历史消息 ...", file=sys.stderr)
        for _ in range(15):
            page.keyboard.press("Control+Home")
            time.sleep(1)
            page.evaluate("window.scrollTo(0, 0)")
            time.sleep(0.8)

        time.sleep(2)

        # 提取消息
        raw_messages = page.evaluate(f"""
            () => {{
                const target = "{name}";
                const results = [];
                const selectors = [
                    '.message-item-content-container',
                    '.im-message-item',
                    '[data-message-id]',
                    '.msg-wrap',
                ];

                let items = [];
                for (const sel of selectors) {{
                    items = document.querySelectorAll(sel);
                    if (items.length > 0) break;
                }}

                items.forEach(item => {{
                    const senderEl = item.querySelector('.sender-name, .nick-name, .name');
                    const contentEl = item.querySelector(
                        '.message-text, .text-content, .msg-content, .im-richtext'
                    );
                    const timeEl = item.querySelector('.message-time, .time, .msg-time');

                    const sender = senderEl ? senderEl.innerText.trim() : '';
                    const content = contentEl ? contentEl.innerText.trim() : '';
                    const time = timeEl ? timeEl.innerText.trim() : '';

                    if (!content) return;
                    if (target && !sender.includes(target)) return;
                    if (['[图片]','[文件]','[表情]','[语音]'].includes(content)) return;

                    results.push({{ sender, content, time }});
                }});

                return results.slice(-{msg_limit});
            }}
        """)

        ctx.close()
        messages = raw_messages or []

    if not messages:
        return (
            "# 消息记录\n\n"
            f"⚠️  未能自动提取 {name} 的消息。\n"
            "可能原因：钉钉网页版 DOM 结构变化，或未找到对话。\n"
            "建议手动截图聊天记录后上传。\n"
        )

    long_msgs = [m for m in messages if len(m.get("content", "")) > 50]
    short_msgs = [m for m in messages if len(m.get("content", "")) <= 50]

    lines = [
        "# 消息记录（钉钉浏览器采集）",
        f"目标：{name}",
        f"共 {len(messages)} 条",
        "注意：钉钉 API 不支持历史消息拉取，本内容通过浏览器采集",
        "",
        "---",
        "",
        "## 长消息（观点/决策/技术类）",
        "",
    ]
    for m in long_msgs:
        lines.append(f"[{m.get('time', '')}] {m.get('content', '')}")
        lines.append("")

    lines += ["---", "", "## 日常消息（风格参考）", ""]
    for m in short_msgs[:300]:
        lines.append(f"[{m.get('time', '')}] {m.get('content', '')}")

    return "\n".join(lines)


# ─── 主流程 ───────────────────────────────────────────────────────────────────

def collect_all(
    name: str,
    output_dir: Path,
    msg_limit: int,
    doc_limit: int,
    skip_messages: bool,
    chrome_profile: Optional[str],
    headless: bool,
    config: dict,
) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)
    results = {}

    print(f"\n🔍 开始采集（钉钉）：{name}\n", file=sys.stderr)

    # Step 1: 搜索用户
    user = find_user(name, config)
    if not user:
        print(f"❌ 未找到用户：{name}", file=sys.stderr)
        sys.exit(1)

    print(f"  用户 ID：{user.get('userId', '')}  部门：{user.get('deptNameList', [''])[0] if isinstance(user.get('deptNameList'), list) and user.get('deptNameList') else ''}", file=sys.stderr)

    # Step 2: 文档
    print(f"\n📄 采集文档（上限 {doc_limit} 篇）...", file=sys.stderr)
    try:
        doc_content = collect_docs(user, doc_limit, config)
        doc_path = output_dir / "docs.txt"
        doc_path.write_text(doc_content, encoding="utf-8")
        results["docs"] = str(doc_path)
        print(f"  ✅ 文档 → {doc_path}", file=sys.stderr)
    except Exception as e:
        print(f"  ⚠️  文档采集失败：{e}", file=sys.stderr)

    # Step 3: 多维表格
    print(f"\n📊 采集多维表格 ...", file=sys.stderr)
    try:
        bitable_content = collect_bitables(user, config)
        bt_path = output_dir / "bitables.txt"
        bt_path.write_text(bitable_content, encoding="utf-8")
        results["bitables"] = str(bt_path)
        print(f"  ✅ 多维表格 → {bt_path}", file=sys.stderr)
    except Exception as e:
        print(f"  ⚠️  多维表格采集失败：{e}", file=sys.stderr)

    # Step 4: 消息记录（浏览器方案）
    if not skip_messages:
        print(f"\n📨 采集消息记录（浏览器方案，上限 {msg_limit} 条）...", file=sys.stderr)
        print(f"  ℹ️  钉钉 API 不支持历史消息拉取，自动切换浏览器方案", file=sys.stderr)
        try:
            msg_content = collect_messages_browser(name, msg_limit, chrome_profile, headless)
            msg_path = output_dir / "messages.txt"
            msg_path.write_text(msg_content, encoding="utf-8")
            results["messages"] = str(msg_path)
            print(f"  ✅ 消息记录 → {msg_path}", file=sys.stderr)
        except Exception as e:
            print(f"  ⚠️  消息采集失败：{e}", file=sys.stderr)
    else:
        print(f"\n📨 跳过消息采集（--skip-messages）", file=sys.stderr)

    # 写摘要
    summary = {
        "name": name,
        "user_id": user.get("userId", ""),
        "platform": "dingtalk",
        "department": user.get("deptNameList", []),
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "files": results,
        "notes": "消息记录通过浏览器采集，钉钉 API 不支持历史消息拉取",
    }
    (output_dir / "collection_summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2)
    )

    print(f"\n✅ 采集完成 → {output_dir}", file=sys.stderr)
    print(f"   文件：{', '.join(results.keys())}", file=sys.stderr)
    return results


def main() -> None:
    parser = argparse.ArgumentParser(description="钉钉数据自动采集器")
    parser.add_argument("--setup", action="store_true", help="初始化配置")
    parser.add_argument("--name", help="同事姓名")
    parser.add_argument("--output-dir", default=None, help="输出目录")
    parser.add_argument("--msg-limit", type=int, default=500, help="最多采集消息条数（默认 500）")
    parser.add_argument("--doc-limit", type=int, default=20, help="最多采集文档篇数（默认 20）")
    parser.add_argument("--skip-messages", action="store_true", help="跳过消息记录采集")
    parser.add_argument("--chrome-profile", default=None, help="Chrome Profile 路径")
    parser.add_argument("--show-browser", action="store_true", help="显示浏览器窗口（调试/首次登录）")

    args = parser.parse_args()

    if args.setup:
        setup_config()
        return

    if not args.name:
        parser.error("请提供 --name")

    config = load_config()
    output_dir = Path(args.output_dir) if args.output_dir else Path(f"./knowledge/{args.name}")

    collect_all(
        name=args.name,
        output_dir=output_dir,
        msg_limit=args.msg_limit,
        doc_limit=args.doc_limit,
        skip_messages=args.skip_messages,
        chrome_profile=args.chrome_profile,
        headless=not args.show_browser,
        config=config,
    )


if __name__ == "__main__":
    main()
