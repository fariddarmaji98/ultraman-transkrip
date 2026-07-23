"""Cari fungsi/kelas top-level yang didefinisikan dua kali dalam satu modul.

Kenapa skrip sendiri, bukan linter: **ruff F811 dan pylint E0102 sama-sama
diam bila namanya diawali garis bawah.** Terbukti empiris — `def _f` yang
didefinisikan ulang lolos di keduanya, sedangkan `def f` tertangkap. Padahal
semua helper di backend ini berawalan `_`, jadi pola yang paling rawan justru
yang paling tidak terlihat.

Ini menangkap bug nyata yang membuat upload mati total selama 3 commit
(`816b210`) — lihat docs/architecture/pelajaran-definisi-ganda.md.

Jalankan dari backend/:  .venv/Scripts/python scripts/check_duplicate_defs.py
"""
import ast
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFS = (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)
# Dekorator yang memang sengaja mendefinisikan ulang nama yang sama.
ALLOWED = {"overload", "setter", "getter", "deleter", "register"}


def _decorator_names(node) -> set[str]:
    names = set()
    for dec in node.decorator_list:
        target = dec.func if isinstance(dec, ast.Call) else dec
        names.add(getattr(target, "attr", None) or getattr(target, "id", ""))
    return names


def duplicates(path: Path) -> list[tuple[str, int, int]]:
    """(nama, baris definisi pertama, baris definisi yang menimpa)."""
    seen: dict[str, int] = {}
    found = []
    for node in ast.parse(path.read_text(encoding="utf-8")).body:
        if not isinstance(node, DEFS) or _decorator_names(node) & ALLOWED:
            continue
        if node.name in seen:
            found.append((node.name, seen[node.name], node.lineno))
        seen[node.name] = node.lineno
    return found


def _scan() -> list[str]:
    problems = []
    for path in sorted(ROOT.rglob("*.py")):
        if ".venv" in path.parts:
            continue
        for name, first, again in duplicates(path):
            rel = path.relative_to(ROOT).as_posix()
            problems.append(f"{rel}:{again}  `{name}` menimpa definisi baris {first}")
    return problems


def main() -> int:
    problems = _scan()
    for line in problems:
        print(line)
    print(f"\n{len(problems)} definisi ganda" if problems else "\nBersih.")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
