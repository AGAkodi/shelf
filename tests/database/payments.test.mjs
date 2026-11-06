import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { localClients, sql } from "../../scripts/lib/local-supabase.mjs";
const book = "20000000-0000-4000-8000-000000000001";
const sender = "0x1111111111111111111111111111111111111111";
const recipient = "0x46a32bbb4cf751dfeea222e1ced2813f229d1fd5";
test("production payment atomicity, isolation, replay and dispatch", async (t) => {
  const { server, reader, url, anonKey } = localClients();
  const users = [];
  const must = (r) => {
    assert.equal(r.error, null, r.error?.message);
    return r.data;
  };
  try {
    for (let i = 0; i < 2; i++) {
      const email = `payment-${randomUUID()}@example.invalid`;
      const user =
        must(await server.auth.admin.createUser({ email, email_confirm: true }))
          .user;
      const link = must(
        await server.auth.admin.generateLink({ type: "magiclink", email }),
      );
      const client = reader();
      const session = must(
        await client.auth.verifyOtp({
          token_hash: link.properties.hashed_token,
          type: "email",
        }),
      ).session;
      users.push({
        id: user.id,
        client,
        token: session.access_token,
        session: JSON.parse(
          Buffer.from(session.access_token.split(".")[1], "base64url"),
        ).session_id,
      });
    }
    const [a, b] = users;
    // Privileged fixture only: the actual signature gate is exercised by test:wallet.
    sql(
      `insert into private.verified_wallets(user_id,address) values('${a.id}','${sender}'); insert into private.wallet_session_proofs(session_id,user_id) values('${a.session}','${a.id}');`,
    );
    const plans = must(
      await server.from("borrowing_plans").select("id").eq("book_id", book).eq(
        "enabled",
        true,
      ),
    );
    const args = {
      p_user: a.id,
      p_session: a.session,
      p_book: book,
      p_plan: plans[0].id,
      p_key: randomUUID(),
      p_recipient: recipient,
      p_block: 100,
    };
    let state;
    const request = async (user, body, endpoint = "payments") => {
      const response = await fetch(`${url}/functions/v1/${endpoint}`, {
        method: "POST",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${user.token}`,
          Origin: "http://127.0.0.1:5173",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      return { status: response.status, headers: response.headers, body: await response.json() };
    };
    await t.test("unverified users and direct client calls cannot checkout", async () => {
      assert.ok(
        (await server.rpc("payment_checkout", {
          ...args,
          p_user: b.id,
          p_session: b.session,
        })).error,
      );
      assert.ok((await a.client.rpc("payment_checkout", args)).error);
    });
    await t.test("concurrent creation makes exactly one immutable quote", async () => {
      const results = await Promise.all([
        server.rpc("payment_checkout", args),
        server.rpc("payment_checkout", { ...args, p_key: randomUUID() }),
      ]);
      state = must(results[0]);
      assert.equal(must(results[1]).payment.id, state.payment.id);
      assert.equal(state.payment.expected_sender, sender);
      assert.equal(state.loan.status, "pending_payment");
      assert.ok(
        (await b.client.from("payments").select("*").eq("id", state.payment.id))
          .data.length === 0,
      );
    });
    await t.test("frontend success and fake hash cannot unlock content; production simulation is disabled", async () => {
      assert.notEqual(
        (await request(a, { action: "complete", paymentId: state.payment.id }))
          .status,
        200,
      );
      assert.equal(
        (await request(
          a,
          { action: "complete", paymentId: state.payment.id },
          "shelf-api",
        )).status,
        403,
      );
      assert.equal(
        (await request(b, { action: "status", paymentId: state.payment.id }))
          .status,
        409,
      );
      const result = await request(a, {
        action: "verify",
        paymentId: state.payment.id,
        hash: "0x" + "00".repeat(32),
      });
      assert.ok([200, 409].includes(result.status));
      assert.equal(
        must(
          await server.rpc("payment_state", {
            p_user: a.id,
            p_payment: state.payment.id,
          }),
        ).loan.status,
        "pending_payment",
      );
      assert.notEqual(
        (await request(a, {
          action: "read",
          loanId: state.loan.id,
          bookId: book,
          chapter: 1,
        }, "shelf-api")).status,
        200,
      );
      sql(
        `update private.payment_dispatch set candidate_hash=null,prompted=false where payment_id='${state.payment.id}';`,
      );
    });
    const dispatch = (action) =>
      server.rpc("payment_dispatch", {
        p_user: a.id,
        p_session: a.session,
        p_payment: state.payment.id,
        p_action: action,
      });
    await t.test("only one tab obtains a payment prompt; unknown outcome cannot cancel", async () => {
      const r = await Promise.all([dispatch("claim"), dispatch("claim")]);
      assert.equal(r.filter((x) => !x.error).length, 1);
      const resume = (planId) => request(a, { action: "checkout", bookId: book, planId, key: randomUUID() });
      const restored = await resume(args.p_plan);
      assert.equal(restored.status, 200);
      assert.equal(restored.body.payment.id, state.payment.id);
      assert.equal(restored.body.prompted, true);
      const conflict = await resume(randomUUID());
      assert.equal(conflict.body.error, "OPEN_CHECKOUT");
      assert.ok((await dispatch("cancel")).error);
    });
    const hash = `0x${randomUUID().replaceAll("-", "").repeat(2)}`;
    const evidence = {
      p_user: a.id,
      p_payment: state.payment.id,
      p_hash: hash,
      p_block: 101,
      p_block_hash: `0x${"bb".repeat(32)}`,
      p_block_time: new Date().toISOString(),
      p_finalized: 102,
    };
    await t.test("unauthorized, prequote and unfinalized activation denied", async () => {
      assert.ok((await a.client.rpc("payment_finalize", evidence)).error);
      assert.ok(
        (await server.rpc("payment_finalize", { ...evidence, p_user: b.id }))
          .error,
      );
      assert.ok(
        (await server.rpc("payment_finalize", { ...evidence, p_block: 100 }))
          .error,
      );
      assert.ok(
        (await server.rpc("payment_finalize", {
          ...evidence,
          p_finalized: 100,
        })).error,
      );
      assert.equal(
        must(
          await server.rpc("payment_state", {
            p_user: a.id,
            p_payment: state.payment.id,
          }),
        ).loan.status,
        "pending_payment",
      );
    });
    let confirmed;
    await t.test("concurrent verified finalization activates exactly once; retry never extends expiry", async () => {
      const results = await Promise.all([
        server.rpc("payment_finalize", evidence),
        server.rpc("payment_finalize", evidence),
      ]);
      confirmed = must(results[0]);
      assert.equal(confirmed.payment.status, "confirmed");
      assert.equal(confirmed.loan.status, "active");
      assert.equal(must(results[1]).loan.expires_at, confirmed.loan.expires_at);
      assert.equal(
        Number(confirmed.payment.contributor_share) +
          Number(confirmed.payment.platform_share),
        Number(confirmed.payment.gross_amount),
      );
    });
    await t.test("verified owner reads protected content; another user cannot", async () => {
      const body = {
        action: "read",
        loanId: confirmed.loan.id,
        bookId: book,
        chapter: 1,
      };
      const allowed = await request(a, body, "shelf-api");
      assert.equal(allowed.status, 200);
      assert.match(allowed.headers.get("cache-control"), /no-store/);
      assert.equal(allowed.body.object_path, undefined);
      assert.equal((await request(b, body, "shelf-api")).status, 403);
      assert.equal((await request(a, {...body, bookId:randomUUID()}, "shelf-api")).status, 403);
    });
    await t.test("same transaction cannot activate a second loan", async () => {
      must(
        await server.rpc("return_loan", {
          p_user: a.id,
          p_loan: confirmed.loan.id,
        }),
      );
      const next = must(
        await server.rpc("payment_checkout", { ...args, p_key: randomUUID() }),
      );
      assert.ok(
        (await server.rpc("payment_finalize", {
          ...evidence,
          p_payment: next.payment.id,
          p_block_time: new Date().toISOString(),
        })).error,
      );
      assert.equal(
        must(
          await server.rpc("payment_state", {
            p_user: a.id,
            p_payment: next.payment.id,
          }),
        ).loan.status,
        "pending_payment",
      );
    });
    await t.test("finalized failure cancels only its pending loan and cannot activate it", async () => {
      const next = must(await server.rpc("payment_checkout", {...args,p_key:randomUUID()}));
      const failed = must(await server.rpc("payment_fail", {...evidence,p_payment:next.payment.id,p_hash:"0x"+"cd".repeat(32),p_block_time:next.payment.created_at}));
      assert.equal(failed.payment.status,"failed");
      assert.equal(failed.loan.status,"cancelled");
      assert.ok((await server.rpc("payment_finalize",{...evidence,p_payment:next.payment.id,p_hash:"0x"+"cd".repeat(32),p_block_time:new Date().toISOString()})).error);
      assert.ok((await a.client.rpc("payment_queue")).error);
      const denied = await request(a,{action:"read",loanId:confirmed.loan.id,bookId:book,chapter:1},"shelf-api");
      assert.notEqual(denied.status,200);
    });
    await t.test("expired paid loan denies the original chapter request before library reconciliation", async () => {
      const quote = must(await server.rpc("payment_checkout", {...args, p_key:randomUUID()}));
      const paid = must(await server.rpc("payment_finalize", {...evidence, p_payment:quote.payment.id,
        p_hash:"0x"+"ef".repeat(32), p_block_time:quote.payment.created_at}));
      const body = {action:"read", loanId:paid.loan.id, bookId:book, chapter:1};
      assert.equal((await request(a,body,"shelf-api")).status,200);
      // Local fixture only. Move this loan's complete term into the past.
      sql(`begin; alter table public.loans disable trigger loan_terms;
        update public.loans set created_at=created_at-interval '20 days',
          started_at=started_at-interval '20 days', expires_at=expires_at-interval '20 days'
          where id='${paid.loan.id}';
        alter table public.payments disable trigger payment_terms;
        update public.payments set created_at=created_at-interval '20 days',
          submitted_at=submitted_at-interval '20 days', verified_at=verified_at-interval '20 days',
          last_checked_at=last_checked_at-interval '20 days', block_timestamp=block_timestamp-interval '20 days'
          where id='${paid.payment.id}';
        set constraints all immediate; alter table public.loans enable trigger loan_terms;
        alter table public.payments enable trigger payment_terms; commit;`);
      const replay = await request(a,body,"shelf-api");
      assert.equal(replay.status,403);
      assert.equal(replay.body.paragraphs,undefined);
      const history = await request(a,{action:"library"},"shelf-api");
      assert.equal(history.body.loans.find(loan => loan.id === paid.loan.id).status,"expired");
    });
  } finally {
    // Fixture cleanup in fixed local DB only; retained financial history is never deleted by app APIs.
    for (const u of users) {
      sql(
        `begin; alter table public.payments disable trigger user; alter table public.loans disable trigger user; delete from private.payment_dispatch where payment_id in(select id from public.payments where user_id='${u.id}'); delete from public.payments where user_id='${u.id}'; delete from public.loans where user_id='${u.id}'; alter table public.payments enable trigger user; alter table public.loans enable trigger user; commit;`,
      );
      await server.auth.admin.deleteUser(u.id);
    }
  }
});
