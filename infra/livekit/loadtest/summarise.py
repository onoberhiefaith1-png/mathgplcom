#!/usr/bin/env python3
"""Summarise a stepped LiveKit load test (standard library only).

Reads the server CSV from monitor-server.sh and one or more client result
folders from run-load-test.sh (one per load machine), then prints one row per
stage with PASS / WARN / FAIL and a final verdict.

    ./summarise.py --monitor monitor-20261111T1700Z.csv results/2026...-m1 results/2026...-m2
"""
from __future__ import annotations

import argparse
import csv
import math
import os
import re
import sys
from dataclasses import dataclass, field

# Thresholds. CPU is whole-machine %, averaged over the steady part of a stage.
DEFAULTS = {
    "cpu_warn": 70.0, "cpu_fail": 85.0, "cpu_peak_warn": 95.0,
    "loss_warn": 1.0, "loss_fail": 3.0,
    "jitter_warn": 30.0, "jitter_fail": 50.0,
    "mem_warn": 80.0, "mem_fail": 90.0,
}
WIRE_KBPS_PER_LISTENER = 50.0  # ~48 kbps Opus speech + RTP/UDP/IP overhead (estimate)

TOTAL_ROW = re.compile(
    r"│\s*Total\s*│\s*(\d+)\s*/\s*(\d+)\s*│\s*([\d.]+)\s*([kMG]?)bps\s*\(\s*([\d.]+)\s*([kMG]?)bps avg\)\s*│\s*(\d+)\s*\(\s*([\d.]+)%\)\s*│\s*(\d+|-)\s*│"
)
UNIT = {"": 1e-3, "k": 1.0, "M": 1e3, "G": 1e6}  # → kbps


@dataclass
class Stage:
    total: int
    expected: int = 0
    subscribed: int = 0
    errors: int = 0
    missing_summary: int = 0
    lost_pkts: int = 0
    client_loss_pct: list = field(default_factory=list)
    client_avg_kbps: list = field(default_factory=list)
    start: int = 0
    connected: int = 0
    end: int = 0
    machines: int = 0


def parse_total_row(text: str):
    rows = TOTAL_ROW.findall(text)
    if not rows:
        return None
    got, want, _tot, _tu, avg, au, lost, loss_pct, errs = rows[-1]
    return {
        "subscribed": int(got), "expected": int(want), "avg_kbps": float(avg) * UNIT[au],
        "lost": int(lost), "loss_pct": float(loss_pct), "errors": 0 if errs == "-" else int(errs),
    }


def load_results(folders: list[str]) -> dict[int, Stage]:
    stages: dict[int, Stage] = {}
    for folder in folders:
        path = os.path.join(folder, "stages.csv")
        if not os.path.exists(path):
            sys.exit(f"{folder}: no stages.csv (is this a run-load-test.sh results folder?)")
        with open(path, newline="") as fh:
            for row in csv.DictReader(fh):
                total = int(row["stage_total"])
                st = stages.setdefault(total, Stage(total))
                st.machines += 1
                start, connected, end = int(row["start_epoch"]), int(row["connected_epoch"]), int(row["end_epoch"])
                st.start = start if not st.start else min(st.start, start)
                st.connected = max(st.connected, connected)
                st.end = end if not st.end else min(st.end, end)
                subs_here = int(row["subscribers_here"])
                try:
                    with open(os.path.join(folder, row["file"]), encoding="utf-8", errors="replace") as out:
                        parsed = parse_total_row(out.read())
                except FileNotFoundError:
                    parsed = None
                if parsed is None:
                    # lk crashed or was killed before printing its summary: count everyone as failed.
                    st.expected += subs_here
                    st.missing_summary += 1
                    continue
                st.expected += max(parsed["expected"], subs_here)
                st.subscribed += parsed["subscribed"]
                st.errors += parsed["errors"]
                st.lost_pkts += parsed["lost"]
                st.client_loss_pct.append(parsed["loss_pct"])
                if parsed["subscribed"]:
                    st.client_avg_kbps.append(parsed["avg_kbps"])
    return stages


def num(v):
    try:
        return float(v) if v not in ("", None) else None
    except ValueError:
        return None


def load_monitor(paths: list[str]) -> list[dict]:
    rows = []
    for p in paths:
        with open(p, newline="") as fh:
            rows.extend(csv.DictReader(fh))
    return sorted(rows, key=lambda r: int(r["epoch"]))


def mean(xs):
    xs = [x for x in xs if x is not None]
    return sum(xs) / len(xs) if xs else None


def peak(xs):
    xs = [x for x in xs if x is not None]
    return max(xs) if xs else None


def grade(st: Stage, server: dict, t: dict) -> tuple[str, list[str]]:
    fails, warns = [], []
    failed_subs = st.expected - st.subscribed + st.errors
    if st.missing_summary:
        fails.append(f"{st.missing_summary} client run(s) gave no summary")
    if failed_subs > 0:
        fails.append(f"{failed_subs} listener(s) failed to connect/subscribe")
    cpu, cpu_pk = server.get("cpu"), server.get("cpu_peak")
    if cpu is None:
        warns.append("no server samples in this stage's window")
    else:
        if cpu >= t["cpu_fail"]:
            fails.append(f"CPU {cpu:.0f}% ≥ {t['cpu_fail']:.0f}%")
        elif cpu >= t["cpu_warn"]:
            warns.append(f"CPU {cpu:.0f}% ≥ {t['cpu_warn']:.0f}%")
        if cpu_pk is not None and cpu_pk >= t["cpu_peak_warn"]:
            warns.append(f"CPU peak {cpu_pk:.0f}%")
    loss = server.get("loss")
    if loss is not None:
        if loss >= t["loss_fail"]:
            fails.append(f"loss {loss:.2f}% ≥ {t['loss_fail']}%")
        elif loss >= t["loss_warn"]:
            warns.append(f"loss {loss:.2f}% ≥ {t['loss_warn']}%")
    jit = server.get("jitter")
    if jit is not None:
        if jit >= t["jitter_fail"]:
            fails.append(f"jitter {jit:.0f} ms ≥ {t['jitter_fail']:.0f} ms")
        elif jit >= t["jitter_warn"]:
            warns.append(f"jitter {jit:.0f} ms ≥ {t['jitter_warn']:.0f} ms")
    mem = server.get("mem_pct")
    if mem is not None:
        if mem >= t["mem_fail"]:
            fails.append(f"memory {mem:.0f}%")
        elif mem >= t["mem_warn"]:
            warns.append(f"memory {mem:.0f}%")
    if fails:
        return "FAIL", fails + warns
    return ("WARN", warns) if warns else ("PASS", [])


def server_window(rows: list[dict], st: Stage) -> dict:
    lo = st.connected if st.connected > st.start else st.start
    sel = [r for r in rows if lo <= int(r["epoch"]) <= st.end]
    if not sel:
        return {}
    cpu = [num(r["cpu_pct"]) for r in sel]
    used = [num(r["mem_used_mb"]) for r in sel]
    total = peak([num(r["mem_total_mb"]) for r in sel]) or 0
    client = [r for r in sel if r.get("lk_up") == "1"]
    pk_used = peak(used)
    loss_vals = [num(r["loss_pct_out"]) for r in client]
    return {
        "samples": len(sel),
        "cpu": mean(cpu), "cpu_peak": peak(cpu),
        "mem_mb": pk_used, "mem_pct": (100 * pk_used / total) if (pk_used and total) else None,
        "net_mbps": mean([num(r["net_tx_mbps"]) for r in sel]),
        "lk_mbps": mean([num(r["lk_out_mbps"]) for r in client]),
        "participants": peak([num(r["participants"]) for r in client]),
        "loss": mean(loss_vals),
        "jitter": mean([num(r["jitter_ms_out"]) for r in client]),
        "retx": mean([num(r["retransmits_per_s"]) for r in client]),
        "lk_cpu": mean([num(r["lk_cpu_pct"]) for r in client]),
        "goroutines": peak([num(r["goroutines"]) for r in client]),
    }


def fmt(v, spec=".1f", none="–"):
    return none if v is None else format(v, spec)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("results", nargs="+", help="results folder(s) from run-load-test.sh, one per load machine")
    ap.add_argument("--monitor", action="append", default=[], help="CSV from monitor-server.sh (repeatable)")
    for k, v in DEFAULTS.items():
        ap.add_argument(f"--{k.replace('_', '-')}", type=float, default=v)
    a = ap.parse_args(argv)
    t = {k: getattr(a, k) for k in DEFAULTS}

    stages = load_results(a.results)
    rows = load_monitor(a.monitor) if a.monitor else []
    if not a.monitor:
        print("Note: no --monitor CSV given, so CPU/memory/loss/jitter come only from the clients.\n")

    head = ("Listeners", "OK/expected", "CPU avg%", "CPU peak%", "Mem MB", "Out Mbps", "@48k Mbps", "kbps/listener", "Loss %", "Jitter ms", "Retx/s", "Result")
    print(" | ".join(head))
    print("-" * 132)
    graded = []
    for total in sorted(stages):
        st = stages[total]
        sv = server_window(rows, st)
        # Loss: the worse of what the server saw (RTCP) and what the test clients counted.
        client_loss = max(st.client_loss_pct) if st.client_loss_pct else None
        sv["loss"] = max(x for x in (sv.get("loss"), client_loss, 0.0) if x is not None) if (sv.get("loss") is not None or client_loss is not None) else None
        result, why = grade(st, sv, t)
        graded.append((total, result, why, sv))
        out_mbps = sv.get("lk_mbps") if sv.get("lk_mbps") is not None else sv.get("net_mbps")
        per = (1000 * out_mbps / st.subscribed) if (out_mbps and st.subscribed) else mean(st.client_avg_kbps)
        print(" | ".join([
            f"{total:>9}", f"{st.subscribed}/{st.expected}".rjust(11), fmt(sv.get("cpu")).rjust(8), fmt(sv.get("cpu_peak")).rjust(9),
            fmt(sv.get("mem_mb"), ".0f").rjust(6), fmt(out_mbps, ".2f").rjust(8), f"{total * WIRE_KBPS_PER_LISTENER / 1000:.1f}".rjust(9),
            fmt(per, ".1f").rjust(13), fmt(sv.get("loss"), ".2f").rjust(6), fmt(sv.get("jitter"), ".1f").rjust(9),
            fmt(sv.get("retx"), ".1f").rjust(6), result,
        ]))
        for w in why:
            print(f"{'':>12}↳ {w}")
    print()
    print(f"Thresholds: CPU avg < {t['cpu_warn']:.0f}% (FAIL ≥ {t['cpu_fail']:.0f}%), loss < {t['loss_warn']}% (FAIL ≥ {t['loss_fail']}%), "
          f"jitter < {t['jitter_warn']:.0f} ms (FAIL ≥ {t['jitter_fail']:.0f}), memory < {t['mem_warn']:.0f}%, no failed listeners.")
    print("'@48k Mbps' = listeners × ~50 kbps, the bandwidth a real class at the app's speech bitrate would need (estimate).")
    print()
    best = None
    for total, result, _why, sv in graded:
        if result == "FAIL":
            break
        if result == "PASS":
            best = (total, sv)
    if best is None:
        first_bad = next(((tt, r) for tt, r, _w, _s in graded if r != "PASS"), None)
        print(f"VERDICT: no stage passed (first problem at {first_bad[0]} listeners: {first_bad[1]}). "
              "Check the client machines first (CPU, bandwidth, ulimit) before blaming the server.")
        return 0
    total, sv = best
    cpu = sv.get("cpu")
    top = max(stages)
    advice = f"Plan for at most ~{int(total * 0.7)} listeners per server (70% of the highest passing stage) to keep headroom."
    if cpu and cpu > 0 and total == top:
        ceiling = int(total * t["cpu_warn"] / cpu)
        if ceiling > total:
            advice += (f" CPU was only {cpu:.0f}% at {total}, so the server was not the limit; a straight-line guess puts the "
                       f"{t['cpu_warn']:.0f}% CPU point near {ceiling} listeners (an extrapolation, not a measurement: run a higher stage to confirm).")
    print(f"VERDICT: highest passing stage = {total} listeners (CPU avg {fmt(cpu, '.0f')}%, loss {fmt(sv.get('loss'), '.2f')}%). {advice}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
