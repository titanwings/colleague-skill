#!/usr/bin/env python3
"""
Tests that credential config files are written with restrictive permissions.

Unix-only — skipped on Windows where os.chmod has no effect on POSIX bits.
"""

import json
import os
import stat
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

# Add tools/ to import path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "tools"))


def _try_import(module_name):
    """Try importing a collector module; return None if its dependencies are missing."""
    try:
        return __import__(module_name)
    except SystemExit:
        return None


@unittest.skipUnless(os.name == "posix", "POSIX file permissions not available")
class TestConfigPermissions(unittest.TestCase):
    """Verify save_config() enforces 0o600 on config files and 0o700 on the parent dir."""

    def _assert_permissions(self, save_config_func, config_path_attr, module, tmp_path):
        """Helper: patch CONFIG_PATH, call save_config, check modes."""
        fake_config_path = tmp_path / "sub" / "test_config.json"
        with patch.object(module, config_path_attr, fake_config_path):
            save_config_func({"token": "test-secret-value"})

        self.assertTrue(fake_config_path.exists(), "Config file was not created")

        file_mode = stat.S_IMODE(fake_config_path.stat().st_mode)
        self.assertEqual(
            file_mode, 0o600,
            f"Config file permissions should be 0o600, got {oct(file_mode)}",
        )

        dir_mode = stat.S_IMODE(fake_config_path.parent.stat().st_mode)
        self.assertEqual(
            dir_mode, 0o700,
            f"Config directory permissions should be 0o700, got {oct(dir_mode)}",
        )

    def test_feishu_auto_collector(self):
        mod = _try_import("feishu_auto_collector")
        if mod is None:
            self.skipTest("feishu_auto_collector dependencies not installed")
        with tempfile.TemporaryDirectory() as td:
            self._assert_permissions(mod.save_config, "CONFIG_PATH", mod, Path(td))

    def test_slack_auto_collector(self):
        mod = _try_import("slack_auto_collector")
        if mod is None:
            self.skipTest("slack_auto_collector dependencies not installed")
        with tempfile.TemporaryDirectory() as td:
            self._assert_permissions(mod.save_config, "CONFIG_PATH", mod, Path(td))

    def test_dingtalk_auto_collector(self):
        mod = _try_import("dingtalk_auto_collector")
        if mod is None:
            self.skipTest("dingtalk_auto_collector dependencies not installed")
        with tempfile.TemporaryDirectory() as td:
            self._assert_permissions(mod.save_config, "CONFIG_PATH", mod, Path(td))

    def test_feishu_mcp_client(self):
        mod = _try_import("feishu_mcp_client")
        if mod is None:
            self.skipTest("feishu_mcp_client dependencies not installed")
        with tempfile.TemporaryDirectory() as td:
            self._assert_permissions(mod.save_config, "CONFIG_PATH", mod, Path(td))


if __name__ == "__main__":
    unittest.main()
