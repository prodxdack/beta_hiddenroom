# Hidden Room Operational Rules

These rules apply to the entire repository.

## Supabase and production

- Treat every remote Supabase access as read-only by default. Project `rpcunbkstadgngqrjafp` is production, and both beta and production currently use it.
- Never run remote or linked variants of `db push`, `migration up`, `functions deploy`, secret changes, write SQL, or write-capable Supabase MCP tools without the user's explicit approval for that exact remote change. This does not prohibit explicitly local variants such as `migration up --local`, `db reset --local`, or local tests.
- If a command can use the linked project and does not clearly specify `--local`, treat it as remote and do not execute it without explicit approval.
- Develop every Supabase change first as a versioned forward migration and test it against Supabase Local. Do not iterate SQL directly against production.
- A production change requires a verifiable backup, a tested restore, a rollback procedure, role-based tests, and human approval before execution.
- Supabase authorization tests must cover both allowed and denied access as `anon`, client, collaborator, and administrator, including cross-client negative cases.

## Worktree and Git

- Always preserve existing user changes and integrate with them instead of overwriting, cleaning, or reverting them.
- Do not commit, push, merge, stash, reset, or discard changes without explicit user authorization.

## Secrets

- Never print or expose secrets, tokens, passwords, connection strings, service-role keys, or credential values in source, commands, logs, diffs, or responses.
