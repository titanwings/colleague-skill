"""Canonical current-design chapter generation behavior."""

from __future__ import annotations

import tempfile
import unittest
from dataclasses import replace
from pathlib import Path

from scripts.sync_design_chapters import (
    CORPORA,
    V3,
    Corpus,
    DesignSyncError,
    expected_chapters,
    verify,
    write,
)


class SyncDesignChaptersTests(unittest.TestCase):
    def _write_parent(self, root: Path, corpus: Corpus, *, links: bool = False) -> None:
        parent = root / corpus.parent
        parent.parent.mkdir(parents=True, exist_ok=True)
        sections = []
        for number in range(len(corpus.names)):
            body = f"## {number}. Section {number}\n\nBody {number}."
            if links and number == 0:
                body += (
                    "\n\n[process](../process/review.md)"
                    "\n\n[asset](../asset(a).png)"
                    "\n\n``[literal](../process/review.md)``"
                    "\n\n<img src=\"../asset.png\">"
                    "\n\n<a href=../process/review.md>review</a>"
                    "\n\n\\[escaped](../process/review.md)"
                    "\n\n<!-- [commented](../process/review.md) -->"
                    "\n\n[review]: ../process/review.md"
                )
            sections.append(body)
        parent.write_text(
            "# Design\n\n" + "\n\n---\n\n".join(sections) + "\n",
            encoding="utf-8",
        )

    def _root(self, corpus: Corpus = V3, *, links: bool = False) -> Path:
        root = Path(tempfile.mkdtemp())
        self._write_parent(root, corpus, links=links)
        process = root / "docs/process/review.md"
        process.parent.mkdir(parents=True, exist_ok=True)
        process.write_text("# Review\n", encoding="utf-8")
        (root / "docs/asset.png").write_bytes(b"png")
        (root / "docs/asset(a).png").write_bytes(b"png")
        return root

    def test_expected_chapters_rewrite_relative_links(self) -> None:
        corpus = replace(V3, names=("00-links.md",))
        root = self._root(corpus, links=True)
        chapter = expected_chapters(root, (corpus,))[root / corpus.chapter_dir / corpus.names[0]]
        self.assertIn("[process](../../process/review.md)", chapter)
        self.assertIn("[asset](../../asset(a).png)", chapter)
        self.assertIn("``[literal](../process/review.md)``", chapter)
        self.assertIn('src="../../asset.png"', chapter)
        self.assertIn("href=../../process/review.md", chapter)
        self.assertIn("\\[escaped](../process/review.md)", chapter)
        self.assertIn("<!-- [commented](../process/review.md) -->", chapter)
        self.assertIn("[review]: ../../process/review.md", chapter)

    def test_verify_accepts_the_current_generated_corpus(self) -> None:
        root = self._root()
        for path, content in expected_chapters(root, CORPORA).items():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8")
        self.assertEqual(verify(root, CORPORA), [])

    def test_verify_reports_missing_v3_parent(self) -> None:
        root = Path(tempfile.mkdtemp())
        self.assertEqual(verify(root, CORPORA), ["docs/design/system-v3.md is missing"])

    def test_verify_rejects_drift_missing_and_extra_chapters(self) -> None:
        root = self._root()
        for path, content in expected_chapters(root, CORPORA).items():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8")
        (root / "docs/design/v3/05-architecture-and-state.md").write_text(
            "stale\n", encoding="utf-8"
        )
        (root / "docs/design/v3/06-storage-authority-and-transactions.md").unlink()
        (root / "docs/design/v3/30-extra.md").write_text("extra\n", encoding="utf-8")
        errors = verify(root, CORPORA)
        self.assertTrue(any("05-architecture" in error for error in errors), errors)
        self.assertTrue(any("06-storage-authority" in error for error in errors), errors)
        self.assertTrue(any("30-extra" in error for error in errors), errors)

    def test_verify_rejects_section_count_mismatch(self) -> None:
        root = self._root()
        short = replace(V3, names=V3.names[:-1])
        errors = verify(root, (short,))
        self.assertTrue(any("0..28" in error for error in errors), errors)

    def test_registry_rejects_mismatched_version_paths(self) -> None:
        corpus = replace(V3, parent=Path("docs/design/system-v4.md"))
        root = self._root()
        with self.assertRaisesRegex(DesignSyncError, "expected docs/design/system-v3"):
            expected_chapters(root, (corpus,))

    def test_registry_requires_one_in_force_corpus(self) -> None:
        deprecated = replace(V3, status="deprecated", successor=4)
        root = self._root()
        with self.assertRaisesRegex(DesignSyncError, "exactly one in-force"):
            expected_chapters(root, (deprecated,))

    def test_write_validates_registry_before_touching_existing_chapter(self) -> None:
        root = self._root()
        sentinel = root / "docs/design/v3/00-how-to-read.md"
        sentinel.parent.mkdir(parents=True, exist_ok=True)
        sentinel.write_text("keep me\n", encoding="utf-8")
        bad = replace(V3, parent=Path("docs/design/system-v4.md"))
        with self.assertRaises(DesignSyncError):
            write(root, (bad,))
        self.assertEqual(sentinel.read_text(encoding="utf-8"), "keep me\n")

    def test_preamble_marks_v3_as_current(self) -> None:
        root = self._root()
        expected = expected_chapters(root, CORPORA)
        chapter = expected[root / V3.chapter_dir / V3.names[0]]
        self.assertIn("当前生效的目标合同", chapter)
        self.assertNotIn("deprecated", chapter)


if __name__ == "__main__":
    unittest.main()
