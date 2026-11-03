#!/usr/bin/env python3
"""Lightweight structural checks for the three generated LaTeX papers."""

from __future__ import annotations

import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EXPECTED = {"paper3": 22, "paper4": 22, "paper5": 18}


def environments(text: str) -> tuple[list[str], list[str]]:
    begins = re.findall(r"\\begin\{([^}]+)\}", text)
    ends = re.findall(r"\\end\{([^}]+)\}", text)
    return begins, ends


def validate(paper: str, expected: int) -> list[str]:
    errors: list[str] = []
    question_path = ROOT / paper / "questions.tex"
    solution_path = ROOT / paper / "solutions.tex"
    if not question_path.exists() or not solution_path.exists():
        return [f"{paper}: missing questions.tex or solutions.tex"]

    questions = question_path.read_text(encoding="utf-8")
    solutions = solution_path.read_text(encoding="utf-8")
    question_numbers = [
        int(number)
        for number in re.findall(r"\\begin\{question\}\{(\d+)\}", questions)
    ]
    solution_numbers = [
        int(number)
        for number in re.findall(r"\\begin\{solution\}\{(\d+)\}", solutions)
    ]
    expected_numbers = list(range(1, expected + 1))

    if question_numbers != expected_numbers:
        errors.append(
            f"{paper}: question numbers {question_numbers}, expected {expected_numbers}"
        )
    if solution_numbers != expected_numbers:
        errors.append(
            f"{paper}: solution numbers {solution_numbers}, expected {expected_numbers}"
        )

    for path, text in ((question_path, questions), (solution_path, solutions)):
        begins, ends = environments(text)
        if begins != ends:
            # A stack check yields a more useful first mismatch than raw counts.
            stack: list[str] = []
            for match in re.finditer(r"\\(begin|end)\{([^}]+)\}", text):
                action, name = match.groups()
                if action == "begin":
                    stack.append(name)
                elif not stack or stack.pop() != name:
                    errors.append(
                        f"{paper}/{path.name}: mismatched environment near "
                        f"character {match.start()}: {match.group(0)}"
                    )
                    break
            else:
                if stack:
                    errors.append(
                        f"{paper}/{path.name}: unclosed environments {stack}"
                    )

        if re.search(r"includegraphics.*assets/original", text):
            errors.append(f"{paper}/{path.name}: embeds an original raster image")

    return errors


def main() -> int:
    errors = [
        error
        for paper, expected in EXPECTED.items()
        for error in validate(paper, expected)
    ]
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print("Content structure validated for all three papers.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
