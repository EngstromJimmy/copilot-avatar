// Extension: copilot-avatar
// 3D Copilot avatar that shows agent responses

try {
    await import("./main.mjs");
} catch (error) {
    console.error("[copilot-avatar] Failed to load extension:", error?.message || String(error));
    console.error("[copilot-avatar] Stack:", error?.stack || "");
}
