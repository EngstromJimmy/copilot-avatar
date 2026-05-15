// Child process: opens the native window. The Node event loop is blocked
// by app.run() — all communication happens via the page's WebSocket.
import { Application } from "@webviewjs/webview";

const { CW_URL, CW_TITLE, CW_WIDTH, CW_HEIGHT, CW_TRANSPARENT, CW_ALWAYS_ON_TOP } = process.env;
const app = new Application();
const transparent = CW_TRANSPARENT === "1";
const alwaysOnTop = CW_ALWAYS_ON_TOP === "1";
const win = app.createBrowserWindow({ title: CW_TITLE, width: +CW_WIDTH, height: +CW_HEIGHT, transparent, alwaysOnTop, decorations: !transparent });
if (alwaysOnTop) {
    win.setAlwaysOnTop(true);
}
win.createWebview({ url: CW_URL, enableDevtools: true, transparent });
app.run();
