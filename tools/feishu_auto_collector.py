#!/usr/bin/env python3
"""
飞书自动采集器

输入同事姓名，自动：
  1. 搜索飞书用户，获取 user_id
  2. 找到与他共同的群聊，拉取他的消息记录
  3. 拉取私聊消息（需要 user_access_token）
  4. 搜索他创建/编辑的文档和 Wiki
  5. 拉取文档内容
  6. 拉取多维表格（如有）
  7. 输出统一格式，直接进 create-colleague 分析流程

前置：
  python3 feishu_auto_collector.py --setup   # 配置 App ID / Secret（一次性）

私聊采集（需额外步骤）：
  1. 飞书应用开通用户权限：im:message, im:chat
  2. 获取 OAuth 授权码：
     浏览器打开: https://open.feishu.cn/open-apis/authen/v1/authorize?app_id={APP_ID}&redirect_uri=http://www.example.com&scope=im:message%20im:chat
     授权后从地址栏复制 code
  3. 换取 token：
     python3 feishu_auto_collector.py --exchange-code {CODE}
  4. 采集时指定私聊 chat_id：
     python3 feishu_auto_collector.py --name "张三" --p2p-chat-id oc_xxx

用法：
  # 群聊采集（原有方式）
  python3 feishu_auto_collector.py --name "张三" --output-dir ./knowledge/zhangsan
  python3 feishu_auto_collector.py --name "张三" --msg-limit 1000 --doc-limit 20

  # 私聊采集
  python3 feishu_auto_collector.py --name "张三" --p2p-chat-id oc_xxx

  # 直接指定 open_id + 私聊（跳过用户搜索）
  python3 feishu_auto_collector.py --open-id ou_xxx --p2p-chat-id oc_xxx --name "张三"

  # 换取 user_access_token
  python3 feishu_auto_collector.py --exchange-code {CODE}
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

try:
    import requests
except ImportError:
    print("错误：请先安装 requests：pip3 install requests", file=sys.stderr)
    sys.exit(1)


CONFIG_PATH = Path.home() / ".colleague-skill" / "feishu_config.json"
BASE_URL = "https://open.feishu.cn/open-apis"


# ─── 配置 ────────────────────────────────────────────────────────────────────

def load_config() -> dict:
    if not CONFIG_PATH.exists():
        print("未找到配置，请先运行：python3 feishu_auto_collector.py --setup", file=sys.stderr)
        sys.exit(1)
    return json.loads(CONFIG_PATH.read_text())


def save_config(config: dict) -> None:
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    os.chmod(CONFIG_PATH.parent, 0o700)
    CONFIG_PATH.write_text(json.dumps(config, indent=2, ensure_ascii=False))
    os.chmod(CONFIG_PATH, 0o600)


def setup_config() -> None:
    print("=== 飞书自动采集配置 ===\n")
    print("请前往 https://open.feishu.cn 创建企业自建应用，开通以下权限：")
    print()
    print("  消息类（应用权限，用于群聊采集）：")
    print("    im:message:readonly          读取消息")
    print("    im:chat:readonly             读取群聊信息")
    print("    im:chat.members:readonly     读取群成员")
    print()
    print("  消息类（用户权限，用于私聊采集）：")
    print("    im:message                   以用户身份读取/发送消息")
    print("    im:chat                      以用户身份读取会话列表")
    print()
    print("  用户类：")
    print("    contact:user.base:readonly       读取用户基本信息")
    print("    contact:department.base:readonly  遍历部门查找用户（按姓名搜索必需）")
    print()
    print("  文档类：")
    print("    docs:doc:readonly            读取文档")
    print("    wiki:wiki:readonly           读取知识库")
    print("    drive:drive:readonly         搜索云盘文件")
    print()
    print("  多维表格：")
    print("    bitable:app:readonly         读取多维表格")
    print()
    print("  ─── 私聊采集说明 ───")
    print("  私聊消息必须通过 user_access_token 获取（应用身份无权访问私聊）。")
    print("  获取方式：OAuth 授权，授权链接格式：")
    print("    https://open.feishu.cn/open-apis/authen/v1/authorize?app_id={APP_ID}&redirect_uri={REDIRECT}&scope=im:message%20im:chat")
    print("  授权后从回调 URL 中取 code，用 --exchange-code 换取 token。")
    print()

    app_id = input("App ID (cli_xxx): ").strip()
    app_secret = input("App Secret: ").strip()

    config = {"app_id": app_id, "app_secret": app_secret}

    print("\n是否配置 user_access_token？（用于私聊消息采集，可跳过）")
    user_token = input("user_access_token (留空跳过): ").strip()
    if user_token:
        config["user_access_token"] = user_token
    p2p_chat_id = input("私聊 chat_id (留空跳过): ").strip()
    if p2p_chat_id:
        config["p2p_chat_id"] = p2p_chat_id

    save_config(config)
    print(f"\n✅ 配置已保存到 {CONFIG_PATH}")


# ─── Token ───────────────────────────────────────────────────────────────────

_token_cache: dict = {}


def get_tenant_token(config: dict) -> str:
    """获取 tenant_access_token，带缓存（有效期约 2 小时）"""
    now = time.time()
    if _token_cache.get("token") and _token_cache.get("expire", 0) > now + 60:
        return _token_cache["token"]

    resp = requests.post(
        f"{BASE_URL}/auth/v3/tenant_access_token/internal",
        json={"app_id": config["app_id"], "app_secret": config["app_secret"]},
        timeout=10,
    )
    data = resp.json()
    if data.get("code") != 0:
        print(f"获取 token 失败：{data}", file=sys.stderr)
        sys.exit(1)

    token = data["tenant_access_token"]
    _token_cache["token"] = token
    _token_cache["expire"] = now + data.get("expire", 7200)
    return token


def api_get(path: str, params: dict, config: dict, use_user_token: bool = False) -> dict:
    if use_user_token and config.get("user_access_token"):
        token = config["user_access_token"]
    else:
        token = get_tenant_token(config)
    resp = requests.get(
        f"{BASE_URL}{path}",
        params=params,
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )
    return resp.json()


def api_post(path: str, body: dict, config: dict, use_user_token: bool = False) -> dict:
    if use_user_token and config.get("user_access_token"):
        token = config["user_access_token"]
    else:
        token = get_tenant_token(config)
    resp = requests.post(
        f"{BASE_URL}{path}",
        json=body,
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )
    return resp.json()


def exchange_code_for_token(code: str, config: dict) -> dict:
    """用 OAuth 授权码换取 user_access_token"""
    app_token = get_tenant_token(config)
    resp = requests.post(
        f"{BASE_URL}/authen/v1/oidc/access_token",
        headers={"Authorization": f"Bearer {app_token}"},
        json={"grant_type": "authorization_code", "code": code},
        timeout=10,
    )
    data = resp.json()
    if data.get("code") != 0:
        print(f"换取 token 失败：{data}", file=sys.stderr)
        return {}
    return data.get("data", {})


# ─── 用户搜索 ─────────────────────────────────────────────────────────────────

def _find_user_by_contact(name: str, config: dict) -> Optional[dict]:
    """通过邮箱或手机号查找用户（使用 tenant_access_token）"""
    # 判断输入类型
    emails, mobiles = [], []
    if "@" in name:
        emails = [name]
    elif name.replace("+", "").replace("-", "").isdigit():
        mobiles = [name]
    else:
        return None  # 不是邮箱或手机号，跳过

    body = {}
    if emails:
        body["emails"] = emails
    if mobiles:
        body["mobiles"] = mobiles

    data = api_post("/contact/v3/users/batch_get_id", body, config)
    if data.get("code") != 0:
        print(f"  邮箱/手机号查找失败（code={data.get('code')}）：{data.get('msg')}", file=sys.stderr)
        return None

    user_list = data.get("data", {}).get("user_list", [])
    for item in user_list:
        user_id = item.get("user_id")
        if user_id:
            # 获取用户详情
            detail = api_get(f"/contact/v3/users/{user_id}", {"user_id_type": "user_id"}, config)
            if detail.get("code") == 0:
                user_data = detail.get("data", {}).get("user", {})
                print(f"  找到用户：{user_data.get('name', user_id)}", file=sys.stderr)
                return user_data
            # 如果详情拉不到，返回基本信息
            return {"user_id": user_id, "open_id": item.get("open_id", ""), "name": name}

    return None


def _find_user_by_department(name: str, config: dict) -> Optional[dict]:
    """遍历部门查找用户（使用 tenant_access_token，需要 contact:department.base:readonly）"""
    print(f"  通过部门遍历查找 {name} ...", file=sys.stderr)

    # 递归获取所有部门 ID
    dept_ids = ["0"]  # 0 = 根部门
    queue = ["0"]
    while queue:
        parent_id = queue.pop(0)
        data = api_get(
            f"/contact/v3/departments/{parent_id}/children",
            {"page_size": 50, "fetch_child": False},
            config,
        )
        if data.get("code") != 0:
            if parent_id == "0":
                print(f"  部门遍历失败（code={data.get('code')}）：{data.get('msg')}", file=sys.stderr)
                print(f"  请确认已开通 contact:department.base:readonly 权限", file=sys.stderr)
                return None
            continue

        children = data.get("data", {}).get("items", [])
        for child in children:
            child_id = child.get("department_id", "")
            if child_id:
                dept_ids.append(child_id)
                queue.append(child_id)

    print(f"  共 {len(dept_ids)} 个部门，搜索用户 ...", file=sys.stderr)

    # 在每个部门中查找用户
    matches = []
    for dept_id in dept_ids:
        page_token = None
        while True:
            params = {"department_id": dept_id, "page_size": 50}
            if page_token:
                params["page_token"] = page_token

            data = api_get("/contact/v3/users/find_by_department", params, config)
            if data.get("code") != 0:
                break

            users = data.get("data", {}).get("items", [])
            for u in users:
                uname = u.get("name", "")
                en_name = u.get("en_name", "")
                if name in uname or name in en_name or uname == name or en_name == name:
                    matches.append(u)

            if not data.get("data", {}).get("has_more"):
                break
            page_token = data.get("data", {}).get("page_token")

        if len(matches) >= 10:
            break  # 够了

    return _select_user(matches, name)


def _select_user(users: list, name: str) -> Optional[dict]:
    """从候选列表中选择用户"""
    if not users:
        print(f"  未找到用户：{name}", file=sys.stderr)
        return None

    # 去重（按 user_id）
    seen = set()
    deduped = []
    for u in users:
        uid = u.get("user_id", u.get("open_id", id(u)))
        if uid not in seen:
            seen.add(uid)
            deduped.append(u)
    users = deduped

    if len(users) == 1:
        u = users[0]
        dept_ids = u.get("department_ids", [])
        print(f"  找到用户：{u.get('name')}（部门：{dept_ids[0] if dept_ids else ''}）", file=sys.stderr)
        return u

    # 多个结果，让用户选择
    print(f"\n  找到 {len(users)} 个结果，请选择：")
    for i, u in enumerate(users):
        dept_ids = u.get("department_ids", [])
        dept_str = dept_ids[0] if dept_ids else ""
        en = u.get("en_name", "")
        label = f"{u.get('name', '')} ({en})" if en else u.get("name", "")
        print(f"    [{i+1}] {label}  dept={dept_str}  uid={u.get('user_id', '')}")

    choice = input("\n  选择编号（默认 1）：").strip() or "1"
    try:
        idx = int(choice) - 1
        return users[idx]
    except (ValueError, IndexError):
        return users[0]


def find_user(name: str, config: dict) -> Optional[dict]:
    """搜索飞书用户

    策略：
      1. 如果输入是邮箱/手机号 → 直接用 batch_get_id（最快）
      2. 否则 → 遍历部门查找（需要 contact:department.base:readonly）
      3. 如果部门遍历也失败 → 提示用户改用邮箱/手机号
    """
    print(f"  搜索用户：{name} ...", file=sys.stderr)

    # 方法 1：邮箱/手机号直接查找
    user = _find_user_by_contact(name, config)
    if user:
        return user

    # 方法 2：部门遍历
    user = _find_user_by_department(name, config)
    if user:
        return user

    # 都失败
    print(f"\n  ❌ 未能找到用户 {name}", file=sys.stderr)
    print(f"  建议：", file=sys.stderr)
    print(f"    1. 确认已开通 contact:department.base:readonly 权限", file=sys.stderr)
    print(f"    2. 改用邮箱搜索：--name user@company.com", file=sys.stderr)
    print(f"    3. 改用手机号搜索：--name +8613800138000", file=sys.stderr)
    return None


# ─── 消息记录 ─────────────────────────────────────────────────────────────────

def get_chats_with_user(user_open_id: str, config: dict) -> list:
    """找到 bot 和目标用户共同在的群聊"""
    print("  获取群聊列表 ...", file=sys.stderr)

    chats = []
    page_token = None

    while True:
        params = {"page_size": 100}
        if page_token:
            params["page_token"] = page_token

        data = api_get("/im/v1/chats", params, config)
        if data.get("code") != 0:
            print(f"  获取群聊失败：{data.get('msg')}", file=sys.stderr)
            break

        items = data.get("data", {}).get("items", [])
        chats.extend(items)

        if not data.get("data", {}).get("has_more"):
            break
        page_token = data.get("data", {}).get("page_token")

    print(f"  共 {len(chats)} 个群聊，检查成员 ...", file=sys.stderr)

    # 过滤：目标用户在其中的群
    result = []
    for chat in chats:
        chat_id = chat.get("chat_id")
        if not chat_id:
            continue

        members_data = api_get(
            f"/im/v1/chats/{chat_id}/members",
            {"page_size": 100},
            config,
        )
        members = members_data.get("data", {}).get("items", [])
        for m in members:
            if m.get("member_id") == user_open_id or m.get("open_id") == user_open_id:
                result.append(chat)
                print(f"    ✓ {chat.get('name', chat_id)}", file=sys.stderr)
                break

    return result


def fetch_messages_from_chat(
    chat_id: str,
    user_open_id: str,
    limit: int,
    config: dict,
) -> list:
    """从指定群聊拉取目标用户的消息"""
    messages = []
    page_token = None

    while len(messages) < limit:
        params = {
            "container_id_type": "chat",
            "container_id": chat_id,
            "page_size": 50,
            "sort_type": "ByCreateTimeDesc",
        }
        if page_token:
            params["page_token"] = page_token

        data = api_get("/im/v1/messages", params, config)
        if data.get("code") != 0:
            break

        items = data.get("data", {}).get("items", [])
        if not items:
            break

        for item in items:
            sender = item.get("sender", {})
            sender_id = sender.get("id") or sender.get("open_id", "")
            if sender_id != user_open_id:
                continue

            # 解析消息内容
            content_raw = item.get("body", {}).get("content", "")
            try:
                content_obj = json.loads(content_raw)
                # 富文本消息
                if isinstance(content_obj, dict):
                    text_parts = []
                    for line in content_obj.get("content", []):
                        for seg in line:
                            if seg.get("tag") in ("text", "a"):
                                text_parts.append(seg.get("text", ""))
                    content = " ".join(text_parts)
                else:
                    content = str(content_obj)
            except Exception:
                content = content_raw

            content = content.strip()
            if not content or content in ("[图片]", "[文件]", "[表情]", "[语音]"):
                continue

            ts = item.get("create_time", "")
            if ts:
                try:
                    ts = datetime.fromtimestamp(int(ts) / 1000).strftime("%Y-%m-%d %H:%M")
                except Exception:
                    pass

            messages.append({"content": content, "time": ts})

        if not data.get("data", {}).get("has_more"):
            break
        page_token = data.get("data", {}).get("page_token")

    return messages[:limit]


def fetch_p2p_messages(
    chat_id: str,
    user_open_id: str,
    limit: int,
    config: dict,
) -> list:
    """使用 user_access_token 从私聊会话拉取消息（包含双方所有消息）"""
    messages = []
    page_token = None

    while len(messages) < limit:
        params = {
            "container_id_type": "chat",
            "container_id": chat_id,
            "page_size": 50,
            "sort_type": "ByCreateTimeDesc",
        }
        if page_token:
            params["page_token"] = page_token

        data = api_get("/im/v1/messages", params, config, use_user_token=True)
        if data.get("code") != 0:
            print(f"  拉取私聊消息失败（code={data.get('code')}）：{data.get('msg')}", file=sys.stderr)
            break

        items = data.get("data", {}).get("items", [])
        if not items:
            break

        for item in items:
            sender = item.get("sender", {})
            sender_id = sender.get("id") or sender.get("open_id", "")

            # 解析消息内容
            content_raw = item.get("body", {}).get("content", "")
            try:
                content_obj = json.loads(content_raw)
                if isinstance(content_obj, dict):
                    # 纯文本消息
                    if "text" in content_obj:
                        content = content_obj["text"]
                    else:
                        # 富文本消息
                        text_parts = []
                        for line in content_obj.get("content", []):
                            for seg in line:
                                if seg.get("tag") in ("text", "a"):
                                    text_parts.append(seg.get("text", ""))
                        content = " ".join(text_parts)
                else:
                    content = str(content_obj)
            except Exception:
                content = content_raw

            content = content.strip()
            if not content or content in ("[图片]", "[文件]", "[表情]", "[语音]"):
                continue

            ts = item.get("create_time", "")
            if ts:
                try:
                    ts = datetime.fromtimestamp(int(ts) / 1000).strftime("%Y-%m-%d %H:%M")
                except Exception:
                    pass

            is_target = (sender_id == user_open_id)
            messages.append({
                "content": content,
                "time": ts,
                "sender_id": sender_id,
                "is_target": is_target,
            })

        if not data.get("data", {}).get("has_more"):
            break
        page_token = data.get("data", {}).get("page_token")

    return messages[:limit]


def collect_messages(
    user: dict,
    msg_limit: int,
    config: dict,
) -> str:
    """采集目标用户的所有消息记录（群聊 + 私聊）"""
    user_open_id = user.get("open_id") or user.get("user_id", "")
    name = user.get("name", "")

    all_messages = []
    chat_sources = []

    # ── 私聊采集（需要 user_access_token + p2p_chat_id）──
    p2p_chat_id = config.get("p2p_chat_id", "")
    user_token = config.get("user_access_token", "")

    if user_token and p2p_chat_id:
        print(f"  📱 采集私聊消息（chat_id: {p2p_chat_id}）...", file=sys.stderr)
        p2p_msgs = fetch_p2p_messages(p2p_chat_id, user_open_id, msg_limit, config)
        for m in p2p_msgs:
            m["chat"] = "私聊"
        all_messages.extend(p2p_msgs)
        chat_sources.append(f"私聊（{len(p2p_msgs)} 条）")
        print(f"    获取 {len(p2p_msgs)} 条私聊消息", file=sys.stderr)
    elif user_token and not p2p_chat_id:
        print(f"  ⚠️  有 user_access_token 但未配置 p2p_chat_id，跳过私聊采集", file=sys.stderr)
        print(f"     请在配置中添加 p2p_chat_id（通过发送消息 API 返回值获取）", file=sys.stderr)

    # ── 群聊采集（使用 tenant_access_token）──
    remaining = msg_limit - len(all_messages)
    if remaining > 0:
        chats = get_chats_with_user(user_open_id, config)
        if chats:
            per_chat_limit = max(100, remaining // len(chats))
            for chat in chats:
                chat_id = chat.get("chat_id")
                chat_name = chat.get("name", chat_id)
                print(f"  拉取「{chat_name}」消息 ...", file=sys.stderr)

                msgs = fetch_messages_from_chat(chat_id, user_open_id, per_chat_limit, config)
                for m in msgs:
                    m["chat"] = chat_name
                all_messages.extend(msgs)
                chat_sources.append(f"{chat_name}（{len(msgs)} 条）")
                print(f"    获取 {len(msgs)} 条", file=sys.stderr)

    if not all_messages:
        tips = f"# 消息记录\n\n未找到 {name} 的消息记录。\n\n"
        tips += "可能原因：\n"
        tips += "  - 群聊采集：bot 未被添加到相关群聊\n"
        tips += "  - 私聊采集：未配置 user_access_token 或 p2p_chat_id\n"
        tips += "\n私聊采集配置方法：\n"
        tips += "  1. 在飞书开放平台开通 im:message 和 im:chat 用户权限\n"
        tips += "  2. 通过 OAuth 授权获取 user_access_token（--exchange-code）\n"
        tips += "  3. 配置 p2p_chat_id（私聊会话 ID）\n"
        return tips

    # 分类输出
    # 私聊消息包含双方对话，标注发言人
    target_msgs = [m for m in all_messages if m.get("is_target", True)]
    other_msgs = [m for m in all_messages if not m.get("is_target", True)]

    long_msgs = [m for m in target_msgs if len(m.get("content", "")) > 50]
    short_msgs = [m for m in target_msgs if len(m.get("content", "")) <= 50]

    lines = [
        f"# 飞书消息记录（自动采集）",
        f"目标：{name}",
        f"来源：{', '.join(chat_sources)}",
        f"共 {len(all_messages)} 条消息（目标用户 {len(target_msgs)} 条，对话方 {len(other_msgs)} 条）",
        "",
        "---",
        "",
        "## 长消息（观点/决策/技术类）",
        "",
    ]
    for m in long_msgs:
        lines.append(f"[{m.get('time', '')}][{m.get('chat', '')}] {m['content']}")
        lines.append("")

    lines += ["---", "", "## 日常消息（风格参考）", ""]
    for m in short_msgs[:300]:
        lines.append(f"[{m.get('time', '')}] {m['content']}")

    # 私聊对话上下文（保留双方对话，便于理解语境）
    p2p_msgs = [m for m in all_messages if m.get("chat") == "私聊"]
    if p2p_msgs:
        lines += ["", "---", "", "## 私聊对话上下文（含双方消息）", ""]
        # 按时间正序
        p2p_sorted = sorted(p2p_msgs, key=lambda x: x.get("time", ""))
        for m in p2p_sorted[:500]:
            who = f"[{name}]" if m.get("is_target") else "[对方]"
            lines.append(f"[{m.get('time', '')}] {who} {m['content']}")

    return "\n".join(lines)


# ─── 文档采集 ─────────────────────────────────────────────────────────────────

def search_docs_by_user(user_open_id: str, name: str, doc_limit: int, config: dict) -> list:
    """搜索目标用户创建或编辑的文档"""
    print(f"  搜索 {name} 的文档 ...", file=sys.stderr)

    data = api_post(
        "/search/v2/message",
        {
            "query": name,
            "search_type": "docs",
            "docs_options": {
                "creator_ids": [user_open_id],
            },
            "page_size": doc_limit,
        },
        config,
    )

    if data.get("code") != 0:
        # fallback：用关键词搜索
        print(f"  按创建人搜索失败，改用关键词搜索 ...", file=sys.stderr)
        data = api_post(
            "/search/v2/message",
            {
                "query": name,
                "search_type": "docs",
                "page_size": doc_limit,
            },
            config,
        )

    docs = []
    for item in data.get("data", {}).get("results", []):
        doc_info = item.get("docs_info", {})
        if doc_info:
            docs.append({
                "title": doc_info.get("title", ""),
                "url": doc_info.get("url", ""),
                "type": doc_info.get("docs_type", ""),
                "creator": doc_info.get("creator", {}).get("name", ""),
            })

    print(f"  找到 {len(docs)} 篇文档", file=sys.stderr)
    return docs


def fetch_doc_content(doc_token: str, doc_type: str, config: dict) -> str:
    """拉取单篇文档内容"""
    if doc_type in ("doc", "docx"):
        data = api_get(f"/docx/v1/documents/{doc_token}/raw_content", {}, config)
        return data.get("data", {}).get("content", "")

    elif doc_type == "wiki":
        # 先获取 wiki node 信息
        node_data = api_get(f"/wiki/v2/spaces/get_node", {"token": doc_token}, config)
        obj_token = node_data.get("data", {}).get("node", {}).get("obj_token", doc_token)
        obj_type = node_data.get("data", {}).get("node", {}).get("obj_type", "docx")
        return fetch_doc_content(obj_token, obj_type, config)

    return ""


def collect_docs(user: dict, doc_limit: int, config: dict) -> str:
    """采集目标用户的文档"""
    import re
    user_open_id = user.get("open_id") or user.get("user_id", "")
    name = user.get("name", "")

    docs = search_docs_by_user(user_open_id, name, doc_limit, config)
    if not docs:
        return f"# 文档内容\n\n未找到 {name} 相关文档\n"

    lines = [
        f"# 文档内容（自动采集）",
        f"目标：{name}",
        f"共 {len(docs)} 篇",
        "",
    ]

    for doc in docs:
        url = doc.get("url", "")
        title = doc.get("title", "无标题")
        doc_type = doc.get("type", "")

        print(f"  拉取文档：{title} ...", file=sys.stderr)

        # 从 URL 提取 token
        token_match = re.search(r"/(?:wiki|docx|docs|sheets|base)/([A-Za-z0-9]+)", url)
        if not token_match:
            continue
        doc_token = token_match.group(1)

        content = fetch_doc_content(doc_token, doc_type or "docx", config)
        if not content or len(content.strip()) < 20:
            print(f"    内容为空，跳过", file=sys.stderr)
            continue

        lines += [
            f"---",
            f"## 《{title}》",
            f"链接：{url}",
            f"创建人：{doc.get('creator', '')}",
            "",
            content.strip(),
            "",
        ]

    return "\n".join(lines)


# ─── 多维表格 ─────────────────────────────────────────────────────────────────

def collect_bitable(app_token: str, config: dict) -> str:
    """拉取多维表格内容"""
    # 获取所有 table
    data = api_get(f"/bitable/v1/apps/{app_token}/tables", {"page_size": 100}, config)
    tables = data.get("data", {}).get("items", [])

    if not tables:
        return "（多维表格为空）\n"

    lines = []
    for table in tables:
        table_id = table.get("table_id")
        table_name = table.get("name", table_id)

        # 获取字段
        fields_data = api_get(
            f"/bitable/v1/apps/{app_token}/tables/{table_id}/fields",
            {"page_size": 100},
            config,
        )
        fields = [f.get("field_name", "") for f in fields_data.get("data", {}).get("items", [])]

        # 获取记录
        records_data = api_get(
            f"/bitable/v1/apps/{app_token}/tables/{table_id}/records",
            {"page_size": 100},
            config,
        )
        records = records_data.get("data", {}).get("items", [])

        lines.append(f"### 表：{table_name}")
        lines.append("")
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


# ─── 主流程 ───────────────────────────────────────────────────────────────────

def collect_all(
    name: str,
    output_dir: Path,
    msg_limit: int,
    doc_limit: int,
    config: dict,
) -> dict:
    """采集某同事的所有可用数据，输出到 output_dir"""
    output_dir.mkdir(parents=True, exist_ok=True)
    results = {}

    print(f"\n🔍 开始采集：{name}\n", file=sys.stderr)

    # Step 1: 搜索用户
    user = find_user(name, config)
    if not user:
        print(f"❌ 未找到用户 {name}，请检查姓名是否正确", file=sys.stderr)
        sys.exit(1)

    # Step 2: 采集消息记录
    print(f"\n📨 采集消息记录（上限 {msg_limit} 条）...", file=sys.stderr)
    try:
        msg_content = collect_messages(user, msg_limit, config)
        msg_path = output_dir / "messages.txt"
        msg_path.write_text(msg_content, encoding="utf-8")
        results["messages"] = str(msg_path)
        print(f"  ✅ 消息记录 → {msg_path}", file=sys.stderr)
    except Exception as e:
        print(f"  ⚠️  消息采集失败：{e}", file=sys.stderr)

    # Step 3: 采集文档
    print(f"\n📄 采集文档（上限 {doc_limit} 篇）...", file=sys.stderr)
    try:
        doc_content = collect_docs(user, doc_limit, config)
        doc_path = output_dir / "docs.txt"
        doc_path.write_text(doc_content, encoding="utf-8")
        results["docs"] = str(doc_path)
        print(f"  ✅ 文档内容 → {doc_path}", file=sys.stderr)
    except Exception as e:
        print(f"  ⚠️  文档采集失败：{e}", file=sys.stderr)

    # 写摘要
    summary = {
        "name": name,
        "user_id": user.get("user_id", ""),
        "open_id": user.get("open_id", ""),
        "department": user.get("department_path", []),
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "files": results,
    }
    (output_dir / "collection_summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2)
    )

    print(f"\n✅ 采集完成，输出目录：{output_dir}", file=sys.stderr)
    return results


def main() -> None:
    parser = argparse.ArgumentParser(description="飞书数据自动采集器")
    parser.add_argument("--setup", action="store_true", help="初始化配置")
    parser.add_argument("--name", help="同事姓名")
    parser.add_argument("--output-dir", default=None, help="输出目录（默认 ./knowledge/{name}）")
    parser.add_argument("--msg-limit", type=int, default=1000, help="最多采集消息条数（默认 1000）")
    parser.add_argument("--doc-limit", type=int, default=20, help="最多采集文档篇数（默认 20）")
    parser.add_argument("--exchange-code", metavar="CODE", help="用 OAuth 授权码换取 user_access_token 并保存到配置")
    parser.add_argument("--user-token", metavar="TOKEN", help="直接指定 user_access_token（覆盖配置文件）")
    parser.add_argument("--p2p-chat-id", metavar="CHAT_ID", help="私聊会话 ID（覆盖配置文件）")
    parser.add_argument("--open-id", metavar="OPEN_ID", help="直接指定目标用户的 open_id（跳过用户搜索）")

    args = parser.parse_args()

    if args.setup:
        setup_config()
        return

    config = load_config()

    # 换取 user_access_token
    if args.exchange_code:
        token_data = exchange_code_for_token(args.exchange_code, config)
        if token_data:
            config["user_access_token"] = token_data["access_token"]
            config["refresh_token"] = token_data.get("refresh_token", "")
            save_config(config)
            print(f"✅ user_access_token 已保存（scope: {token_data.get('scope', '')}）")
            print(f"   token: {token_data['access_token'][:20]}...")
        else:
            print("❌ 换取失败，请检查 code 是否有效")
        return

    if not args.name and not args.open_id:
        parser.error("请提供 --name 或 --open-id")

    # 命令行参数覆盖配置
    if args.user_token:
        config["user_access_token"] = args.user_token
    if args.p2p_chat_id:
        config["p2p_chat_id"] = args.p2p_chat_id

    output_dir = Path(args.output_dir) if args.output_dir else Path(f"./knowledge/{args.name or 'target'}")

    # 如果提供了 open_id，跳过用户搜索
    if args.open_id:
        user = {"open_id": args.open_id, "name": args.name or "target"}
        output_dir.mkdir(parents=True, exist_ok=True)
        print(f"\n🔍 使用指定 open_id: {args.open_id}\n", file=sys.stderr)

        # 只采集消息
        print(f"📨 采集消息记录（上限 {args.msg_limit} 条）...", file=sys.stderr)
        msg_content = collect_messages(user, args.msg_limit, config)
        msg_path = output_dir / "messages.txt"
        msg_path.write_text(msg_content, encoding="utf-8")
        print(f"  ✅ 消息记录 → {msg_path}", file=sys.stderr)
        return

    collect_all(
        name=args.name,
        output_dir=output_dir,
        msg_limit=args.msg_limit,
        doc_limit=args.doc_limit,
        config=config,
    )


if __name__ == "__main__":
    main()
