#!/usr/bin/env python3
import os
import subprocess
import tempfile
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class MarkupHandler(SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/api/copy-image":
            self.send_error(404)
            return

        content_type = self.headers.get("Content-Type", "")
        content_length = int(self.headers.get("Content-Length", "0"))
        if content_type != "image/png" or content_length <= 0:
            self.send_error(400, "Expected a PNG image")
            return

        image_data = self.rfile.read(content_length)
        temp_path = ""
        try:
            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as temp_file:
                temp_file.write(image_data)
                temp_path = temp_file.name

            script = (
                'set the clipboard to '
                f'(read POSIX file "{temp_path}" as «class PNGf»)'
            )
            subprocess.run(
                ["osascript", "-e", script],
                check=True,
                capture_output=True,
                timeout=10,
            )
        except (OSError, subprocess.SubprocessError):
            self.send_error(500, "Could not write to the system clipboard")
            return
        finally:
            if temp_path:
                try:
                    os.unlink(temp_path)
                except OSError:
                    pass

        self.send_response(204)
        self.end_headers()


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 4173), MarkupHandler)
    print("Markup is running at http://127.0.0.1:4173", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
