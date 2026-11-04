import { localOtp } from "../../scripts/lib/local-otp.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { localClients, sql } from "../../scripts/lib/local-supabase.mjs";
const origin = "http://127.0.0.1:5173";
test("email Auth and real signed wallet ownership isolation", async (t) => {
  const { server, reader, url, anonKey } = localClients(),
    users = [];
  const must = (r) => {
    assert.equal(r.error, null, r.error?.message);
    return r.data;
  };
  const request = async (user, body, requestOrigin = origin) => {
    const response = await fetch(`${url}/functions/v1/wallet-auth`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Origin: requestOrigin,
        "Content-Type": "application/json",
        ...(user ? { Authorization: `Bearer ${user.token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  try {
    for (let i = 0; i < 2; i++) {
      const email = `wallet-${randomUUID()}@example.invalid`;
      const created = must(
        await server.auth.admin.createUser({ email, email_confirm: true }),
      );
      const link = must(
        await server.auth.admin.generateLink({ type: "magiclink", email }),
      );
      const client = reader();
      const signed = must(
        await client.auth.verifyOtp({
          token_hash: link.properties.hashed_token,
          type: "email",
        }),
      );
      users.push({
        id: created.user.id,
        token: signed.session.access_token,
        client,
      });
    }
    const [a, b] = users;
    // Ephemeral unfunded test signing keys exist only in process memory, never in files or application code.
    const wallet = privateKeyToAccount(generatePrivateKey()),
      other = privateKeyToAccount(generatePrivateKey());
    const challenge = async (user = a, address = wallet.address) => {
      const r = await request(user, {
        action: "challenge",
        address,
        chainId: 137,
      });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      return r.body;
    };
    const proof = async (c, signer = wallet) => ({
      action: "verify",
      id: c.challenge.id,
      secret: c.secret,
      signature: await signer.signTypedData(c.typedData),
    });
    await t.test(
      "confirmed email OTP sessions retain real canonical UUIDs; replayed email token fails",
      async () => {
        assert.equal(must(await a.client.auth.getUser()).user.id, a.id);
        const email = `otp-${randomUUID()}@example.invalid`;
        const created = must(
          await server.auth.admin.createUser({ email, email_confirm: true }),
        );
        users.push({ id: created.user.id });
        const link = must(
          await server.auth.admin.generateLink({ type: "magiclink", email }),
        );
        const client = reader();
        must(
          await client.auth.verifyOtp({
            token_hash: link.properties.hashed_token,
            type: "email",
          }),
        );
        assert.ok(
          (
            await reader().auth.verifyOtp({
              token_hash: link.properties.hashed_token,
              type: "email",
            })
          ).error,
        );
      },
    );
    await t.test(
      "real email delivery template supplies a one-time code; wrong code fails",
      async () => {
        const email = `sent-${randomUUID()}@example.invalid`;
        const created = must(
          await server.auth.admin.createUser({ email, email_confirm: false }),
        );
        users.push({ id: created.user.id });
        const client = reader();
        must(
          await client.auth.signInWithOtp({
            email,
            options: { shouldCreateUser: false },
          }),
        );
        const code = await localOtp(email);
        const wrong = code === "000000" ? "111111" : "000000";
        assert.ok(
          (await client.auth.verifyOtp({ email, token: wrong, type: "email" }))
            .error,
        );
        const verified = must(
          await client.auth.verifyOtp({ email, token: code, type: "email" }),
        );
        assert.equal(verified.user.id, created.user.id);
        assert.ok(
          (await reader().auth.verifyOtp({ email, token: code, type: "email" }))
            .error,
        );
      },
    );
    await t.test(
      "anonymous, wrong origin and client-side RPC calls cannot create or consume proof",
      async () => {
        assert.ok((await request(null, { action: "status" })).status >= 400);
        assert.equal(
          (await request(a, { action: "status" }, "https://attacker.invalid"))
            .status,
          403,
        );
        assert.ok(
          (
            await a.client.rpc("wallet_status", {
              p_user: a.id,
              p_session: randomUUID(),
            })
          ).error,
        );
        assert.ok(
          (
            await a.client.rpc("wallet_challenge_consume", {
              p_user: a.id,
              p_session: randomUUID(),
              p_id: randomUUID(),
              p_origin: origin,
              p_secret_hash: "0".repeat(64),
            })
          ).error,
        );
        assert.equal(
          (
            await request(a, {
              action: "challenge",
              address: wallet.address,
              chainId: 1,
            })
          ).status,
          400,
        );
      },
    );
    await t.test(
      "wrong signer, user, origin and browser secret fail; signed terms cannot be changed",
      async () => {
        const c = await challenge();
        const valid = await proof(c);
        assert.equal((await request(b, valid)).status, 403);
        assert.equal(
          (await request(a, { ...valid, secret: "0".repeat(64) })).status,
          403,
        );
        assert.equal(
          (await request(a, valid, "http://localhost:5173")).status,
          403,
        );
        assert.equal((await request(a, await proof(c, other))).status, 403);
        const changed = {
          ...c.typedData,
          domain: { ...c.typedData.domain, chainId: 1 },
        };
        assert.equal(
          (
            await request(a, {
              ...valid,
              signature: await wallet.signTypedData(changed),
            })
          ).status,
          403,
        );
        const wrongPurpose = {
          ...c.typedData,
          message: { ...c.typedData.message, purpose: "Different purpose" },
        };
        assert.equal(
          (
            await request(a, {
              ...valid,
              signature: await wallet.signTypedData(wrongPurpose),
            })
          ).status,
          403,
        );
      },
    );
    await t.test(
      "concurrent valid redemption binds once and replay fails",
      async () => {
        const c = await challenge(),
          body = await proof(c);
        const results = await Promise.all([request(a, body), request(a, body)]);
        assert.deepEqual(results.map((r) => r.status).sort(), [200, 403]);
        assert.equal((await request(a, body)).status, 403);
        const status = await request(a, { action: "status" });
        assert.equal(status.body.address, wallet.address.toLowerCase());
        assert.equal(status.body.session_verified, true);
        assert.equal(
          (
            await request(b, {
              action: "challenge",
              address: wallet.address,
              chainId: 137,
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await request(a, {
              action: "challenge",
              address: other.address,
              chainId: 137,
            })
          ).status,
          403,
        );
      },
    );
    await t.test(
      "different Auth session cannot redeem challenge or inherit session proof",
      async () => {
        const c = await challenge(),
          body = await proof(c);
        const info = must(await server.auth.admin.getUserById(a.id));
        const link = must(
          await server.auth.admin.generateLink({
            type: "magiclink",
            email: info.user.email,
          }),
        );
        const signed = must(
          await reader().auth.verifyOtp({
            token_hash: link.properties.hashed_token,
            type: "email",
          }),
        );
        const second = { token: signed.session.access_token };
        assert.equal(
          (await request(second, { action: "status" })).body.session_verified,
          false,
        );
        assert.equal((await request(second, body)).status, 403);
      },
    );
    await t.test(
      "expiry denies before cleanup and invalidation cancels outstanding challenges",
      async () => {
        const c = await challenge();
        assert.match(c.challenge.id, /^[0-9a-f-]{36}$/);
        sql(
          `update private.wallet_challenges set expires_at=clock_timestamp()-interval '1 second' where id='${c.challenge.id}'`,
        );
        assert.equal((await request(a, await proof(c))).status, 403);
        const next = await challenge();
        assert.equal((await request(a, { action: "invalidate" })).status, 200);
        assert.equal((await request(a, await proof(next))).status, 403);
        assert.equal(
          (await request(a, { action: "status" })).body.session_verified,
          false,
        );
      },
    );
    await t.test(
      "password-only sessions cannot bypass the approved email OTP flow",
      async () => {
        const password = randomUUID() + randomUUID();
        const info = must(
          await server.auth.admin.createUser({email:`password-${randomUUID()}@example.invalid`,password,email_confirm:true}),
        );
        users.push({id:info.user.id});
        const login = must(
          await reader().auth.signInWithPassword({
            email: info.user.email,
            password,
          }),
        );
        assert.equal(
          (
            await request(
              { token: login.session.access_token },
              { action: "status" },
            )
          ).status,
          401,
        );
      },
    );
    await t.test(
      "editable metadata does not create a wallet proof or association",
      async () => {
        must(
          await b.client.auth.updateUser({
            data: { wallet_address: wallet.address, wallet_verified: true },
          }),
        );
        const r = await request(b, { action: "status" });
        assert.equal(r.body.address, null);
        assert.equal(r.body.session_verified, false);
      },
    );
    await t.test("challenge issuance is rate limited across tabs", async () => {
      let result;
      for (let n = 0; n < 11; n++) {
        result = await request(b, {
          action: "challenge",
          address: other.address,
          chainId: 137,
        });
        if (result.status === 429) break;
        assert.equal(result.status, 200);
      }
      assert.equal(result.status, 429);
    });
  } finally {
    for (const user of users) must(await server.auth.admin.deleteUser(user.id));
  }
});
