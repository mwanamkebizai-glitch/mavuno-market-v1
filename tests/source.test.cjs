const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let ts;
try { ts = require('typescript'); }
catch {
  try { ts = require(require.resolve('typescript', { paths: [path.resolve(__dirname, '..')] })); }
  catch {
    throw new Error('TypeScript is not installed in this checkout. Run "npm install" from the repo root before executing the validation suite.');
  }
}
const root = path.resolve(__dirname, '..');
function files(dir) { return fs.readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?files(path.join(dir,x.name)):[path.join(dir,x.name)]); }

test('all application TypeScript and TSX files parse', () => {
  const sources = [...files(path.join(root,'app')),...files(path.join(root,'components')),...files(path.join(root,'lib'))]
    .filter(f=>/\.(ts|tsx)$/.test(f));
  assert.ok(sources.length > 0);
  const errors=[];
  for (const file of sources) {
    const source=fs.readFileSync(file,'utf8');
    const result=ts.transpileModule(source,{fileName:file,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.Preserve,target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}});
    for (const d of result.diagnostics||[]) if(d.category===ts.DiagnosticCategory.Error) errors.push(`${path.relative(root,file)}: ${ts.flattenDiagnosticMessageText(d.messageText,' ')}`);
  }
  assert.deepEqual(errors,[]);
});

test('database migration contains atomic checkout and server-side guards', () => {
  const sql=fs.readFileSync(path.join(root,'supabase/migrations/202611130001_secure_workflows.sql'),'utf8');
  for (const token of ['function public.checkout_cart','for update','function public.seller_update_order','function public.report_direct_payment','function public.confirm_direct_payment','function public.adjust_inventory','function public.admin_review_verification','function public.admin_moderate_product','revoke insert,update,delete on public.orders']) assert.ok(sql.toLowerCase().includes(token.toLowerCase()),`Missing SQL guard: ${token}`);
  assert.match(sql,/revoke all on function public\.notify_user[\s\S]*from public, anon, authenticated/i);
});

test('checkout implementation never trusts client-supplied prices or seller IDs', () => {
  const sql=fs.readFileSync(path.join(root,'supabase/migrations/202611130001_secure_workflows.sql'),'utf8');
  const start=sql.indexOf('create or replace function public.checkout_cart');
  const end=sql.indexOf('revoke all on function public.checkout_cart',start);
  const fn=sql.slice(start,end);
  assert.match(fn,/select \* into v_product from public\.products[\s\S]*for update/i);
  assert.match(fn,/v_total := round\(v_product\.price\*v_qty,2\)/i);
  assert.match(fn,/v_product\.quantity < v_qty/i);
  assert.match(fn,/insert into public\.orders\(buyer_id,seller_id,product_id,quantity,unit_price,total_amount/i);
});


test('client checkout uses the protected database RPC and payment rules stay manual', () => {
  const cart=fs.readFileSync(path.join(root,'app/cart/page.tsx'),'utf8');
  const order=fs.readFileSync(path.join(root,'app/orders/[id]/page.tsx'),'utf8');
  const sql=fs.readFileSync(path.join(root,'supabase/migrations/202611130001_secure_workflows.sql'),'utf8');
  const readme=fs.readFileSync(path.join(root,'README.md'),'utf8');
  assert.match(cart,/rpc\("checkout_cart"/);
  assert.match(order,/rpc\("report_direct_payment"/);
  assert.match(order,/rpc\("confirm_direct_payment"/);
  assert.match(order,/rpc\("request_refund"/);
  assert.match(sql,/create or replace function public\.request_refund/);
  assert.match(readme,/no payment gateway/i);
  assert.doesNotMatch(order,/M-Pesa|m_pesa|Mpesa/i);
  assert.doesNotMatch(order,/from\("refund_records"\)\.insert/);
  assert.doesNotMatch(cart,/from\("orders"\)\.insert/);
});

test('seller updates cannot override administrator product moderation', () => {
  const schema=fs.readFileSync(path.join(root,'supabase/schema.sql'),'utf8');
  const migration=fs.readFileSync(path.join(root,'supabase/migrations/202611130001_secure_workflows.sql'),'utf8');
  const policy=/create policy "product seller update" on public\.products for update[\s\S]*?using\(auth\.uid\(\)=seller_id and status not in \('paused','removed'\)\)[\s\S]*?with check\(auth\.uid\(\)=seller_id and status not in \('paused','removed'\)\)/i;
  assert.match(schema,policy);
  assert.match(migration,/drop policy if exists "product seller update" on public\.products/i);
  assert.match(migration,policy);
});

test('Data API grants remain explicit and protected records are RPC-only', () => {
  const sql=fs.readFileSync(path.join(root,'supabase/migrations/202611130001_secure_workflows.sql'),'utf8');
  assert.match(sql,/revoke all privileges on table[\s\S]*?from anon, authenticated/i);
  assert.match(sql,/grant select on public\.products, public\.reviews to anon/i);
  assert.match(sql,/grant update\(read_at\) on public\.notifications to authenticated/i);
  assert.match(sql,/revoke insert,update,delete on public\.reversal_reports from authenticated/i);
  assert.match(sql,/revoke insert,update,delete on public\.refund_records from authenticated/i);
  assert.match(sql,/grant select on[\s\S]*public\.reversal_reports,[\s\S]*public\.refund_records[\s\S]*to authenticated/i);
});
