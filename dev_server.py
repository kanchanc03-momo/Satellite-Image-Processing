"""
EarthVision Port 3000 Dev Server
Serves /frontend files and proxies /api requests to FastAPI on port 8000.
Runs purely on Python standard library without triggering Windows AppLocker on native binaries.
"""
import http.server
import socketserver
import urllib.request
import os

PORT = 3000
BACKEND_URL = "http://127.0.0.1:8080"
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "frontend"))

class DevProxyHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=FRONTEND_DIR, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_GET(self):
        if self.path.startswith("/api/"):
            self.proxy_request("GET")
        else:
            super().do_GET()

    def do_POST(self):
        if self.path.startswith("/api/"):
            self.proxy_request("POST")
        else:
            self.send_error(405, "Method Not Allowed")

    def proxy_request(self, method):
        target_url = BACKEND_URL + self.path
        body = None
        if method == "POST":
            content_len = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_len) if content_len > 0 else None

        req = urllib.request.Request(target_url, data=body, method=method)
        for header, val in self.headers.items():
            if header.lower() not in ["host", "content-length"]:
                req.add_header(header, val)

        try:
            with urllib.request.urlopen(req) as response:
                self.send_response(response.status)
                for header, val in response.getheaders():
                    self.send_header(header, val)
                self.end_headers()
                self.wfile.write(response.read())
        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            for header, val in e.headers.items():
                self.send_header(header, val)
            self.end_headers()
            self.wfile.write(e.read())
        except Exception as e:
            self.send_error(502, f"Bad Gateway to Backend: {e}")

if __name__ == "__main__":
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    port = PORT
    httpd = None
    for p in [PORT, 3001, 3002, 3003, 8000]:
        try:
            httpd = socketserver.ThreadingTCPServer(("", p), DevProxyHandler)
            port = p
            break
        except OSError:
            continue
    if not httpd:
        raise RuntimeError("No available port found between 3000 and 3003.")
    print(f"Dev proxy server running on http://localhost:{port}")
    httpd.serve_forever()
