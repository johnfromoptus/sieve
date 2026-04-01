import { createServer as createHttpsServer } from "https";
import { createServer as createHttpServer } from "http";
import { readFileSync } from "fs";
import next from "next";

const port = parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";

const httpsOptions = {
  key: readFileSync("./dev-key.pem"),
  cert: readFileSync("./dev-cert.pem"),
};

// Create the HTTPS server first so Next.js can attach its WebSocket (HMR) handler to it
const httpsServer = createHttpsServer(httpsOptions);
const app = next({ dev, httpServer: httpsServer });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // HTTPS on port 3000 for browser access (Spotify OAuth requires it)
  httpsServer.on("request", (req, res) => {
    handle(req, res);
  });
  httpsServer.listen(port, "0.0.0.0", () => {
    console.log(`> Ready on https://0.0.0.0:${port}`);
  });

  // HTTP on port 3001 for local tooling (Playwright, curl, etc.)
  createHttpServer((req, res) => {
    handle(req, res);
  }).listen(3001, "127.0.0.1", () => {
    console.log(`> Ready on http://127.0.0.1:3001 (local only)`);
  });
});
