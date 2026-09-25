#!/usr/bin/env python3
"""
Match titles against a title filter regex with Python's re module, the same
engine yt-dlp uses for `--match-filter "title ~= '...'"` (re.search, case
sensitive unless the pattern sets (?i)).

Reads one JSON object from stdin: {"pattern": str, "titles": [str, ...]}.
Writes one JSON object to stdout: {"matches": [bool, ...]} or {"error": str}.
An empty titles list just checks that the pattern compiles.
"""
import json
import re
import sys


def main():
    try:
        request = json.loads(sys.stdin.buffer.read().decode("utf-8"))
        pattern = request["pattern"]
        titles = request.get("titles") or []
    except (ValueError, KeyError, TypeError) as e:
        print(json.dumps({"error": f"Invalid request: {e}"}))
        return

    try:
        regex = re.compile(pattern)
    except re.error as e:
        print(json.dumps({"error": f"Invalid regex pattern: {e}"}))
        return

    matches = [regex.search(title) is not None for title in titles]
    print(json.dumps({"matches": matches}))


if __name__ == "__main__":
    main()
