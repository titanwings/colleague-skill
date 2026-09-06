"""Behavior of the canonical plugin release assembler."""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.assemble_plugins import (
    CANONICAL_SKILL_ROOT,
    MCP_PACKAGE_MANIFEST,
    RELEASE_MANIFEST,
    SENTINEL,
    PluginAssemblyError,
    assemble,
    verify,
)


REPOSITORY = Path(__file__).resolve().parents[1]
ASSEMBLER = REPOSITORY / "scripts" / "assemble_plugins.py"


def sha256(data: bytes) -> str:
    return "sha256_" + hashlib.sha256(data).hexdigest()


class AssemblePluginsTests(unittest.TestCase):
    def fixture(self) -> Path:
        root = Path(tempfile.mkdtemp(prefix="distilly-plugin-assembler-test-"))
        self.addCleanup(shutil.rmtree, root, True)
        shutil.copytree(REPOSITORY / "plugins", root / "plugins", symlinks=True)
        (root / "packages/mcp").mkdir(parents=True)
        shutil.copy2(
            REPOSITORY / MCP_PACKAGE_MANIFEST,
            root / MCP_PACKAGE_MANIFEST,
        )
        return root

    def release(self, root: Path) -> dict[str, object]:
        return json.loads((root / RELEASE_MANIFEST).read_bytes())

    def snapshot(self, root: Path) -> dict[str, bytes]:
        return {
            path.relative_to(root).as_posix(): path.read_bytes()
            for path in sorted(root.rglob("*"))
            if path.is_file() and not path.is_symlink()
        }

    def test_assembles_exact_mirrors_and_canonical_release_manifest(self) -> None:
        root = self.fixture()

        assemble(root)

        self.assertEqual(verify(root), [])
        canonical = root / CANONICAL_SKILL_ROOT
        for host_root in (
            root / "plugins/codex/skills/distilly",
            root / "plugins/claude-code/skills/distilly",
        ):
            self.assertEqual(
                {
                    path.relative_to(host_root).as_posix(): path.read_bytes()
                    for path in host_root.rglob("*")
                    if path.is_file()
                },
                {
                    path.relative_to(canonical).as_posix(): path.read_bytes()
                    for path in canonical.rglob("*")
                    if path.is_file()
                },
            )

        raw = (root / RELEASE_MANIFEST).read_bytes()
        self.assertTrue(raw.endswith(b"\n"))
        self.assertFalse(raw.endswith(b"\n\n"))
        self.assertNotIn(b" ", raw)
        release = json.loads(raw)
        self.assertEqual(list(release), [
            "canonicalSkill",
            "releaseVersion",
            "schemaVersion",
            "targets",
            "wire",
        ])
        self.assertEqual(release["schemaVersion"], 1)
        self.assertEqual(release["releaseVersion"], "0.1.0-preview.1")
        self.assertEqual(release["wire"], {"maximumMajor": 3, "minimumMajor": 3})
        self.assertEqual(
            [target["host"] for target in release["targets"]],
            ["claude-code", "codex"],
        )
        self.assertEqual(
            release["canonicalSkill"]["root"],
            "plugins/shared/skills/distilly",
        )
        self.assertEqual(
            [
                (
                    target["host"],
                    target["pluginRoot"],
                    target["pluginManifestPath"],
                    target["skillRoot"],
                )
                for target in release["targets"]
            ],
            [
                (
                    "claude-code",
                    "plugins/claude-code",
                    "plugins/claude-code/.claude-plugin/plugin.json",
                    "plugins/claude-code/skills/distilly",
                ),
                (
                    "codex",
                    "plugins/codex",
                    "plugins/codex/.codex-plugin/plugin.json",
                    "plugins/codex/skills/distilly",
                ),
            ],
        )
        self.assertEqual(
            [item["path"] for item in release["canonicalSkill"]["files"]],
            ["SKILL.md", "references/source-materials.md"],
        )
        self.assertEqual(
            release["canonicalSkill"]["digest"],
            "sha256_83b9b45faf76c184a5605b1ec6e2f7007d440813d3314f58a4250246c5de44a9",
        )
        for target in release["targets"]:
            self.assertEqual(target["skillDigest"], release["canonicalSkill"]["digest"])
            self.assertEqual(
                target["pluginManifestDigest"],
                sha256((root / target["pluginManifestPath"]).read_bytes()),
            )
        self.assertNotIn(SENTINEL, raw.decode("utf-8"))
        self.assertNotIn(".mcp.json.template", raw.decode("utf-8"))

    def test_assembly_owned_files_use_lf_line_endings(self) -> None:
        paths = (
            "plugins/shared/skills/distilly/SKILL.md",
            "plugins/shared/skills/distilly/references/source-materials.md",
            "plugins/codex/skills/distilly/SKILL.md",
            "plugins/codex/skills/distilly/references/source-materials.md",
            "plugins/claude-code/skills/distilly/SKILL.md",
            "plugins/claude-code/skills/distilly/references/source-materials.md",
            "plugins/codex/.codex-plugin/plugin.json",
            "plugins/claude-code/.claude-plugin/plugin.json",
            "plugins/release-manifest.json",
        )
        for relative in paths:
            with self.subTest(path=relative):
                self.assertNotIn(b"\r\n", (REPOSITORY / relative).read_bytes())

    def test_rejects_every_changed_release_target_path(self) -> None:
        for target_index, field in (
            (0, "pluginRoot"),
            (0, "pluginManifestPath"),
            (0, "skillRoot"),
            (1, "pluginRoot"),
            (1, "pluginManifestPath"),
            (1, "skillRoot"),
        ):
            with self.subTest(target_index=target_index, field=field):
                root = self.fixture()
                assemble(root)
                release = self.release(root)
                release["targets"][target_index][field] += "-changed"
                (root / RELEASE_MANIFEST).write_text(
                    json.dumps(release, separators=(",", ":"), sort_keys=True) + "\n",
                    encoding="utf-8",
                )

                self.assertNotEqual(verify(root), [])

    def test_is_idempotent_and_check_cli_does_not_mutate(self) -> None:
        root = self.fixture()
        assemble(root)
        before = self.snapshot(root)

        assemble(root)
        result = subprocess.run(
            [sys.executable, str(ASSEMBLER), "--check", "--root", str(root)],
            cwd=REPOSITORY,
            check=False,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "plugin assembly: ok\n")
        self.assertEqual(result.stderr, "")
        self.assertEqual(self.snapshot(root), before)

    def test_detects_nested_drift_even_when_both_copies_and_digest_are_forged(self) -> None:
        root = self.fixture()
        assemble(root)
        for relative in (
            "plugins/codex/skills/distilly/references/source-materials.md",
            "plugins/claude-code/skills/distilly/references/source-materials.md",
        ):
            (root / relative).write_text("same stale copy\n", encoding="utf-8")
        release = self.release(root)
        forged = sha256(b"same stale copy\n")
        for target in release["targets"]:
            target["skillDigest"] = forged
        (root / RELEASE_MANIFEST).write_text(
            json.dumps(release, separators=(",", ":"), sort_keys=True) + "\n",
            encoding="utf-8",
        )

        errors = verify(root)

        self.assertTrue(any("does not exactly mirror" in error for error in errors), errors)

    def test_prunes_deleted_source_files_and_target_only_stale_files(self) -> None:
        root = self.fixture()
        assemble(root)
        (root / CANONICAL_SKILL_ROOT / "references/source-materials.md").unlink()
        for target in ("codex", "claude-code"):
            stale = root / f"plugins/{target}/skills/distilly/stale/extra.md"
            stale.parent.mkdir(parents=True)
            stale.write_text("stale\n", encoding="utf-8")

        self.assertNotEqual(verify(root), [])
        assemble(root)

        self.assertEqual(verify(root), [])
        for target in ("codex", "claude-code"):
            self.assertFalse(
                (root / f"plugins/{target}/skills/distilly/references/source-materials.md").exists()
            )
            self.assertFalse((root / f"plugins/{target}/skills/distilly/stale").exists())

    def test_uses_utf8_path_order_in_the_tree_digest(self) -> None:
        root = self.fixture()
        first = root / CANONICAL_SKILL_ROOT / "\ue000.md"
        second = root / CANONICAL_SKILL_ROOT / "\U00010000.md"
        first.write_bytes(b"bmp")
        second.write_bytes(b"astral")

        assemble(root)

        paths = [item["path"] for item in self.release(root)["canonicalSkill"]["files"]]
        self.assertLess(paths.index("\ue000.md"), paths.index("\U00010000.md"))

    def test_rejects_symlink_and_special_files_in_source_or_target(self) -> None:
        for relative in (
            f"{CANONICAL_SKILL_ROOT}/linked.md",
            "plugins/codex/skills/distilly/linked.md",
        ):
            with self.subTest(relative=relative):
                root = self.fixture()
                target = root / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                target.symlink_to(root / CANONICAL_SKILL_ROOT / "SKILL.md")
                with self.assertRaisesRegex(PluginAssemblyError, "symlink is forbidden"):
                    assemble(root)

        root = self.fixture()
        skills = root / "plugins/codex/skills"
        escaped = root / "escaped-skills"
        skills.rename(escaped)
        skills.symlink_to(escaped, target_is_directory=True)
        with self.assertRaisesRegex(PluginAssemblyError, "symlink is forbidden"):
            assemble(root)

        if hasattr(os, "mkfifo"):
            root = self.fixture()
            fifo = root / CANONICAL_SKILL_ROOT / "capture.pipe"
            os.mkfifo(fifo)
            with self.assertRaisesRegex(PluginAssemblyError, "only regular files"):
                assemble(root)

    def test_rejects_non_posix_skill_paths(self) -> None:
        root = self.fixture()
        (root / CANONICAL_SKILL_ROOT / "bad\\name.md").write_text(
            "bad\n", encoding="utf-8"
        )

        with self.assertRaisesRegex(PluginAssemblyError, "unsafe POSIX relative path"):
            assemble(root)

    def test_requires_the_canonical_skill_frontmatter_and_runtime_gate(self) -> None:
        root = self.fixture()
        skill = root / CANONICAL_SKILL_ROOT / "SKILL.md"
        text = skill.read_text(encoding="utf-8")
        self.assertLess(text.index("## Gate the runtime"), text.index("## Establish the task"))
        self.assertIn("stop immediately", text[text.index("## Gate the runtime") :])
        skill.write_text(text.replace("name: distilly", "name: other", 1), encoding="utf-8")

        with self.assertRaisesRegex(PluginAssemblyError, "name=distilly"):
            assemble(root)

    def test_rejects_manifest_escape_and_source_template_drift(self) -> None:
        root = self.fixture()
        manifest_path = root / "plugins/codex/.codex-plugin/plugin.json"
        manifest = json.loads(manifest_path.read_bytes())
        manifest["skills"] = "../skills/"
        manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

        with self.assertRaisesRegex(PluginAssemblyError, "skills must be './skills/'"):
            assemble(root)

        root = self.fixture()
        template = root / "plugins/claude-code/.mcp.json.template"
        value = json.loads(template.read_bytes())
        value["mcpServers"]["distilly"]["args"] = ["serve"]
        template.write_text(json.dumps(value), encoding="utf-8")
        with self.assertRaisesRegex(PluginAssemblyError, "template shape is not canonical"):
            assemble(root)

        root = self.fixture()
        manifest_path = root / "plugins/claude-code/.claude-plugin/plugin.json"
        manifest = json.loads(manifest_path.read_bytes())
        manifest["mcpServers"] = {"distilly": {"command": SENTINEL}}
        manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
        with self.assertRaisesRegex(PluginAssemblyError, "keys must be"):
            assemble(root)

    def test_release_version_updates_both_manifests_and_every_digest(self) -> None:
        root = self.fixture()
        assemble(root)
        package = json.loads((root / MCP_PACKAGE_MANIFEST).read_bytes())
        package["version"] = "1.2.3-beta.1"
        (root / MCP_PACKAGE_MANIFEST).write_text(json.dumps(package), encoding="utf-8")

        self.assertNotEqual(verify(root), [])
        assemble(root)

        release = self.release(root)
        self.assertEqual(release["releaseVersion"], "1.2.3-beta.1")
        for target in release["targets"]:
            manifest_bytes = (root / target["pluginManifestPath"]).read_bytes()
            self.assertEqual(json.loads(manifest_bytes)["version"], "1.2.3-beta.1")
            self.assertEqual(target["pluginManifestDigest"], sha256(manifest_bytes))

    def test_rejects_invalid_or_prefixed_release_versions(self) -> None:
        for version in (
            "v1.2.3",
            "1.2",
            "01.2.3",
            "1.0.0-01",
            "1.0.0-alpha.01",
            "latest",
        ):
            with self.subTest(version=version):
                root = self.fixture()
                package = json.loads((root / MCP_PACKAGE_MANIFEST).read_bytes())
                package["version"] = version
                (root / MCP_PACKAGE_MANIFEST).write_text(
                    json.dumps(package), encoding="utf-8"
                )
                with self.assertRaisesRegex(PluginAssemblyError, "exact SemVer"):
                    assemble(root)


if __name__ == "__main__":
    unittest.main()
