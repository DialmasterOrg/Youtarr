"""Load a private cookie snapshot with the installed yt-dlp; never access YouTube."""

import contextlib
import http.cookiejar
import io
import json
import sys
import time


class NetscapeCookieJarFallback(http.cookiejar.FileCookieJar):
    """Fallback Netscape cookie loader that skips malformed lines instead of aborting."""

    def _really_load(self, f, filename, ignore_discard, ignore_expires):
        now = time.time()
        for line in f:
            line_str = line.strip()
            if not line_str:
                continue
            if line_str.startswith('#'):
                if line_str.startswith('#HttpOnly_'):
                    line_str = line_str[10:]
                else:
                    continue
            parts = line_str.split('\t')
            if len(parts) < 7:
                continue
            try:
                domain, domain_specified, path, secure, expires, name, value = parts[:7]
                secure_bool = (secure.upper() == 'TRUE')
                domain_specified_bool = (domain_specified.upper() == 'TRUE')
                initial_dot = domain.startswith('.')
                try:
                    expires_num = float(expires)
                except ValueError:
                    expires_num = None

                if not ignore_expires and expires_num and expires_num < now:
                    continue

                cookie = http.cookiejar.Cookie(
                    0, name, value,
                    None, False,
                    domain, domain_specified_bool, initial_dot,
                    path, bool(path),
                    secure_bool,
                    expires_num,
                    False,
                    None,
                    None,
                    {}
                )
                if not ignore_discard and cookie.discard:
                    continue
                self.set_cookie(cookie)
            except Exception:
                continue

    def save(self, filename=None, ignore_discard=False, ignore_expires=False):
        if filename is None:
            if self.filename is not None:
                filename = self.filename
            else:
                raise ValueError(http.cookiejar.MISSING_FILENAME_TEXT)

        with open(filename, 'w', encoding='utf-8') as f:
            f.write('# Netscape HTTP Cookie File\n')
            f.write('# http://curl.haxx.se/rfc/cookie_spec.html\n')
            f.write('# This is a generated file!  Do not edit.\n\n')
            for cookie in self:
                if not ignore_discard and cookie.discard:
                    continue
                if not ignore_expires and cookie.is_expired():
                    continue
                secure = "TRUE" if cookie.secure else "FALSE"
                initial_dot = "TRUE" if cookie.domain.startswith(".") else "FALSE"
                expires = str(int(cookie.expires)) if cookie.expires is not None else "0"

                f.write("\t".join([
                    cookie.domain, initial_dot, cookie.path,
                    secure, expires, cookie.name, cookie.value
                ]) + "\n")


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
            # imported as a Python package. Use resilient Netscape fallback parser.
            YoutubeDLCookieJar = NetscapeCookieJarFallback

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
