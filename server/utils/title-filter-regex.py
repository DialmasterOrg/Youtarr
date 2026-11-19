#!/usr/bin/env python3
"""
Match titles against regexes with Python's re module, the same engine yt-dlp
uses for `--match-filter "title ~= '...'"` (re.search, case sensitive unless
the pattern sets (?i)).

Reads one JSON object from stdin and writes one JSON object to stdout.

Title filter (no mode):
  {"pattern": str, "titles": [str, ...]} -> {"matches": [bool, ...]}
  An empty titles list just checks that the pattern compiles.

Compile check (mode "check"):
  {"mode": "check", "patterns": [str, ...]} -> {"errors": [null | str, ...]}

Title-show classification (mode "classify"):
  {"mode": "classify",
   "patterns": [{"regex": str, "excludes": [str, ...]}, ...],
   "titles": [str, ...]}
  -> {"results": [null | {"index": int, "groups": {name: str | null}}, ...]}
  Each title gets the first pattern that matches it and none of whose
  excludes match it.

Any failure: {"error": str}.
"""
import json
import re
import sys


def title_filter(request):
    pattern = request["pattern"]
    titles = request.get("titles") or []
    try:
        regex = re.compile(pattern)
    except re.error as e:
        return {"error": f"Invalid regex pattern: {e}"}
    return {"matches": [regex.search(title) is not None for title in titles]}


def check(request):
    errors = []
    for pattern in request["patterns"]:
        try:
            re.compile(pattern)
            errors.append(None)
        except re.error as e:
            errors.append(str(e))
    return {"errors": errors}


def classify(request):
    compiled = []
    try:
        for entry in request["patterns"]:
            compiled.append((
                re.compile(entry["regex"]),
                [re.compile(exclude) for exclude in entry.get("excludes") or []],
            ))
    except re.error as e:
        return {"error": f"Invalid regex pattern: {e}"}

    results = []
    for title in request.get("titles") or []:
        result = None
        for index, (regex, excludes) in enumerate(compiled):
            match = regex.search(title)
            if match is None or any(exclude.search(title) for exclude in excludes):
                continue
            result = {"index": index, "groups": match.groupdict()}
            break
        results.append(result)
    return {"results": results}


MODES = {"check": check, "classify": classify}


def main():
    try:
        request = json.loads(sys.stdin.buffer.read().decode("utf-8"))
        handler = MODES[request["mode"]] if "mode" in request else title_filter
        response = handler(request)
    except (ValueError, KeyError, TypeError) as e:
        response = {"error": f"Invalid request: {e}"}
    print(json.dumps(response))


if __name__ == "__main__":
    main()
