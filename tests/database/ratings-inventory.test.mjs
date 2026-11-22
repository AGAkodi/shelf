import {test} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {localClients,sql} from "../../scripts/lib/local-supabase.mjs";
test("copy reservations and verified borrower ratings",async t=>{
 const {server,reader,anon}=localClients(), users=[];
 const must=r=>{assert.equal(r.error,null,r.error?.message);return r.data};
 let book;
 try{
  for(let i=0;i<2;i++){
   const email=`ratings-${randomUUID()}@example.invalid`;
   const u=must(await server.auth.admin.createUser({email,email_confirm:true})).user;
   const link=must(await server.auth.admin.generateLink({type:"magiclink",email}));
   const client=reader(),session=must(await client.auth.verifyOtp({token_hash:link.properties.hashed_token,type:"email"})).session;
   const sessionId=JSON.parse(Buffer.from(session.access_token.split(".")[1],"base64url")).session_id;
   users.push({id:u.id,client,session:sessionId});
   sql(`insert into private.verified_wallets(user_id,address) values('${u.id}','0x${(i+7).toString().repeat(40)}');insert into private.wallet_session_proofs(session_id,user_id)values('${sessionId}','${u.id}');`);
  }
  book=must(await server.from("books").insert({title:"Capacity fixture",author:"Test",description:"",category:"Test",lending_copies:1}).select("id").single());
  must(await server.from("book_licenses").insert({book_id:book.id,rights_holder:"Fixture",rights_evidence:"Fixture",distribution_permitted:true,reviewed_at:new Date().toISOString()}));
  must(await server.from("book_assets").insert({book_id:book.id,object_path:`test/${randomUUID()}.json`,chapter_number:1,byte_size:10,sha256:"a".repeat(64)}));
  const plan=must(await server.from("borrowing_plans").insert({book_id:book.id,duration_days:3,price_units:1000000,enabled:true}).select("id").single());
  must(await server.from("books").update({status:"published"}).eq("id",book.id));
  const quote=user=>server.rpc("payment_checkout",{p_user:user.id,p_session:user.session,p_book:book.id,p_plan:plan.id,p_key:randomUUID(),p_recipient:"0x"+"1".repeat(40),p_block:100});
  const stats=async()=>must(await anon.rpc("book_statistics",{p_books:[book.id]}))[0];
  const rate=(user,stars)=>user.client.from("book_ratings").insert({user_id:user.id,book_id:book.id,stars});
  let winner,other,state;
  await t.test("concurrent readers cannot reserve the last copy twice",async()=>{
   const results=await Promise.all(users.map(quote));
   assert.equal(results.filter(r=>!r.error).length,1);
   const index=results.findIndex(r=>!r.error);winner=users[index];other=users[1-index];state=must(results[index]);
   assert.equal((await stats()).available,0);assert.equal((await stats()).reserved,1);
   assert.ok((await server.from("books").update({lending_copies:0}).eq("id",book.id)).error);
  });
  await t.test("pending and unrelated readers cannot rate or change stock",async()=>{
   assert.ok((await rate(winner,5)).error);assert.ok((await rate(other,4)).error);
   assert.equal(must(await other.client.from("books").update({lending_copies:99}).eq("id",book.id).select()).length,0);
  });
  await t.test("verified borrower rates once and can edit after return",async()=>{
   must(await server.rpc("payment_finalize",{p_user:winner.id,p_payment:state.payment.id,p_hash:"0x"+randomUUID().replaceAll("-","").repeat(2),
    p_block:101,p_block_hash:"0x"+"b".repeat(64),p_block_time:state.payment.created_at,p_finalized:102}));
   must(await rate(winner,5));assert.ok((await rate(winner,3)).error);
   assert.ok((await winner.client.from("book_ratings").update({stars:6}).eq("book_id",book.id)).error);
   assert.equal(must(await other.client.from("book_ratings").select()).length,0);
   assert.equal((await stats()).average_rating,5);assert.equal((await stats()).times_borrowed,1);
   must(await server.rpc("return_loan",{p_user:winner.id,p_loan:state.loan.id}));
   must(await winner.client.from("book_ratings").update({stars:4}).eq("book_id",book.id));
   assert.equal((await stats()).average_rating,4);assert.equal((await stats()).rating_count,1);assert.equal((await stats()).available,1);
  });
  await t.test("cancellation releases reservations and zero copies blocks new borrowing",async()=>{
   const next=must(await quote(other));
   must(await server.rpc("payment_dispatch",{p_user:other.id,p_session:other.session,p_payment:next.payment.id,p_action:"cancel"}));
   must(await server.from("books").update({lending_copies:0}).eq("id",book.id));
   assert.ok((await quote(other)).error);assert.equal((await stats()).available,0);
  });
 }finally{
  if(book){
   sql(`begin; alter table public.payments disable trigger user; alter table public.loans disable trigger user;
    delete from private.payment_dispatch where payment_id in(select id from public.payments where loan_id in(select id from public.loans where book_id='${book.id}'));
    delete from public.book_ratings where book_id='${book.id}';
    delete from public.payments where loan_id in(select id from public.loans where book_id='${book.id}');delete from public.loans where book_id='${book.id}';
    alter table public.payments enable trigger user;alter table public.loans enable trigger user;commit;`);
   for(const table of ["borrowing_plans","book_assets","book_licenses"])must(await server.from(table).delete().eq("book_id",book.id));
   must(await server.from("books").delete().eq("id",book.id));
  }
  for(const user of users)must(await server.auth.admin.deleteUser(user.id));
 }
});
