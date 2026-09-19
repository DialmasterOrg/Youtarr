"""Load a private cookie snapshot with the installed yt-dlp; never access YouTube."""

import contextlib
import http.cookiejar
import io
import json
import sys


def validate(executable, snapshot):
    # The Docker image uses yt-dlp's Python zipimport executable. Import from
    # that exact installation so self-updates also update the cookie parser.
    sys.path.insert(0, executable)
    diagnostics = io.StringIO()
    # yt-dlp and Python's cookie loader can print entire malformed records.
    # Suppress those diagnostics even on failure; return only fixed error codes.
    with contextlib.redirect_stderr(diagnostics), contextlib.redirect_stdout(io.StringIO()):
        try:
            from yt_dlp.cookies import YoutubeDLCookieJar
        except Exception:
            # The self-updated standalone binary is executable but cannot be
            # imported as a Python package. Its cookie format is Netscape, so
            # validate and normalize it locally without contacting YouTube.
            YoutubeDLCookieJar = http.cookiejar.MozillaCookieJar

        try:
            jar = YoutubeDLCookieJar(snapshot)
            jar.load(ignore_discard=True, ignore_expires=True)
        except Exception:
            return {"valid": False, "error": "invalid"}
        if not len(jar):
            return {"valid": False, "error": "empty"}

        try:
            # Use precisely the cookies the parser accepted, without passing
            # rejected lines to the eventual download or its logs a second time.
            jar.save(ignore_discard=True, ignore_expires=True)
        except Exception:
            return {"valid": False, "error": "snapshot"}
        return {"valid": True, "warnings": bool(diagnostics.getvalue())}


if __name__ == "__main__":
    result = validate(*sys.argv[1:]) if len(sys.argv) == 3 else {"valid": False, "error": "unavailable"}
    print(json.dumps(result))
