// Read-only query validation. Pure functions with no I/O, so they can be
// tested without a database. This is the first line of defence; the second
// is that every query runs inside `BEGIN READ ONLY` (see index.ts), which the
// database enforces regardless of how the statement is spelled.

// Statement keywords that mutate data, schema, permissions, session state,
// or otherwise have side effects. A query is rejected if it begins with any
// of these. Only read verbs (SELECT, WITH, EXPLAIN, SHOW, TABLE, VALUES) pass.
export const WRITE_OPERATIONS = [
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

// Functions callable from a plain SELECT that read or write the server's
// filesystem, run arbitrary SQL (locally or on another server), or change
// session/process state. A read-only transaction does not stop these, so
// they are matched anywhere in the query text. Matching inside strings and
// comments too errs on the side of rejecting.
const SIDE_EFFECT_FUNCTIONS =
  /\b(?:pg_read_\w*file|pg_stat_file|pg_ls_\w+|pg_file_\w+|pg_logdir_ls|pg_logfile_rotate|lo_import|lo_export|dblink\w*|query_to_xml\w*|crosstab\w*|connectby|set_config|pg_terminate_backend|pg_cancel_backend|pg_reload_conf|pg_rotate_logfile|pg_sleep\w*)\b/;

// Unicode-escaped identifiers (U&"lo_\0065xport") can spell a denylisted
// name without matching the regex above, so they are rejected outright.
const UNICODE_ESCAPED_LITERAL = /\bu&["']/;

// Index just past the block comment that starts at position 0, honouring
// PostgreSQL's nested /* */ comments. -1 if the comment is unterminated.
function findBlockCommentEnd(text: string): number {
  let depth = 0;
  for (let i = 0; i < text.length - 1; i++) {
    const pair = text.slice(i, i + 2);
    if (pair === "/*") {
      depth += 1;
      i += 1;
    } else if (pair === "*/") {
      depth -= 1;
      i += 1;
      if (depth === 0) {
        return i + 1;
      }
    }
  }
  return -1;
}

// Removes whitespace and comments before the first token, so `/**/DROP` and
// `-- x\nDROP` are seen as `DROP`. An unterminated block comment is left in
// place for the database to reject.
export function stripLeadingComments(sql: string): string {
  let rest = sql.trimStart();
  for (;;) {
    if (rest.startsWith("--")) {
      const end = rest.indexOf("\n");
      rest = end === -1 ? "" : rest.slice(end + 1).trimStart();
    } else if (rest.startsWith("/*")) {
      const end = findBlockCommentEnd(rest);
      if (end === -1) {
        return rest;
      }
      rest = rest.slice(end).trimStart();
    } else {
      return rest;
    }
  }
}

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
// with leading comments stripped.
function getExecutedExplainTarget(normalizedSql: string): string | null {
  if (!/^explain\b/.test(normalizedSql)) {
    return null;
  }

  let rest = stripLeadingComments(normalizedSql.slice("explain".length));
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
    rest = stripLeadingComments(rest.slice(end + 1));
  } else {
    // Legacy options: EXPLAIN [ANALYZE] [VERBOSE] <statement>
    let match: RegExpMatchArray | null = rest.match(
      /^(analyze|analyse|verbose)\b/
    );
    while (match !== null) {
      if (match[1] !== "verbose") {
        analyzeEnabled = true;
      }
      rest = stripLeadingComments(rest.slice(match[0].length));
      match = rest.match(/^(analyze|analyse|verbose)\b/);
    }
  }

  return analyzeEnabled ? rest : null;
}

function startsWithReadVerb(normalizedSql: string): boolean {
  const statement = stripLeadingComments(normalizedSql);

  // `EXPLAIN ANALYZE` actually executes the underlying statement, so a
  // bare prefix check would let `EXPLAIN ANALYZE DELETE ...` through.
  // Validate the executed inner statement instead of the wrapper.
  const executedTarget = getExecutedExplainTarget(statement);
  if (executedTarget !== null) {
    return startsWithReadVerb(executedTarget);
  }

  return !WRITE_OPERATIONS.some((op) => statement.startsWith(op));
}

export function isReadOnlyQuery(sql: string): boolean {
  const normalizedSql = sql.toLowerCase();
  if (
    SIDE_EFFECT_FUNCTIONS.test(normalizedSql) ||
    UNICODE_ESCAPED_LITERAL.test(normalizedSql)
  ) {
    return false;
  }
  return startsWithReadVerb(normalizedSql);
}
