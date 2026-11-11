"""Unit tests for summarise.py on fixture data:  python3 -m unittest discover -s infra/livekit/loadtest/test"""
import contextlib
import io
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import summarise  # noqa: E402

FX = os.path.join(HERE, "fixtures")


class ParseTotalRow(unittest.TestCase):
    def test_real_lk_2_19_summary_row(self):
        row = "│ Total  │ 20/20  │ 398.6kbps (19.9kbps avg) │ 0 (0%)          │ 0     │"
        self.assertEqual(summarise.parse_total_row(row), {
            "subscribed": 20, "expected": 20, "avg_kbps": 19.9, "lost": 0, "loss_pct": 0.0, "errors": 0})

    def test_megabit_totals_and_loss(self):
        p = summarise.parse_total_row("│ Total  │ 250/250  │ 4.9Mbps (19.8kbps avg) │ 800 (1.5%)  │ 2 │")
        self.assertEqual((p["subscribed"], p["lost"], p["loss_pct"], p["errors"]), (250, 800, 1.5, 2))

    def test_no_summary(self):
        self.assertIsNone(summarise.parse_total_row("panic: too many open files"))


class Stages(unittest.TestCase):
    def test_two_machines_are_added_together(self):
        st = summarise.load_results([os.path.join(FX, "results-m1"), os.path.join(FX, "results-m2")])
        self.assertEqual(sorted(st), [100, 250, 500])
        self.assertEqual((st[100].subscribed, st[100].expected), (100, 100))
        self.assertEqual(st[100].connected, 1010)  # steady part starts when the slowest machine is in
        self.assertEqual((st[500].subscribed, st[500].expected, st[500].missing_summary), (250, 500, 1))

    def test_grading_and_verdict(self):
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            summarise.main(["--monitor", os.path.join(FX, "monitor.csv"), os.path.join(FX, "results-m1"), os.path.join(FX, "results-m2")])
        out = buf.getvalue()
        lines = {ln.split("|")[0].strip(): ln for ln in out.splitlines() if "|" in ln and ln.split("|")[0].strip().isdigit()}
        self.assertTrue(lines["100"].rstrip().endswith("PASS"), lines["100"])
        self.assertTrue(lines["250"].rstrip().endswith("PASS"), lines["250"])
        self.assertTrue(lines["500"].rstrip().endswith("FAIL"), lines["500"])
        self.assertIn("250 listener(s) failed", out)
        self.assertIn("CPU 88% ≥ 85%", out)
        self.assertIn("VERDICT: highest passing stage = 250 listeners", out)
        self.assertIn("~175 listeners", out)

    def test_warn_thresholds(self):
        st = summarise.Stage(100, expected=100, subscribed=100)
        result, why = summarise.grade(st, {"cpu": 72, "cpu_peak": 80, "loss": 0.2, "jitter": 10, "mem_pct": 40}, summarise.DEFAULTS)
        self.assertEqual(result, "WARN")
        self.assertEqual(why, ["CPU 72% ≥ 70%"])
        result, _ = summarise.grade(st, {"cpu": 30, "cpu_peak": 40, "loss": 3.5, "jitter": 10, "mem_pct": 40}, summarise.DEFAULTS)
        self.assertEqual(result, "FAIL")


if __name__ == "__main__":
    unittest.main()
