// Verifies the five-tool surface of an installed Distilly host plugin through the
// official MCP client, then writes the exact tool list as evidence.
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const [launcher, host, home, outDirectory] = process.argv.slice(2);
if ([launcher, host, home, outDirectory].includes(undefined)) {
  throw new Error("usage: verify-host-mcp.mjs <launcher> <host> <home> <outDir>");
}

const transport = new StdioClientTransport({
  command: launcher,
  args: ["mcp", "--host", host],
  cwd: home,
  env: { ...process.env, HOME: home, USERPROFILE: home },
  stderr: "pipe",
});

let stderr = "";
transport.stderr?.setEncoding("utf8");
transport.stderr?.on("data", (chunk) => {
  stderr += chunk;
});

const client = new Client({ name: "distilly-host-verification", version: "0.0.0" });
await client.connect(transport);
const tools = await client.listTools();
const names = tools.tools.map(({ name }) => name).sort();
await client.close();

const record = {
  host,
  launcher,
  toolCount: names.length,
  tools: names,
  descriptors: tools.tools.map(({ name, description, inputSchema }) => ({
    name,
    description,
    requiredInputKeys: Object.keys(inputSchema?.properties ?? {}),
  })),
  stderrEmpty: stderr === "",
  stderr,
};

await writeFile(
  join(outDirectory, `mcp-tools-${host}.json`),
  `${JSON.stringify(record, null, 2)}\n`,
  "utf8",
);
process.stdout.write(`${JSON.stringify(record, null, 2)}\n`);
