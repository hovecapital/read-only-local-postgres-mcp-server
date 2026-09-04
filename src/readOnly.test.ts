import assert from "node:assert/strict";
import { isReadOnlyQuery } from "./readOnly.js";

const allowed = [
  "SELECT 1",
  "  select * from users -- trailing comment",
  "/* leading */ SELECT 1",
  "-- line comment\nSELECT 1",
  "WITH t AS (SELECT 1) SELECT * FROM t",
  "EXPLAIN ANALYZE SELECT 1",
  "EXPLAIN (ANALYZE, BUFFERS) SELECT 1",
  "EXPLAIN DELETE FROM users",
  "EXPLAIN (ANALYZE false) DELETE FROM users",
  "SHOW search_path",
  "TABLE users",
  "VALUES (1), (2)",
  "SELECT last_update, pg_ls FROM film",
];

const rejected = [
  "DROP TABLE users",
  "SET password_encryption = 'md5'",
  "COPY (SELECT 1) TO '/tmp/x'",
  "/**/DROP TABLE users",
  "-- x\nDROP TABLE users",
  "/* /* nested */ */ DROP TABLE users",
  "EXPLAIN ANALYZE DELETE FROM users",
  "EXPLAIN /* c */ ANALYZE DELETE FROM users",
  "EXPLAIN/**/ANALYZE DELETE FROM users",
  "EXPLAIN (ANALYZE) /* c */ DELETE FROM users",
  "SELECT lo_export(1, '/tmp/x')",
  "SELECT pg_catalog.\"lo_export\"(1, '/tmp/x')",
  "SELECT lo_export/**/(1, '/tmp/x')",
  "SELECT pg_read_file('/etc/passwd')",
  "SELECT pg_read_binary_file('/etc/passwd')",
  "SELECT * FROM pg_ls_dir('/')",
  "SELECT pg_file_write('/tmp/x', 'm10x', false)",
  "SELECT dblink_exec('dbname=x', 'DROP TABLE users')",
  "SELECT query_to_xml('COPY (SELECT 1) TO ''/tmp/x''', true, false, '')",
  "SELECT set_config('x', 'y', false)",
  "SELECT pg_terminate_backend(1)",
  "SELECT pg_sleep(100)",
  "SELECT U&\"lo_\\0065xport\"(1, '/tmp/x')",
];

for (const sql of allowed) {
  assert.equal(isReadOnlyQuery(sql), true, `should allow: ${sql}`);
}
for (const sql of rejected) {
  assert.equal(isReadOnlyQuery(sql), false, `should reject: ${sql}`);
}

console.error(
  `readOnly: ${allowed.length} allowed, ${rejected.length} rejected, all as expected`
);
