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

type QueryToolArguments = {
  sql: string;
};

type DatabaseConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl?: { rejectUnauthorized: boolean } | boolean;
};

class PostgreSQLServer {
  private server: Server;

  constructor() {
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

  private async createClient(): Promise<typeof Client.prototype> {
    try {
      const config: DatabaseConfig = {
        host: DB_HOST,
        port: parseInt(DB_PORT, 10),
        user: DB_USERNAME,
        password: DB_PASSWORD,
        database: DB_DATABASE,
        ssl: DB_SSL === "true" ? { rejectUnauthorized: false } : false,
      };
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
          name: "query",
          description: "Run a read-only SQL query",
          inputSchema: {
            type: "object",
            properties: {
              sql: {
                type: "string",
                description: "SQL query to execute (read-only)",
              },
            },
            required: ["sql"],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name !== "query") {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${request.params.name}`
        );
      }

      const { sql } = request.params.arguments as QueryToolArguments;

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
        client = await this.createClient();
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
    });
  }

  private isReadOnlyQuery(sql: string): boolean {
    const normalizedSql = sql.trim().toLowerCase();
    const writeOperations = [
      "insert",
      "update",
      "delete",
      "drop",
      "alter",
      "create",
      "truncate",
      "grant",
      "revoke",
    ] as const;

    return !writeOperations.some((op) => normalizedSql.startsWith(op));
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("PostgreSQL MCP server running on stdio");
  }
}

const server = new PostgreSQLServer();
server.run().catch(console.error);
