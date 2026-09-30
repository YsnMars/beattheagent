// Static file server for dist/ plus the trace collector the game POSTs to during recorded agent runs.
// Run standalone with `npm run serve` to preview a production build locally.
import { createServer, type Server } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

export type TraceBody = { seed: string; token: string; sentAt: number; events: unknown[] };
export type TraceHandler = (token: string, body: TraceBody, receivedAt: number) => void;

export function startServer(opts: { port: number; root: string; acceptToken?: (token: string) => boolean; onTrace?: TraceHandler }): Promise<Server> {
  const root = resolve(opts.root);
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    try {
      if (url.pathname.endsWith("/api/trace") && req.method === "POST") {
        const token = url.searchParams.get("token") ?? "";
        if (!opts.acceptToken?.(token)) {
          res.writeHead(403).end();
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of req) {
          size += (chunk as Buffer).length;
          if (size > 4_000_000) {
            res.writeHead(413).end();
            return;
          }
          chunks.push(chunk as Buffer);
        }
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as TraceBody;
        opts.onTrace?.(token, body, Date.now());
        res.writeHead(204, { "cache-control": "no-store" }).end();
        return;
      }
      if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405).end();
        return;
      }
      let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
      if (path.endsWith("/")) path += "index.html";
      let file = join(root, path);
      if (!file.startsWith(root)) {
        res.writeHead(403).end();
        return;
      }
      const s = await stat(file).catch(() => null);
      if (!s || !s.isFile()) file = join(root, "index.html");
      const data = await readFile(file);
      res.writeHead(200, {
        "content-type": TYPES[extname(file)] ?? "application/octet-stream",
        "cache-control": file.endsWith("index.html") || file.includes(`${"/"}runs${"/"}`) ? "no-cache" : "public, max-age=3600",
      });
      res.end(req.method === "HEAD" ? undefined : data);
    } catch (err) {
      res.writeHead(500).end(String(err));
    }
  });
  return new Promise((ok) => server.listen(opts.port, "127.0.0.1", () => ok(server)));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const port = Number(process.env.PORT ?? 4173);
  startServer({ port, root: "dist" }).then(() => console.log(`Serving dist/ at http://127.0.0.1:${port}`));
}
