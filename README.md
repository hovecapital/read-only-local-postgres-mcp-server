# PostgreSQL MCP Server

[![MCP Registry](https://img.shields.io/badge/MCP_Registry-Available-blue)](https://registry.modelcontextprotocol.io)
[![npm version](https://img.shields.io/npm/v/@hovecapital/read-only-postgres-mcp-server.svg)](https://www.npmjs.com/package/@hovecapital/read-only-postgres-mcp-server)

A Model Context Protocol (MCP) server that enables Claude Desktop to interact with PostgreSQL databases through natural language queries.

## Features

- Execute read-only SQL queries through Claude Desktop or Claude Code
- **Dynamic database connections** - connect to any PostgreSQL database at runtime
- Built-in security with query validation (only SELECT statements allowed)
- Easy integration with Claude Desktop and Claude Code
- JSON formatted query results
- Environment-based default configuration with runtime override support

## Quick Start

### For Claude Code Users (Recommended - Easiest Method)

```bash
claude mcp add postgres -s user -- npx -y @hovecapital/read-only-postgres-mcp-server
```

Then set your database environment variables:

```bash
export DB_HOST=localhost
export DB_PORT=5432
export DB_DATABASE=your_database_name
export DB_USERNAME=your_username
export DB_PASSWORD=your_password
```

**Done!** Restart Claude Code and ask: "What tables are in my database?"

### For Claude Desktop Users (Manual Configuration)

**1. Open your config file:**

```bash
# macOS
open ~/Library/Application\ Support/Claude/claude_desktop_config.json

# Windows
notepad %APPDATA%\Claude\claude_desktop_config.json
```

**2. Add this configuration:**

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@hovecapital/read-only-postgres-mcp-server"],
      "env": {
        "DB_HOST": "localhost",
        "DB_PORT": "5432",
        "DB_DATABASE": "your_database_name",
        "DB_USERNAME": "your_username",
        "DB_PASSWORD": "your_password"
      }
    }
  }
}
```

**3. Save, restart Claude Desktop, and test!**

## Prerequisites

- Node.js (v16 or higher) - If using mise, update the command path accordingly
- PostgreSQL database server
- Claude Desktop application

## Installation

### Option 1: Install from MCP Registry (Recommended)

This server is published in the [Model Context Protocol Registry](https://registry.modelcontextprotocol.io) as `capital.hove/read-only-local-postgres-mcp-server`.

#### Method A: Claude Code CLI (Easiest!)

```bash
claude mcp add postgres -s user -- npx -y @hovecapital/read-only-postgres-mcp-server
```

Then configure your database credentials using environment variables. Restart Claude Code and you're done!

**Benefits:**

- One command installation
- No manual JSON editing
- Automatic configuration

#### Method B: Manual JSON Configuration

**For Claude Desktop:**

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@hovecapital/read-only-postgres-mcp-server"],
      "env": {
        "DB_HOST": "localhost",
        "DB_PORT": "5432",
        "DB_DATABASE": "your_database_name",
        "DB_USERNAME": "your_username",
        "DB_PASSWORD": "your_password"
      }
    }
  }
}
```

**For Claude Code:**

Edit `~/.config/claude-code/settings.json` (macOS/Linux) or `%APPDATA%\claude-code\settings.json` (Windows):

```json
{
  "mcp": {
    "servers": {
      "postgres": {
        "command": "npx",
        "args": ["-y", "@hovecapital/read-only-postgres-mcp-server"],
        "env": {
          "DB_HOST": "localhost",
          "DB_PORT": "5432",
          "DB_DATABASE": "your_database_name",
          "DB_USERNAME": "your_username",
          "DB_PASSWORD": "your_password"
        }
      }
    }
  }
}
```

### Option 2: Install from npm

```bash
npm install -g @hovecapital/read-only-postgres-mcp-server
```

### Option 3: Installation with Claude Code

If you're using Claude Code, you can easily install this MCP server:

```bash
# Clone the repository
git clone https://github.com/hovecapital/read-only-local-postgres-mcp-server.git
cd read-only-local-postgres-mcp-server

# Install dependencies and build
npm install
npm run build
```

Then configure Claude Code by adding to your MCP settings.

### Option 4: Manual Installation

#### 1. Clone or Download

Save the repository to a directory on your system:

```bash
mkdir ~/mcp-servers/postgres
cd ~/mcp-servers/postgres
git clone https://github.com/hovecapital/read-only-local-postgres-mcp-server.git .
```

#### 2. Install Dependencies

```bash
npm install
npm run build
```

## Configuration

> **Note:** If you installed via Option 1 (MCP Registry with npx), you've already configured everything! This section is for users who chose Options 2, 3, or 4 (npm or manual installation).

### Claude Code Configuration

If you're using Claude Code with a manual installation, add the PostgreSQL server to your MCP settings:

1. Open your Claude Code settings (typically in `~/.config/claude-code/settings.json` on macOS/Linux or `%APPDATA%\claude-code\settings.json` on Windows)

2. Add the PostgreSQL MCP server configuration:

```json
{
  "mcp": {
    "servers": {
      "postgres": {
        "command": "node",
        "args": ["/absolute/path/to/read-only-local-postgres-mcp-server/dist/index.js"],
        "env": {
          "DB_HOST": "localhost",
          "DB_PORT": "5432",
          "DB_DATABASE": "your_database_name",
          "DB_USERNAME": "your_username",
          "DB_PASSWORD": "your_password"
        }
      }
    }
  }
}
```

1. Restart Claude Code for the changes to take effect.

### Claude Desktop Configuration

If you're using Claude Desktop with a manual installation, open your Claude Desktop configuration file:

**macOS:**

```bash
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Windows:**

```bash
%APPDATA%\Claude\claude_desktop_config.json
```

Add the PostgreSQL server configuration:

```json
{
  "mcpServers": {
    "postgres": {
      "command": "node",
      "args": ["/absolute/path/to/read-only-local-postgres-mcp-server/dist/index.js"],
      "env": {
        "DB_HOST": "localhost",
        "DB_PORT": "5432",
        "DB_DATABASE": "your_database_name",
        "DB_USERNAME": "your_username",
        "DB_PASSWORD": "your_password"
      }
    }
  }
}
```

### Using mise for Node.js

If you're using [mise](https://mise.jdx.dev/) for Node.js version management, make sure to use the full path to the Node.js executable in your configuration.

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | PostgreSQL server hostname | `localhost` |
| `DB_PORT` | PostgreSQL server port | `5432` |
| `DB_DATABASE` | Database name | `postgres` |
| `DB_USERNAME` | PostgreSQL username | `postgres` |
| `DB_PASSWORD` | PostgreSQL password | (empty) |
| `DB_SSL` | Enable SSL connection | `false` |

## Tools

This MCP server exposes three tools that Claude can use to interact with PostgreSQL databases.

### `connect`

Connect to a PostgreSQL database using a connection string. The connection persists for subsequent queries until changed or disconnected.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `connectionString` | string | Yes | PostgreSQL connection string |

**Connection String Format:**

```
postgres://username:password@host:port/database?sslmode=require
postgresql://username:password@host:port/database
```

**SSL Modes Supported:**

- `sslmode=require` - Require SSL (recommended for remote connections)
- `sslmode=verify-full` - Require SSL with certificate verification
- No sslmode parameter - No SSL (for local connections)

**Example Usage (natural language):**

```
"Connect to postgres://myuser:mypass@db.example.com:5432/production"
"Connect to this database: postgres://admin:secret@localhost/analytics"
```

**Response:**

```json
{
  "status": "connected",
  "host": "db.example.com",
  "port": 5432,
  "database": "production",
  "user": "myuser",
  "ssl": true
}
```

---

### `disconnect`

Disconnect from the current runtime database and revert to the default environment-configured connection.

**Parameters:** None

**Example Usage (natural language):**

```
"Disconnect from the current database"
"Go back to the default database"
```

**Response:**

```json
{
  "status": "disconnected",
  "message": "Reverted to default environment connection",
  "host": "localhost",
  "database": "postgres"
}
```

---

### `query`

Run a read-only SQL query against the currently connected database. Optionally override the connection for a single query.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sql` | string | Yes | SQL query to execute (SELECT only) |
| `connectionString` | string | No | Override connection for this query only |

**Example Usage (natural language):**

```
"Show me all tables in the database"
"SELECT * FROM users LIMIT 10"
"Run this query on postgres://other:pass@host/db: SELECT count(*) FROM orders"
```

**Response:**

```json
[
  { "id": 1, "name": "Alice", "email": "alice@example.com" },
  { "id": 2, "name": "Bob", "email": "bob@example.com" }
]
```

---

### Tool Reference for LLMs

When using this MCP server, Claude can:

1. **Query the default database** (configured via environment variables):

   ```
   User: "What tables are in my database?"
   Claude: [Uses query tool with SQL: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"]
   ```

2. **Connect to a different database dynamically**:

   ```
   User: "Connect to postgres://user:pass@newhost/newdb and show me the users table"
   Claude: [Uses connect tool first, then query tool]
   ```

3. **One-off query to a different database** (without switching active connection):

   ```
   User: "How many records are in the orders table on postgres://user:pass@analytics/warehouse?"
   Claude: [Uses query tool with connectionString parameter]
   ```

4. **Revert to default connection**:

   ```
   User: "Go back to my local database"
   Claude: [Uses disconnect tool]
   ```

## Usage

1. **Restart Claude Desktop/Code** after updating the configuration
2. **Start chatting** with Claude about your database

### Example Queries

**Basic queries (uses default/active connection):**

```
"Show me all tables in my database"
"What's the structure of the users table?"
"Get the first 10 records from the products table"
"How many orders were placed last month?"
"Show me users with email addresses ending in @gmail.com"
```

**Dynamic connection examples:**

```
"Connect to postgres://analyst:password@analytics.example.com:5432/warehouse"
"Now show me all the tables"
"What's the total revenue in the sales table?"
"Disconnect and go back to my local database"
```

**One-off queries to different databases:**

```
"Run SELECT count(*) FROM users on postgres://admin:secret@prod.example.com/app"
"Check the orders table on my staging database: postgres://dev:dev@staging/app"
```

Claude will automatically convert your natural language requests into appropriate SQL queries and execute them against your database.

## Security Features

### Read-Only Operations

The server enforces read-only access on **all connections** (both environment-configured and runtime dynamic connections). The following operations are blocked:

- `INSERT` - Adding new records
- `UPDATE` - Modifying existing records
- `DELETE` - Removing records
- `DROP` - Removing tables/databases
- `ALTER` - Modifying table structure
- `CREATE` - Creating new tables/databases
- `TRUNCATE` - Removing all records from a table
- `GRANT` - Modifying permissions
- `REVOKE` - Removing permissions

### Dynamic Connection Security

When using the `connect` tool or `connectionString` parameter:

- **Read-only enforcement still applies** - All queries are validated regardless of connection source
- **Credentials are not logged** - Connection strings with passwords are never written to logs
- **Sanitized responses** - The `connect` tool response excludes passwords
- **Session-based** - Runtime connections only persist for the current MCP session

### Recommended Database Setup

For enhanced security, create a dedicated read-only user for the MCP server:

```sql
-- Create a read-only user
CREATE USER claude_readonly WITH PASSWORD 'secure_password';

-- Grant only SELECT permissions on your specific schema
GRANT USAGE ON SCHEMA public TO claude_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO claude_readonly;

-- Grant permissions for future tables (optional)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO claude_readonly;
```

## Troubleshooting

### Connection Issues

1. **Verify PostgreSQL is running**: Check if your PostgreSQL server is active
2. **Check credentials**: Ensure username/password are correct
3. **Network connectivity**: Confirm Claude Desktop can reach your PostgreSQL server

### Configuration Issues

1. **Restart required**: Always restart Claude Desktop after configuration changes
2. **Path accuracy**: Ensure the absolute path to `dist/index.js` is correct
3. **JSON syntax**: Validate your `claude_desktop_config.json` format

### Debug Mode

To see server logs, you can run the server manually:

```bash
node dist/index.js
```

## File Structure

```bash
~/mcp-servers/postgres/
├── src/
│   └── index.ts
├── dist/
│   ├── index.js
│   └── index.d.ts
├── package.json
├── tsconfig.json
└── node_modules/
```

## Dependencies

- **@modelcontextprotocol/sdk**: MCP protocol implementation
- **pg**: PostgreSQL client for Node.js

## Contributing

Feel free to submit issues and enhancement requests!

## License

This project is open source and available under the [MIT License](LICENSE).

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Verify your PostgreSQL connection independently
3. Ensure Claude Desktop is updated to the latest version
4. Review the Claude Desktop MCP documentation

---

**Note**: This server is designed for development and analysis purposes. For production use, consider additional security measures and monitoring.
