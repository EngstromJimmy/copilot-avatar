import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const CONFIG_FILES = ["squad.config.ts", "squad.config.js", "squad.config.json"];
const ROSTER_FILES = ["roster.md", "team.md"];
const EMPTY_MAP = Object.freeze([]);

let squadSdkPromise;

function createEmptySquadContext(cwd = process.cwd(), overrides = {}) {
    return {
        active: false,
        cwd,
        squadPath: null,
        teamName: "",
        coordinatorName: "",
        clientName: getSquadClientName(),
        idleStatusText: "",
        idleSubtaskText: "",
        agentsByKey: new Map(EMPTY_MAP),
        error: "",
        ...overrides,
    };
}

function getSquadClientName() {
    return String(process.env.SQUAD_CLIENT || "").trim();
}

async function getSquadSdk() {
    if (!squadSdkPromise) {
        squadSdkPromise = import("@bradygaster/squad-sdk")
            .then((module) => module)
            .catch((error) => {
                if (error?.code === "ERR_MODULE_NOT_FOUND" || /Cannot find package '@bradygaster\/squad-sdk'/.test(String(error?.message || ""))) {
                    return null;
                }
                throw error;
            });
    }
    return squadSdkPromise;
}

function normalizeAgentKey(value) {
    return String(value || "")
        .trim()
        .replace(/^@+/, "")
        .replace(/\s+/g, "-")
        .toLowerCase();
}

function cleanMarkdownText(value) {
    return String(value || "")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/\*\*/g, "")
        .replace(/__/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function truncateText(value, maxLength = 140) {
    const text = cleanMarkdownText(value);
    if (text.length <= maxLength) {
        return text;
    }
    return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function titleCaseWords(value) {
    return cleanMarkdownText(value)
        .replace(/[-_]+/g, " ")
        .replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}

function getMarkdownField(content, label) {
    const expression = new RegExp(`^-\\s*\\*\\*${label}:\\*\\*\\s*(.+)$`, "im");
    return cleanMarkdownText(content.match(expression)?.[1] || "");
}

function getFirstBlockquote(content) {
    const expression = /^>\s*(.+)$/m;
    return truncateText(content.match(expression)?.[1] || "", 120);
}

function summarizeCharter(content, role = "") {
    const expertise = getMarkdownField(content, "Expertise");
    const style = getMarkdownField(content, "Style");
    const tagline = getFirstBlockquote(content);
    const parts = [];

    if (role) {
        parts.push(role);
    }
    if (expertise && !parts.some((part) => part.toLowerCase() === expertise.toLowerCase())) {
        parts.push(expertise);
    } else if (!expertise && tagline && !parts.some((part) => part.toLowerCase() === tagline.toLowerCase())) {
        parts.push(tagline);
    }
    if (style && parts.join(" - ").length < 110) {
        parts.push(style);
    }

    return truncateText(parts.join(" - "), 160);
}

function extractSection(content, heading) {
    const lines = String(content || "").split(/\r?\n/);
    const wantedHeading = `## ${heading}`.toLowerCase();
    let startIndex = -1;

    for (let index = 0; index < lines.length; index += 1) {
        if (lines[index].trim().toLowerCase() === wantedHeading) {
            startIndex = index + 1;
            break;
        }
    }

    if (startIndex < 0) {
        return "";
    }

    const sectionLines = [];
    for (let index = startIndex; index < lines.length; index += 1) {
        if (/^#{1,2}\s+/.test(lines[index].trim())) {
            break;
        }
        sectionLines.push(lines[index]);
    }

    return sectionLines.join("\n");
}

function parseMarkdownTable(section) {
    const lines = String(section || "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.startsWith("|"));

    if (lines.length < 2) {
        return [];
    }

    const rows = [];
    for (const line of lines.slice(2)) {
        const cells = line
            .split("|")
            .slice(1, -1)
            .map((cell) => cleanMarkdownText(cell));

        if (cells.every((cell) => !cell)) {
            continue;
        }

        rows.push(cells);
    }

    return rows;
}

function deriveAgentId({ name, charterPath }) {
    const charterMatch = String(charterPath || "").match(/agents\/([^/\\]+)\/charter\.md/i);
    if (charterMatch?.[1]) {
        return normalizeAgentKey(charterMatch[1]);
    }
    return normalizeAgentKey(name);
}

function deriveDefaultCharterPath(agentId) {
    return agentId ? `.squad/agents/${agentId}/charter.md` : "";
}

function shouldSkipRosterValue(value) {
    return !value || /^\{.+\}$/.test(value) || value === "—";
}

async function safeReadFile(path) {
    try {
        return await readFile(path, "utf-8");
    } catch {
        return "";
    }
}

async function safeReadJson(path) {
    const content = await safeReadFile(path);
    if (!content) {
        return null;
    }

    try {
        return JSON.parse(content);
    } catch {
        return null;
    }
}

function resolveSquadReferencePath(squadPath, referencePath) {
    if (!referencePath || referencePath === "—") {
        return "";
    }

    const cleaned = cleanMarkdownText(referencePath).replace(/\\/g, "/");
    if (!cleaned) {
        return "";
    }

    if (cleaned.startsWith(".squad/")) {
        return resolve(dirname(squadPath), cleaned);
    }

    return resolve(squadPath, cleaned);
}

async function loadCharterSummary(squadPath, referencePath, role) {
    const charterPath = resolveSquadReferencePath(squadPath, referencePath);
    if (!charterPath || !existsSync(charterPath)) {
        return "";
    }

    const content = await safeReadFile(charterPath);
    if (!content) {
        return "";
    }

    return summarizeCharter(content, role);
}

async function loadCharterMetadata(squadPath, referencePath, fallbackRole = "") {
    const charterPath = resolveSquadReferencePath(squadPath, referencePath);
    const cleanFallbackRole = cleanMarkdownText(fallbackRole);
    if (!charterPath || !existsSync(charterPath)) {
        return {
            role: cleanFallbackRole,
            description: truncateText(cleanFallbackRole, 160),
        };
    }

    const content = await safeReadFile(charterPath);
    if (!content) {
        return {
            role: cleanFallbackRole,
            description: truncateText(cleanFallbackRole, 160),
        };
    }

    const role = cleanMarkdownText(getMarkdownField(content, "Role") || cleanFallbackRole);
    return {
        role,
        description: summarizeCharter(content, role) || truncateText(role, 160),
    };
}

async function loadRosterMetadata(squadPath) {
    for (const fileName of ROSTER_FILES) {
        const rosterPath = join(squadPath, fileName);
        if (!existsSync(rosterPath)) {
            continue;
        }

        const content = await safeReadFile(rosterPath);
        if (!content) {
            continue;
        }

        const coordinatorRows = parseMarkdownTable(extractSection(content, "Coordinator"));
        const memberRows = parseMarkdownTable(extractSection(content, "Members"));
        const codingAgentRows = parseMarkdownTable(extractSection(content, "Coding Agent"));
        const coordinatorName = coordinatorRows[0]?.[0] || "";
        let rosterAgents = [...memberRows, ...codingAgentRows]
            .map(([name, role, charterPath = "", status = ""]) => ({
                id: deriveAgentId({ name, charterPath }),
                name: cleanMarkdownText(name),
                displayName: cleanMarkdownText(name),
                role: cleanMarkdownText(role),
                charterPath: cleanMarkdownText(charterPath),
                status: cleanMarkdownText(status),
            }))
            .filter((agent) => !shouldSkipRosterValue(agent.displayName) && agent.id);

        if (!rosterAgents.length) {
            rosterAgents = parseSimpleRoster(content).map((agent) => ({
                ...agent,
                charterPath: agent.charterPath || deriveDefaultCharterPath(agent.id),
            }));
        }

        const agents = await Promise.all(rosterAgents.map(async (agent) => ({
            ...agent,
            description: await loadCharterSummary(squadPath, agent.charterPath, agent.role) || agent.description,
        })));

        return {
            coordinatorName,
            agents,
        };
    }

    function parseSimpleRoster(content) {
        return String(content || "")
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line && !line.startsWith("#") && !line.startsWith(">") && !line.startsWith("|"))
            .map((line) => {
                const cleaned = line.replace(/^[^\p{L}\p{N}@]+/u, "").trim();
                const match = cleaned.match(/^(.+?)\s+—\s+(.+?)(?:\s{2,}(.*))?$/u);
                if (!match) {
                    return null;
                }

                const [, name, role, notes = ""] = match;
                const id = normalizeAgentKey(name);
                return {
                    id,
                    name: cleanMarkdownText(name),
                    displayName: cleanMarkdownText(name),
                    role: cleanMarkdownText(role),
                    charterPath: "",
                    status: "",
                    description: truncateText(notes ? `${role} - ${notes}` : role, 160),
                };
            })
            .filter((agent) => agent && !shouldSkipRosterValue(agent.displayName) && agent.id);
    }

    return {
        coordinatorName: "",
        agents: [],
    };
}

function findConfigMarker(startDir) {
    let currentDir = resolve(startDir || process.cwd());

    while (true) {
        for (const fileName of CONFIG_FILES) {
            const candidate = join(currentDir, fileName);
            if (existsSync(candidate)) {
                return candidate;
            }
        }

        const parentDir = dirname(currentDir);
        if (parentDir === currentDir) {
            return "";
        }
        currentDir = parentDir;
    }
}

function getConfigAgentEntries(config) {
    if (!config || typeof config !== "object") {
        return [];
    }

    if (Array.isArray(config.agents)) {
        return config.agents
            .filter((agent) => agent && typeof agent === "object")
            .map((agent) => ({
                id: normalizeAgentKey(agent.name || ""),
                displayName: cleanMarkdownText(agent.displayName || agent.name || ""),
                role: cleanMarkdownText(agent.role || ""),
                description: truncateText(agent.charter || agent.description || "", 160),
            }))
            .filter((agent) => agent.id);
    }

    if (config.agents && typeof config.agents === "object") {
        return Object.entries(config.agents)
            .map(([name, agent]) => ({
                id: normalizeAgentKey(name),
                displayName: cleanMarkdownText(agent?.displayName || name),
                role: cleanMarkdownText(agent?.role || ""),
                description: truncateText(agent?.charter || agent?.description || "", 160),
            }))
            .filter((agent) => agent.id);
    }

    return [];
}

async function loadConfigMetadata(sdk, cwd) {
    const configMarker = findConfigMarker(cwd);
    if (!configMarker || typeof sdk?.loadConfig !== "function") {
        return null;
    }

    try {
        const config = await sdk.loadConfig(dirname(configMarker));
        return {
            teamName: cleanMarkdownText(config?.team?.name || ""),
            agents: getConfigAgentEntries(config),
        };
    } catch {
        return null;
    }
}

function getLatestCastingSnapshot(history) {
    const snapshots = history?.assignment_cast_snapshots;
    if (!snapshots || typeof snapshots !== "object") {
        return null;
    }

    const usageHistory = Array.isArray(history?.universe_usage_history)
        ? [...history.universe_usage_history].reverse()
        : [];
    for (const entry of usageHistory) {
        const assignmentId = cleanMarkdownText(entry?.assignment_id || "");
        const snapshot = assignmentId ? snapshots[assignmentId] : null;
        if (snapshot?.agents && typeof snapshot.agents === "object") {
            return snapshot;
        }
    }

    const availableSnapshots = Object.values(snapshots)
        .filter((snapshot) => snapshot?.agents && typeof snapshot.agents === "object")
        .sort((left, right) => String(left?.created_at || "").localeCompare(String(right?.created_at || "")));
    return availableSnapshots.length ? availableSnapshots[availableSnapshots.length - 1] : null;
}

async function loadCastingMetadata(squadPath) {
    const castingRegistryPath = join(squadPath, "casting", "registry.json");
    const castingHistoryPath = join(squadPath, "casting", "history.json");
    const [castingRegistry, castingHistory] = await Promise.all([
        safeReadJson(castingRegistryPath),
        safeReadJson(castingHistoryPath),
    ]);

    const snapshot = getLatestCastingSnapshot(castingRegistry) || getLatestCastingSnapshot(castingHistory);
    if (!snapshot?.agents || typeof snapshot.agents !== "object") {
        return [];
    }

    const castingEntries = Object.entries(snapshot.agents)
        .map(([slotAlias, castName]) => ({
            id: normalizeAgentKey(slotAlias),
            displayName: cleanMarkdownText(castName),
        }))
        .filter((agent) => agent.id && agent.displayName);

    return Promise.all(castingEntries.map(async (agent) => {
        const charterPath = deriveDefaultCharterPath(normalizeAgentKey(agent.displayName));
        const charter = await loadCharterMetadata(squadPath, charterPath, titleCaseWords(agent.id));
        return {
            id: agent.id,
            name: agent.displayName,
            displayName: agent.displayName,
            role: charter.role || titleCaseWords(agent.id),
            description: charter.description || "",
        };
    }));
}

function isStableLookupAgentId(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (!normalized) {
        return false;
    }

    if (/^agent[-_]?call\b/.test(normalized) || /^subagent[-_]/.test(normalized)) {
        return false;
    }

    return /^[a-z0-9@_-]+$/.test(normalized);
}

function buildAgentLookup(agents) {
    const lookup = new Map();

    for (const agent of agents) {
        const aliases = new Set([
            normalizeAgentKey(agent.id),
            normalizeAgentKey(agent.displayName),
            normalizeAgentKey(agent.name),
            normalizeAgentKey(`@${agent.id}`),
        ]);

        for (const alias of aliases) {
            if (!alias) {
                continue;
            }

            const existing = lookup.get(alias) || {};
            lookup.set(alias, {
                id: agent.id || existing.id || "",
                displayName: agent.displayName || existing.displayName || "",
                role: agent.role || existing.role || "",
                description: agent.description || existing.description || "",
                status: agent.status || existing.status || "",
            });
        }
    }

    return lookup;
}

function mergeAgentSources(rosterAgents, configAgents, castingAgents = []) {
    const merged = new Map();

    for (const agent of [...configAgents, ...rosterAgents, ...castingAgents]) {
        const key = normalizeAgentKey(agent.id || agent.displayName);
        if (!key) {
            continue;
        }

        const existing = merged.get(key) || {};
        merged.set(key, {
            id: key,
            name: agent.name || existing.name || "",
            displayName: agent.displayName || existing.displayName || "",
            role: agent.role || existing.role || "",
            description: agent.description || existing.description || "",
            status: agent.status || existing.status || "",
        });
    }

    return [...merged.values()];
}

export async function loadSquadContext(cwd = process.cwd()) {
    const resolvedCwd = resolve(cwd || process.cwd());
    const clientName = getSquadClientName();
    const sdk = await getSquadSdk();

    if (!sdk) {
        return createEmptySquadContext(resolvedCwd, { clientName });
    }

    let squadPath = "";
    try {
        squadPath = typeof sdk.resolveSquad === "function" ? sdk.resolveSquad(resolvedCwd) : "";
    } catch {
        squadPath = "";
    }

    if (!squadPath) {
        return createEmptySquadContext(resolvedCwd, { clientName });
    }

    try {
        const [rosterMetadata, configMetadata, castingMetadata] = await Promise.all([
            loadRosterMetadata(squadPath),
            loadConfigMetadata(sdk, resolvedCwd),
            loadCastingMetadata(squadPath),
        ]);
        const agents = mergeAgentSources(rosterMetadata.agents, configMetadata?.agents || [], castingMetadata);
        const teamName = cleanMarkdownText(configMetadata?.teamName || "");
        const coordinatorName = cleanMarkdownText(rosterMetadata.coordinatorName || "Squad");

        return createEmptySquadContext(resolvedCwd, {
            active: true,
            squadPath,
            teamName,
            coordinatorName,
            clientName,
            idleStatusText: "",
            idleSubtaskText: "",
            agentsByKey: buildAgentLookup(agents),
        });
    } catch (error) {
        return createEmptySquadContext(resolvedCwd, {
            clientName,
            error: error instanceof Error ? error.message : String(error),
        });
    }
}

export function getSquadTitleSuffix(context) {
    if (!context?.active) {
        return "";
    }
    return context.teamName || context.coordinatorName || "Squad";
}

export function getSquadWindowContext(context) {
    if (!context?.active) {
        return { active: false, statusText: "", detailText: "" };
    }

    return {
        active: true,
        statusText: context.idleStatusText || "",
        detailText: context.idleSubtaskText || "",
    };
}

export function resolveSquadAgentMetadata(context, agentData = {}) {
    if (!(context?.agentsByKey instanceof Map) || context.agentsByKey.size === 0) {
        return null;
    }

    const keys = [
        normalizeAgentKey(agentData.spawnDisplayName),
        normalizeAgentKey(agentData.spawnName),
        normalizeAgentKey(agentData.agentName),
        normalizeAgentKey(agentData.agentDisplayName),
        isStableLookupAgentId(agentData.agentId) ? normalizeAgentKey(agentData.agentId) : "",
    ].filter(Boolean);

    for (const key of keys) {
        if (context.agentsByKey.has(key)) {
            return context.agentsByKey.get(key);
        }
    }

    return null;
}
