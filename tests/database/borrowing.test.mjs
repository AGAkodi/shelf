import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { localClients, sql } from "../../scripts/lib/local-supabase.mjs";
import { createHandler } from "../../supabase/functions/_shared/handler.js";
const book = "20000000-0000-4000-8000-000000000001",
  plan = "30000000-0000-4000-8000-000000000002";
test("real Edge Function borrowing lifecycle and adversarial access", async (t) => {
  const { server, reader, url, anonKey } = localClients(),
    users = [];
  const must = (result) => {
    assert.equal(result.error, null, result.error?.message);
    return result.data;
  };
  const request = async (user, body) => {
    const response = await fetch(`${url}/functions/v1/shelf-api`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        "Content-Type": "application/json",
        ...(user ? { Authorization: `Bearer ${user.token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    return {
      status: response.status,
      body: await response.json(),
      headers: response.headers,
    };
  };
  try {
    for (let n = 0; n < 2; n++) {
      const email = `borrow-${randomUUID()}@example.invalid`,
        password = randomBytes(32).toString("base64url");
      const created = must(
        await server.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        }),
      );
      const client = reader();
      const auth = must(
        await client.auth.signInWithPassword({ email, password }),
      );
      users.push({
        id: created.user.id,
        client,
        token: auth.session.access_token,
      });
    }
    const [a, b] = users;
    let quote, active;
    await t.test(
      "unauthenticated requests and client RPC activation fail",
      async () => {
        assert.ok((await request(null, { action: "library" })).status >= 400);
        assert.ok(
          (
            await a.client.rpc("dev_complete", {
              p_user: a.id,
              p_payment: randomUUID(),
            })
          ).error,
        );
        assert.ok(
          (
            await a.client.rpc("authorize_chapter", {
              p_user: a.id,
              p_loan: randomUUID(),
              p_book: book,
              p_chapter: 1,
            })
          ).error,
        );
      },
    );
    await t.test(
      "server quotes immutable terms; concurrent checkouts create one loan",
      async () => {
        const key = randomUUID();
        const results = await Promise.all([
          request(a, {
            action: "checkout",
            bookId: book,
            planId: plan,
            key,
            amount: 1,
            userId: b.id,
          }),
          request(a, { action: "checkout", bookId: book, planId: plan, key }),
        ]);
        for (const result of results)
          assert.equal(result.status, 200, JSON.stringify(result.body));
        quote = results[0].body;
        assert.equal(quote.loan.id, results[1].body.loan.id);
        assert.equal(quote.payment.gross_amount, 2000000);
        assert.equal(quote.loan.user_id, a.id);
        assert.equal(quote.loan.status, "pending_payment");
        assert.equal(quote.payment.environment, "development");
        assert.equal(quote.payment.tx_hash, null);
        assert.equal(quote.payment.recipient, null);
        assert.equal(
          (
            await request(a, {
              action: "checkout",
              bookId: book,
              planId: "30000000-0000-4000-8000-000000000001",
              key,
            })
          ).status,
          409,
        );
      },
    );
    await t.test(
      "unpaid, missing, wrong-user and wrong-book access denied",
      async () => {
        assert.equal(
          (
            await request(a, {
              action: "read",
              loanId: quote.loan.id,
              bookId: book,
              chapter: 1,
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await request(a, {
              action: "read",
              loanId: randomUUID(),
              bookId: book,
              chapter: 1,
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await request(b, {
              action: "complete",
              paymentId: quote.payment.id,
            })
          ).status,
          403,
        );
      },
    );
    await t.test(
      "concurrent development completions activate exactly once",
      async () => {
        const results = await Promise.all([
          request(a, { action: "complete", paymentId: quote.payment.id }),
          request(a, { action: "complete", paymentId: quote.payment.id }),
        ]);
        for (const result of results)
          assert.equal(result.status, 200, JSON.stringify(result.body));
        active = results[0].body;
        assert.equal(active.loan.started_at, results[1].body.loan.started_at);
        assert.equal(active.loan.expires_at, results[1].body.loan.expires_at);
        assert.equal(
          Date.parse(active.loan.expires_at) -
            Date.parse(active.loan.started_at),
          7 * 86400000,
        );
        assert.equal(active.payment.status, "confirmed");
        assert.equal(active.payment.tx_hash, null);
      },
    );
    await t.test(
      "active owner reads actual private chapter; paths and bearer URLs never returned",
      async () => {
        const result = await request(a, {
          action: "read",
          loanId: active.loan.id,
          bookId: book,
          chapter: 1,
        });
        assert.equal(result.status, 200, JSON.stringify(result.body));
        assert.ok(result.body.paragraphs[0].startsWith("Mara opened"));
        assert.equal(result.headers.get("cache-control"), "private, no-store");
        assert.equal(result.body.object_path, undefined);
        assert.equal(result.body.signedUrl, undefined);
        assert.equal(
          (
            await request(b, {
              action: "read",
              loanId: active.loan.id,
              bookId: book,
              chapter: 1,
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await request(a, {
              action: "read",
              loanId: active.loan.id,
              bookId: "20000000-0000-4000-8000-000000000002",
              chapter: 1,
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await request(a, {
              action: "read",
              loanId: active.loan.id,
              bookId: book,
              chapter: 99,
            })
          ).status,
          403,
        );
        assert.ok(
          (
            await a.client.storage
              .from("protected-books")
              .download("quiet-orbit/chapter-1.json")
          ).error,
        );
        assert.ok(
          (
            await a.client.storage
              .from("protected-books")
              .createSignedUrl("quiet-orbit/chapter-1.json", 60)
          ).error,
        );
      },
    );
    await t.test(
      "return immediately denies repeated content request and retains history",
      async () => {
        assert.equal(
          (await request(b, { action: "return", loanId: active.loan.id }))
            .status,
          403,
        );
        assert.equal(
          (await request(a, { action: "return", loanId: active.loan.id }))
            .status,
          200,
        );
        assert.equal(
          (await request(a, { action: "return", loanId: active.loan.id }))
            .status,
          200,
        );
        assert.equal(
          (
            await request(a, {
              action: "read",
              loanId: active.loan.id,
              bookId: book,
              chapter: 1,
            })
          ).status,
          403,
        );
        const state = await request(a, { action: "library" });
        assert.equal(state.body.loans[0].status, "returned");
        assert.equal(state.body.payments[0].status, "confirmed");
      },
    );
    await t.test(
      "borrow again; expiry denies before any cleanup job",
      async () => {
        const next = await request(a, {
          action: "checkout",
          bookId: book,
          planId: plan,
          key: randomUUID(),
        });
        assert.equal(next.status, 200);
        const paid = await request(a, {
          action: "complete",
          paymentId: next.body.payment.id,
        });
        assert.equal(paid.status, 200);
        const id = paid.body.loan.id;
        assert.match(id, /^[0-9a-f-]{36}$/);
        // Test-fixture time travel, privileged local SQL only. No deployed clock override or expiry endpoint.
        sql(`begin; alter table public.loans disable trigger loan_terms; alter table public.payments disable trigger payment_terms;
    update public.loans set created_at=created_at-interval '8 days',started_at=started_at-interval '8 days',expires_at=expires_at-interval '8 days' where id='${id}';
    update public.payments set created_at=created_at-interval '8 days',submitted_at=submitted_at-interval '8 days',last_checked_at=last_checked_at-interval '8 days',verified_at=verified_at-interval '8 days' where loan_id='${id}';
    set constraints all immediate; alter table public.loans enable trigger loan_terms; alter table public.payments enable trigger payment_terms; commit;`);
        assert.equal(
          must(
            await server.from("loans").select("status").eq("id", id).single(),
          ).status,
          "active",
        );
        assert.equal(
          (
            await request(a, {
              action: "read",
              loanId: id,
              bookId: book,
              chapter: 1,
            })
          ).status,
          403,
        );
        const state = await request(a, { action: "library" });
        assert.equal(
          state.body.loans.find((l) => l.id === id).status,
          "expired",
        );
      },
    );
    await t.test(
      "cancel pending checkout without activating; unsupported plans rejected",
      async () => {
        const next = await request(a, {
          action: "checkout",
          bookId: book,
          planId: plan,
          key: randomUUID(),
        });
        assert.equal(next.status, 200);
        assert.equal(
          (
            await request(a, {
              action: "cancel",
              paymentId: next.body.payment.id,
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await request(a, {
              action: "complete",
              paymentId: next.body.payment.id,
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await request(a, {
              action: "checkout",
              bookId: book,
              planId: randomUUID(),
              key: randomUUID(),
            })
          ).status,
          409,
        );
      },
    );
    await t.test(
      "disabled adapter cannot complete development or production payments",
      async () => {
        const disabled = createHandler({ server, development: false });
        const response = await disabled(
          new Request("http://test.invalid", {
            method: "POST",
            headers: { Authorization: `Bearer ${a.token}` },
            body: JSON.stringify({
              action: "complete",
              paymentId: quote.payment.id,
            }),
          }),
        );
        assert.equal(response.status, 403);
        const response2 = await request(a, {
          action: "read",
          loanId: "../../private",
          bookId: book,
          chapter: 1,
        });
        assert.equal(response2.status, 400);
      },
    );
  } finally {
    if (users.length) {
      const ids = users.map((u) => `'${u.id}'`).join(",");
      sql(
        `begin; alter table public.payments disable trigger retain_payment; alter table public.loans disable trigger retain_loan; delete from public.payments where user_id in (${ids}); delete from public.loans where user_id in (${ids}); alter table public.payments enable trigger retain_payment; alter table public.loans enable trigger retain_loan; commit;`,
      );
      for (const u of users) must(await server.auth.admin.deleteUser(u.id));
    }
  }
});
