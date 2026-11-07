import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { networkInterfaces } from "node:os";
import { join } from "node:path";
import { localClients, root } from "./lib/local-supabase.mjs";
const { anonKey } = localClients();
const addresses = Object.entries(networkInterfaces())
  .filter(([name]) => !/virtual|vEthernet|WSL|VPN|Loopback/i.test(name))
  .flatMap(([, rows]) => rows ?? []);
const host = process.env.SHELF_LAN_HOST ??
  addresses.find(
    (r) =>
      r.family === "IPv4" &&
      !r.internal &&
      /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(r.address),
  )?.address;
if (
  !host ||
  !/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)[0-9.]+$/.test(host) ||
  host.split(".").length !== 4 ||
  host.split(".").some((n) => Number(n) > 255)
) {
  throw new Error(
    "Set SHELF_LAN_HOST to this computer’s private IPv4 Wi-Fi address.",
  );
}
const origin = `http://${host}:5173`;
writeFileSync(
  join(root, "supabase/.temp/wallet-device.env"),
  `SHELF_ALLOWED_ORIGINS=${origin}\n${
    existsSync(join(root, "supabase/.temp/payments.env"))
      ? readFileSync(join(root, "supabase/.temp/payments.env"), "utf8")
      : ""
  }`,
);
console.log(
  `Local device preview: ${origin}. Local OTP inbox on this computer: http://127.0.0.1:55324. No email is delivered externally by the local stack.`,
);
const options = { cwd: root, stdio: "inherit", windowsHide: true };
const edge = spawn(
  process.execPath,
  [
    join(root, "node_modules/supabase/dist/supabase.js"),
    "functions",
    "serve",
    "--env-file",
    "supabase/.temp/wallet-device.env",
  ],
  options,
);
const vite = spawn(
  process.execPath,
  [join(root, "node_modules/vite/bin/vite.js"), "--host", "0.0.0.0"],
  {
    ...options,
    env: {
      ...process.env,
      VITE_SUPABASE_URL: `http://${host}:55321`,
      VITE_SUPABASE_PUBLISHABLE_KEY: anonKey,
      VITE_DEV_BORROWING: "",
      VITE_APP_URL: origin,
    },
  },
);
const paymentEnvPath = join(root, "supabase/.temp/payments.env");
const reconcileSecret = existsSync(paymentEnvPath)
  ? readFileSync(paymentEnvPath, "utf8").match(
    /^PAYMENT_RECONCILE_SECRET=(.+)$/m,
  )?.[1].trim()
  : undefined;
let reconciling = false;
const reconciliation = setInterval(async () => {
  if (!reconcileSecret || reconciling) return;
  reconciling = true;
  try {
    await fetch("http://127.0.0.1:55321/functions/v1/payments-reconcile", {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "x-shelf-reconcile": reconcileSecret,
      },
      signal: AbortSignal.timeout(45000),
    });
  } catch {
    /* Pending payments remain locked and retry on the next bounded tick. */
  } finally {
    reconciling = false;
  }
}, 60000);
function stop() {
  clearInterval(reconciliation);
  edge.kill();
  vite.kill();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
edge.on("exit", () => {
  clearInterval(reconciliation);
  vite.kill();
});
vite.on("exit", () => {
  clearInterval(reconciliation);
  edge.kill();
});
