#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import pkg from "pg";
const { Client } = pkg;
import type { QueryResult } from "pg";

const DB_HOST: string = process.env.DB_HOST ?? "localhost";
const DB_PORT: string = process.env.DB_PORT ?? "5432";
const DB_DATABASE: string = process.env.DB_DATABASE ?? "postgres";
const DB_USERNAME: string = process.env.DB_USERNAME ?? "postgres";
const DB_PASSWORD: string = process.env.DB_PASSWORD ?? "";
const DB_SSL: string = process.env.DB_SSL ?? "false";

type ConnectionSource = "environment" | "runtime";

type DatabaseConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl?: { rejectUnauthorized: boolean } | boolean;
};

type ActiveConnection = {
  config: DatabaseConfig;
  source: ConnectionSource;
};

type QueryToolArguments = {
  sql: string;
  connectionString?: string;
};

type ConnectToolArguments = {
  connectionString: string;
};

type ToolResult = {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
};

function parseConnectionString(connectionString: string): DatabaseConfig {
  const url = new URL(connectionString);

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error(
      "Invalid connection string: must start with postgres:// or postgresql://"
    );
  }

  const sslMode = url.searchParams.get("sslmode");
  const ssl =
    sslMode === "require" || sslMode === "verify-full"
      ? { rejectUnauthorized: sslMode === "verify-full" }
      : false;

  return {
    host: url.hostname || "localhost",
    port: parseInt(url.port, 10) || 5432,
    user: decodeURIComponent(url.username) || "postgres",
    password: decodeURIComponent(url.password) || "",
    database: url.pathname.slice(1) || "postgres",
    ssl,
  };
}

// Statement keywords that mutate data, schema, permissions, session state,
// or otherwise have side effects. A query is rejected if it begins with any
// of these. Only read verbs (SELECT, WITH, EXPLAIN, SHOW, TABLE, VALUES) pass.
const WRITE_OPERATIONS = [
  // Data manipulation
  "insert",
  "update",
  "delete",
  "truncate",
  "copy",
  "merge",
  // Schema / DDL
  "drop",
  "alter",
  "create",
  "comment",
  "rename",
  "reassign",
  // Permissions
  "grant",
  "revoke",
  "security",
  // Session / config mutation
  "set",
  "reset",
  "discard",
  "load",
  // Procedures / dynamic execution
  "call",
  "do",
  "execute",
  "prepare",
  "deallocate",
  // Cursors
  "declare",
  "fetch",
  "move",
  "close",
  // Transaction control
  "begin",
  "start",
  "commit",
  "rollback",
  "savepoint",
  "release",
  "lock",
  // Maintenance (all write to catalogs / relations)
  "vacuum",
  "analyze",
  "reindex",
  "cluster",
  "refresh",
  "checkpoint",
  // Async notification
  "notify",
  "listen",
  "unlisten",
] as const;

// Whether an EXPLAIN options string enables ANALYZE (e.g. "analyze, buffers"
// or "format json, analyze true"). ANALYZE explicitly disabled counts as off.
function isAnalyzeOptionEnabled(options: string): boolean {
  const match = options.match(/\banaly[sz]e\b\s*([a-z0-9]+)?/);
  if (!match) {
    return false;
  }
  const value = match[1];
  return !(value !== undefined && ["false", "off", "0", "no"].includes(value));
}

// Returns the inner statement of an EXPLAIN that will actually be executed
// (i.e. EXPLAIN ANALYZE ...), so it can be validated on its own. Returns null
// for non-EXPLAIN queries and for plain EXPLAIN / ANALYZE-disabled EXPLAIN,
// neither of which executes the underlying statement. Input must be lowercased
// and trimmed.
function getExecutedExplainTarget(normalizedSql: string): string | null {
  if (!/^explain[\s(]/.test(normalizedSql)) {
    return null;
  }

  let rest = normalizedSql.slice("explain".length).trimStart();
  let analyzeEnabled = false;

  if (rest.startsWith("(")) {
    // Parenthesized options: EXPLAIN (ANALYZE, BUFFERS) <statement>
    let depth = 0;
    let end = -1;
    for (let i = 0; i < rest.length; i++) {
      const char = rest[i];
      if (char === "(") {
        depth += 1;
      } else if (char === ")") {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) {
      return null; // Unbalanced parentheses; let the denylist handle it.
    }
    analyzeEnabled = isAnalyzeOptionEnabled(rest.slice(1, end));
    rest = rest.slice(end + 1).trimStart();
  } else {
    // Legacy options: EXPLAIN [ANALYZE] [VERBOSE] <statement>
    let match: RegExpMatchArray | null = rest.match(
      /^(analyze|analyse|verbose)\b\s*/
    );
    while (match !== null) {
      if (match[1] !== "verbose") {
        analyzeEnabled = true;
      }
      rest = rest.slice(match[0].length);
      match = rest.match(/^(analyze|analyse|verbose)\b\s*/);
    }
  }

  return analyzeEnabled ? rest : null;
}

class PostgreSQLServer {
  private server: Server;
  private activeConnection: ActiveConnection;
  private defaultConnection: ActiveConnection;

  constructor() {
    this.defaultConnection = {
      config: {
        host: DB_HOST,
        port: parseInt(DB_PORT, 10),
        user: DB_USERNAME,
        password: DB_PASSWORD,
        database: DB_DATABASE,
        ssl: DB_SSL === "true" ? { rejectUnauthorized: false } : false,
      },
      source: "environment",
    };
    this.activeConnection = this.defaultConnection;

    this.server = new Server(
      {
        name: "postgresql-server",
        version: "0.1.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();

    this.server.onerror = (error): void => console.error("[MCP Error]", error);
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private async createClient(
    configOverride?: DatabaseConfig
  ): Promise<typeof Client.prototype> {
    try {
      const config = configOverride ?? this.activeConnection.config;
      const client = new Client(config);
      await client.connect();
      return client;
    } catch (error) {
      console.error("Failed to create PostgreSQL connection:", error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to connect to PostgreSQL: ${(error as Error).message}`
      );
    }
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "connect",
          description:
            "Connect to a PostgreSQL database using a connection string. The connection persists for subsequent queries until changed or disconnected.",
          inputSchema: {
            type: "object",
            properties: {
              connectionString: {
                type: "string",
                description:
                  "PostgreSQL connection string (e.g., postgres://user:password@host:5432/database?sslmode=require)",
              },
            },
            required: ["connectionString"],
          },
        },
        {
          name: "disconnect",
          description:
            "Disconnect from the current runtime database and revert to the default environment-configured connection",
          inputSchema: {
            type: "object",
            properties: {},
            required: [],
          },
        },
        {
          name: "query",
          description:
            "Run a read-only SQL query against the currently connected database",
          inputSchema: {
            type: "object",
            properties: {
              sql: {
                type: "string",
                description: "SQL query to execute (read-only)",
              },
              connectionString: {
                type: "string",
                description:
                  "Optional: PostgreSQL connection string to override the current connection for this query only",
              },
            },
            required: ["sql"],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;

      if (toolName === "connect") {
        return this.handleConnect(
          request.params.arguments as ConnectToolArguments
        );
      }

      if (toolName === "disconnect") {
        return this.handleDisconnect();
      }

      if (toolName === "query") {
        return this.handleQuery(request.params.arguments as QueryToolArguments);
      }

      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
    });
  }

  private async handleConnect(args: ConnectToolArguments): Promise<ToolResult> {
    const { connectionString } = args;

    try {
      const config = parseConnectionString(connectionString);

      // Test the connection
      const client = new Client(config);
      await client.connect();
      await client.end();

      // Store as active connection
      this.activeConnection = {
        config,
        source: "runtime",
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                status: "connected",
                host: config.host,
                port: config.port,
                database: config.database,
                user: config.user,
                ssl: config.ssl !== false,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Connection failed: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  }

  private handleDisconnect(): ToolResult {
    this.activeConnection = this.defaultConnection;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              status: "disconnected",
              message: "Reverted to default environment connection",
              host: this.defaultConnection.config.host,
              database: this.defaultConnection.config.database,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  private async handleQuery(args: QueryToolArguments): Promise<ToolResult> {
    const { sql, connectionString } = args;

    if (!this.isReadOnlyQuery(sql)) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Only SELECT queries are allowed for security reasons.",
          },
        ],
        isError: true,
      };
    }

    let client: typeof Client.prototype | undefined;
    try {
      const config = connectionString
        ? parseConnectionString(connectionString)
        : undefined;
      client = await this.createClient(config);
      const result: QueryResult = await client.query(sql);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result.rows, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `PostgreSQL Error: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    } finally {
      if (client) {
        await client.end();
      }
    }
  }

  private isReadOnlyQuery(sql: string): boolean {
    const normalizedSql = sql.trim().toLowerCase();

    // `EXPLAIN ANALYZE` actually executes the underlying statement, so a
    // bare prefix check would let `EXPLAIN ANALYZE DELETE ...` through.
    // Validate the executed inner statement instead of the wrapper.
    const executedTarget = getExecutedExplainTarget(normalizedSql);
    if (executedTarget !== null) {
      return this.isReadOnlyQuery(executedTarget);
    }

    return !WRITE_OPERATIONS.some((op) => normalizedSql.startsWith(op));
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("PostgreSQL MCP server running on stdio");
  }
}

const server = new PostgreSQLServer();
server.run().catch(console.error);
