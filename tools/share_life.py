"""
share_life.py — /share-life orchestrator

Reads the current colleague's persona.md + meta.json, deeply parses
the persona layers to extract visual cues, hobbies, and environment hints,
then builds a rich NanoBanana image prompt.

Usage:
    python tools/share_life.py \
        --slug "example_tianyi" \
        --chat-id "123456789" \
        [--scene "傍晚下班路上"]   # optional override
"""

import argparse
import json
import random
import re
import sys
from pathlib import Path

COLLEAGUES_DIR = Path(__file__).parent.parent / "colleagues"


# ─── Persona Parser ───────────────────────────────────────────────────────────

class PersonaParser:
    """
    Parses colleague persona.md into structured visual signals for image generation.

    Extracts from:
      Layer 0 — core personality traits → character adjectives
      Layer 1 — identity paragraph → role description, MBTI energy
      Layer 2 — expression style, emoji usage → visual mood/energy
      Layer 3 — priorities → what they look like when focused
      Layer 4 — interpersonal behavior → typical social scenes
      Layer 5 — excited topics + dislikes → hobbies, environments, activities
    """

    def __init__(self, persona_text: str, meta: dict):
        self.text = persona_text
        self.meta = meta
        self._layers = self._split_layers()

    def _split_layers(self) -> dict:
        """Split persona.md into layer blocks by heading."""
        layers = {}
        current = "intro"
        buffer = []
        for line in self.text.split("\n"):
            m = re.match(r"##\s+Layer\s+(\d+)", line)
            if m:
                layers[current] = "\n".join(buffer)
                current = f"layer{m.group(1)}"
                buffer = []
            else:
                buffer.append(line)
        layers[current] = "\n".join(buffer)
        return layers

    def _bullets(self, layer_key: str) -> list[str]:
        """Extract bullet point items from a layer."""
        text = self._layers.get(layer_key, "")
        return [
            re.sub(r"^[-•]\s*", "", line).strip()
            for line in text.split("\n")
            if re.match(r"^\s*[-•]", line) and len(line.strip()) > 3
        ]

    def _find_section(self, layer_key: str, section_name: str) -> str:
        """Extract content under a ### subsection within a layer."""
        text = self._layers.get(layer_key, "")
        pattern = rf"###\s+{re.escape(section_name)}.*?\n(.*?)(?=###|\Z)"
        m = re.search(pattern, text, re.DOTALL)
        return m.group(1).strip() if m else ""

    # ── Public accessors ──────────────────────────────────────────────────────

    @property
    def name(self) -> str:
        return self.meta.get("name", "同事").split("（")[0].strip()

    @property
    def role(self) -> str:
        return self.meta.get("profile", {}).get("role", "")

    @property
    def mbti(self) -> str:
        # colleague-skill: profile.mbti (string)
        # ex-skill: mbti.type (nested object)
        v = self.meta.get("profile", {}).get("mbti") or self.meta.get("mbti")
        if isinstance(v, dict):
            return v.get("type", "")
        return v or ""

    @property
    def mbti_dominant(self) -> str:
        """Ex-skill stores dominant function explicitly."""
        v = self.meta.get("mbti")
        if isinstance(v, dict):
            return v.get("dominant", "")
        return ""

    @property
    def impression(self) -> str:
        return self.meta.get("impression", "")

    @property
    def personality_tags(self) -> list[str]:
        tags = self.meta.get("tags", {})
        # colleague-skill: tags.personality
        if "personality" in tags:
            return tags["personality"]
        # ex-skill: tags.rel_traits + tags.attachment
        return tags.get("rel_traits", []) + tags.get("attachment", [])

    @property
    def core_traits(self) -> list[str]:
        """From Layer 0: short adjectives describing how they act."""
        bullets = self._bullets("layer0")
        # Shorten to key phrases
        traits = []
        for b in bullets[:5]:
            # Extract the core part before the em-dash or comma
            short = re.split(r"[——,，。]", b)[0].strip()
            if 3 < len(short) < 20:
                traits.append(short)
        return traits

    @property
    def hobbies(self) -> list[str]:
        """
        From Layer 5: topics they get excited about → activities for image scenes.
        colleague-skill: explicit "你会兴奋的话题" section.
        ex-skill: inferred from MBTI Se/Ne, emoji clues in Layer 2, and Layer 1 keywords.
        """
        layer5 = self._layers.get("layer5", "")

        # colleague-skill format
        m = re.search(r"你会兴奋的话题[：:]\s*\n(.*?)(?=\n你会|$)", layer5, re.DOTALL)
        if m:
            hobbies = []
            for line in m.group(1).split("\n"):
                line = re.sub(r"^[-•]\s*", "", line).strip()
                if line and len(line) > 2:
                    hobbies.append(line)
            return hobbies

        # ex-skill: infer from MBTI + emoji + Layer 1 keywords
        return self._infer_hobbies_from_context()

    def _infer_hobbies_from_context(self) -> list[str]:
        """Infer likely activities from MBTI dominant function and emoji usage."""
        hints = []

        # MBTI Se (ISFP, ISTP, ESFP, ESTP) → sensory, aesthetic, present-moment
        if "Se" in self.mbti_dominant or self.mbti in ("ISFP", "ISTP", "ESFP", "ESTP"):
            hints += ["walks in the city", "photography or visual arts", "listening to music"]

        # MBTI Ne (ENFP, ENTP, INFP, INTP) → ideas, reading, exploring
        if "Ne" in self.mbti_dominant or self.mbti in ("ENFP", "ENTP", "INFP", "INTP"):
            hints += ["reading a book", "sketching or journaling", "browsing ideas"]

        # Emoji clues from Layer 2
        layer2_text = self._layers.get("layer2", "")
        if "🐱" in layer2_text or "猫" in layer2_text:
            hints.insert(0, "spending time with a cat")
        if "📷" in layer2_text or "摄影" in layer2_text:
            hints.insert(0, "taking photos on a quiet street")
        if "🎵" in layer2_text or "音乐" in layer2_text:
            hints.insert(0, "listening to music with headphones")
        if "☕" in layer2_text or "咖啡" in layer2_text:
            hints.insert(0, "at a café with a book or phone")

        # Enneagram 3 → achievement, polished image
        mbti_meta = self.meta.get("mbti", {})
        if isinstance(mbti_meta, dict) and "3" in mbti_meta.get("enneagram", ""):
            hints += ["working on a personal project, focused and driven"]

        return hints[:4]

    @property
    def typical_scenes(self) -> list[str]:
        """From Layer 4 + Layer 3: what do they typically do?"""
        scenes = []
        # Extract "典型场景" blocks from Layer 4
        layer4 = self._layers.get("layer4", "")
        for chunk in re.findall(r"典型场景：\n(.*?)(?=###|\Z)", layer4, re.DOTALL):
            for line in chunk.split("\n"):
                m = re.match(r"\s*[-•]\s*(.*)", line)
                if m:
                    scenes.append(m.group(1).strip())
        return scenes[:4]

    @property
    def emoji_vibe(self) -> str:
        """From Layer 2: emoji usage hints at energy level."""
        style_text = self._find_section("layer2", "说话方式")
        if "不多" in style_text or "偶尔" in style_text:
            return "minimal emoji energy, calm and focused"
        elif "活跃" in style_text or "兴奋" in style_text:
            return "expressive, warm, animated"
        return "balanced, approachable"

    @property
    def visual_keywords(self) -> list[str]:
        """Synthesize visual adjectives from all layers for image prompt."""
        words = []

        # From personality tags
        tag_map = {
            # colleague-skill tags
            "靠谱": "reliable, steady gaze",
            "代码规范": "detail-oriented, neat workspace",
            "热心": "warm expression, open posture",
            "健谈": "conversational, mid-gesture",
            "游戏爱好者": "gaming setup, controller nearby",
            "严谨": "focused, methodical",
            "直接": "confident, direct eye contact",
            "温柔": "gentle, soft expression",
            "细腻": "thoughtful, quiet energy",
            "务实": "pragmatic, grounded",
            # ex-skill rel_traits
            "话少但在乎": "quiet presence, observant eyes",
            "高冷装": "composed exterior, soft interior hinted",
            "行动派": "in motion, purposeful stance",
            "需要空间": "solitary moment, breathing room",
            "道歉困难户": "proud posture, slightly averted gaze",
            # ex-skill attachment
            "回避型": "comfortable alone, self-contained energy",
        }
        for tag in self.personality_tags:
            if tag in tag_map:
                words.append(tag_map[tag])

        # MBTI energy
        if self.mbti:
            if self.mbti.startswith("E"):
                words.append("outward energy, sociable")
            elif self.mbti.startswith("I"):
                words.append("inward focus, contemplative")
            if "N" in self.mbti:
                words.append("imaginative, thoughtful")
            if "F" in self.mbti:
                words.append("emotionally present")
            if "T" in self.mbti:
                words.append("analytical, precise")

        return words


# ─── Scene Generator ──────────────────────────────────────────────────────────

def _hobby_to_scene(hobby: str) -> str | None:
    """Map a hobby/interest string to an image scene description."""
    hobby_lower = hobby.lower()
    scene_map = [
        (["cat", "猫", "小猫"],
         "at home on a quiet afternoon, a cat curled up nearby, soft warm light"),
        (["杀戮尖塔", "slay the spire", "roguelike", "roguelite", "游戏"],
         "playing a roguelike game late at night, monitor glow, snacks on desk, fully absorbed"),
        (["模型安全", "对齐", "alignment", "安全", "红队"],
         "deep in research at a desk, papers and diagrams, focused expression"),
        (["音乐", "吉他", "钢琴", "耳机"],
         "listening to music with headphones, eyes closed, soft evening light"),
        (["摄影", "相机"],
         "out with a camera, capturing a quiet street scene"),
        (["跑步", "健身", "运动"],
         "early morning run, city streets, dawn light"),
        (["读书", "看书"],
         "reading a book in a cozy corner, warm lamp light"),
        (["咖啡"],
         "at a café, notebook open, afternoon light through window"),
        (["动漫", "二次元", "漫画"],
         "reading manga or watching anime, cozy bedroom setting"),
        (["烹饪", "做饭"],
         "cooking at home, kitchen warm light, relaxed and focused"),
    ]
    for keywords, scene in scene_map:
        if any(k in hobby_lower for k in keywords):
            return scene
    return None


def pick_scene(parser: PersonaParser, scene_override: str | None = None) -> str:
    """Pick the best scene for this persona."""
    if scene_override:
        return scene_override

    # Try hobby-based scenes first (most specific)
    hobby_scenes = []
    for hobby in parser.hobbies:
        s = _hobby_to_scene(hobby)
        if s:
            hobby_scenes.append(s)

    # Fallback: generic scenes based on role/energy
    role_scenes = [
        f"working at a modern office, {parser.role or 'professional'}, soft focus, golden hour light",
        "commute home on a subway, earphones in, watching the city scroll by",
        "lunch break at a quiet corner, lost in thought over a bowl of noodles",
        "evening walk in a neighborhood, streetlights just turning on, hands in pockets",
    ]

    candidates = hobby_scenes + role_scenes
    return random.choice(candidates) if candidates else role_scenes[0]


# ─── Prompt Builder ───────────────────────────────────────────────────────────

def build_image_prompt(parser: PersonaParser, scene: str) -> str:
    """
    Build a rich image prompt focused on the person as a character —
    not their work role, just who they are as a human being.
    """
    # Lead with name + impression (personality anchor), skip job title
    character_desc = parser.name
    if parser.impression:
        character_desc += f". The kind of person you would describe as: \"{parser.impression}\""

    visual_kw = ", ".join(parser.visual_keywords[:4]) if parser.visual_keywords else ""
    vibe = parser.emoji_vibe

    prompt_parts = [
        f"A slice-of-life illustration of {character_desc}.",
        f"Scene: {scene}.",
        f"Energy: {vibe}.",
    ]
    if visual_kw:
        prompt_parts.append(f"Visual character cues: {visual_kw}.")
    prompt_parts.append(
        "Style: photorealistic, warm cinematic photography, soft natural lighting, "
        "shot on film, detailed lived-in environment, character in a natural relaxed pose, "
        "feels like a candid real moment, no text overlays, no watermarks, high quality."
    )

    return " ".join(prompt_parts)


# ─── Loader ───────────────────────────────────────────────────────────────────

def load_colleague(slug: str) -> tuple[PersonaParser, dict]:
    base = COLLEAGUES_DIR / slug
    if not base.exists():
        raise FileNotFoundError(f"Colleague '{slug}' not found in {COLLEAGUES_DIR}")

    meta = json.loads((base / "meta.json").read_text())
    persona_text = (base / "persona.md").read_text()
    parser = PersonaParser(persona_text, meta)
    return parser, meta


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--slug", required=True)
    parser.add_argument("--chat-id", required=True)
    parser.add_argument("--scene", default=None)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    try:
        persona, meta = load_colleague(args.slug)
    except FileNotFoundError as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

    scene = pick_scene(persona, scene_override=args.scene)
    prompt = build_image_prompt(persona, scene)

    if args.dry_run:
        print(json.dumps({
            "name": persona.name,
            "hobbies": persona.hobbies,
            "core_traits": persona.core_traits,
            "visual_keywords": persona.visual_keywords,
            "scene": scene,
            "prompt": prompt,
        }, ensure_ascii=False, indent=2))
        return

    sys.path.insert(0, str(Path(__file__).parent))
    from image_generator import cmd_generate

    result = cmd_generate(prompt=prompt, slug=args.slug, chat_id=args.chat_id)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
