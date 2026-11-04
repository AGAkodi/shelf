import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { localClients, root, sql } from "./lib/local-supabase.mjs";
const { server, url, anonKey } = localClients(),
  ids = [];
const env = {
  ...process.env,
  VITE_SUPABASE_URL: url,
  VITE_SUPABASE_PUBLISHABLE_KEY: anonKey,
  VITE_DEV_BORROWING: "enabled",
};
let status;
try {
  for (const name of ["DESKTOP", "MOBILE"]) {
    const email = `ui-${randomUUID()}@example.invalid`;
    const { data, error } = await server.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    ids.push(data.user.id);
    env[`SHELF_TEST_EMAIL_${name}`] = email;
  }
  const result = spawnSync(
    process.execPath,
    [
      join(root, "node_modules/@playwright/test/cli.js"),
      "test",
      "--config",
      "playwright.borrowing.config.ts",
    ],
    { cwd: root, env, stdio: "inherit" },
  );
  status = result.status ?? 1;
} finally {
  if (ids.length) {
    const list = ids
      .map((id) => {
        if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error("Invalid test user");
        return `'${id}'`;
      })
      .join(",");
    sql(
      `begin; alter table public.payments disable trigger retain_payment; alter table public.loans disable trigger retain_loan; delete from public.payments where user_id in (${list}); delete from public.loans where user_id in (${list}); alter table public.payments enable trigger retain_payment; alter table public.loans enable trigger retain_loan; commit;`,
    );
    for (const id of ids) await server.auth.admin.deleteUser(id);
  }
}
process.exit(status);
