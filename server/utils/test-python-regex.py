#!/usr/bin/env python3
"""
Test if a title matches a Python regex pattern.
Used to preview channel download filters with exact yt-dlp behavior.
"""
import sys
import re
import json

def test_regex(pattern, title):
    """Test if title matches the Python regex pattern."""
    try:
        regex = re.compile(pattern)
        return regex.search(title) is not None
    except re.error as e:
        raise ValueError(f"Invalid regex pattern: {str(e)}")

if __name__ == "__main__":
    # Read pattern and title from command line args
    if len(sys.argv) != 3:
        print(json.dumps({"error": "Usage: test-python-regex.py <pattern> <title>"}))
        sys.exit(1)

    pattern = sys.argv[1]
    title = sys.argv[2]

    try:
        matches = test_regex(pattern, title)
        print(json.dumps({"matches": matches}))
    except ValueError as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
