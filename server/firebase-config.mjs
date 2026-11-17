import fs from "node:fs/promises";
const privateFile = new URL("../.runtime/firebase.local.json", import.meta.url);
const loopback = (v) => ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(v);
const localHost = (v) => ["localhost", "127.0.0.1", "[::1]"].includes(v);
export function createFirebaseConfigMiddleware({ readConfig = () => fs.readFile(privateFile, "utf8") } = {}) {
  return async (req, res, next) => {
    const path = req.url?.split("?")[0];
    if (!["/firebase/config", "/firebase/debug-token"].includes(path)) return next();
    const send = (code, data) => {
      res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
      res.end(JSON.stringify(data));
    };
    let host;
    try { host = new URL("http://" + req.headers.host).hostname; } catch { return send(403, { error: "Local setup only" }); }
    if (req.method !== "GET" || !loopback(req.socket.remoteAddress) || !localHost(host)) return send(403, { error: "Local setup only" });
    if (req.headers["sec-fetch-site"] === "cross-site") return send(403, { error: "Same-origin setup only" });
    if (req.headers.origin && req.headers.origin !== "http://" + req.headers.host) return send(403, { error: "Same-origin setup only" });
    try {
      const c = JSON.parse(await readConfig());
      if (!c.firebase?.apiKey || !c.firebase?.appId || !c.firebase?.projectId) throw new Error();
      if (path.endsWith("debug-token")) {
        if (req.headers["x-showflow-local-setup"] !== "1" || c.appCheck?.provider !== "debug" || !c.appCheck.debugToken) return send(403, { error: "Debug setup unavailable" });
        return send(200, { debugToken: c.appCheck.debugToken });
      }
      const firebase = Object.fromEntries(["apiKey", "appId", "projectId", "authDomain", "storageBucket", "messagingSenderId"].filter(k => c.firebase[k]).map(k => [k, c.firebase[k]]));
      return send(200, { configured: true, firebase, cloudModel: c.cloudModel || "gemini-3.5-flash-lite", appCheck: { provider: c.appCheck?.provider, siteKey: c.appCheck?.siteKey } });
    } catch {
      return send(503, { configured: false, error: "Firebase 尚未配置，请完成本地项目连接。" });
    }
  };
}
