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
function loadTypeScriptModule(file) {
  const source=fs.readFileSync(path.join(root,file),'utf8');
  const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
  const module={exports:{}};
  new Function('module','exports',output)(module,module.exports);
  return module.exports;
}

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
  const start=migration.indexOf('create or replace function public.seller_update_order');
  const end=migration.indexOf('revoke all on function public.seller_update_order',start);
  const sellerUpdate=migration.slice(start,end);
  assert.match(sellerUpdate,/status=case when status in \('paused','removed'\) then status else 'active'::public\.product_status end/i);
  assert.match(schema,/create trigger protect_product_moderation_status before update of status on public\.products/i);
  assert.match(migration,/create trigger protect_product_moderation_status before update of status on public\.products/i);
  assert.match(migration,/new\.status is distinct from old\.status[\s\S]*old\.status in \('paused','removed'\)[\s\S]*new\.status in \('paused','removed'\)[\s\S]*not public\.is_admin\(\)/i);
  const productUpdateGrant=migration.match(/grant update\(([^)]+)\)\s+on public\.products to authenticated/i);
  assert.ok(productUpdateGrant);
  assert.doesNotMatch(productUpdateGrant[1],/\bstatus\b/i);
  assert.match(migration,/drop policy if exists "product seller delete" on public\.products/i);
  assert.doesNotMatch(migration,/grant select,\s*insert,\s*delete on public\.products to authenticated/i);
});

test('security-definer helpers and workflow RPCs have explicit execution grants', () => {
  const schema=fs.readFileSync(path.join(root,'supabase/schema.sql'),'utf8');
  const migration=fs.readFileSync(path.join(root,'supabase/migrations/202611130001_secure_workflows.sql'),'utf8');
  assert.match(schema,/revoke all on function public\.handle_new_user\(\) from public, anon, authenticated/i);
  assert.match(migration,/revoke all on function public\.is_admin\(\) from public, anon, authenticated[\s\S]*grant execute on function public\.is_admin\(\) to authenticated/i);
  const lowered=migration.toLowerCase();
  for(const name of ['protect_profile_privileges','on_order_created_notify','on_message_notify','on_review_notify','validate_product_seller_role','protect_product_moderation_status','validate_inventory_owner_role','validate_farm_and_inventory_links']){
    assert.ok(lowered.includes(`revoke all on function public.${name}() from public, anon, authenticated`),`Client EXECUTE privilege not revoked from ${name}`);
  }
  assert.match(migration,/revoke all on function public\.admin_moderate_product\(uuid,public\.product_status,text\) from public, anon, authenticated/i);
  assert.match(migration,/grant execute on function public\.admin_moderate_product\(uuid,public\.product_status,text\) to authenticated/i);
});

test('every migration policy can be safely recreated', () => {
  const sql=fs.readFileSync(path.join(root,'supabase/migrations/202611130001_secure_workflows.sql'),'utf8')
    .replace(/--[^\r\n]*/g,'');
  const statements=sql.split(';').map(statement=>statement.trim()).filter(Boolean);
  const policies=statements
    .map((statement,index)=>({statement,index}))
    .filter(({statement})=>/^create policy\b/i.test(statement));
  assert.ok(policies.length>0);
  for(const {statement,index} of policies){
    const policy=statement.match(/^create policy\s+"([^"]+)"\s+on\s+public\.([a-z_]+)/i);
    assert.ok(policy,`Could not parse policy statement: ${statement}`);
    const previous=statements[index-1];
    assert.equal(
      previous.toLowerCase(),
      `drop policy if exists "${policy[1].toLowerCase()}" on public.${policy[2].toLowerCase()}`,
      `Policy "${policy[1]}" must be dropped before it is recreated`
    );
  }
});

test('inventory controls are limited to eligible account roles', () => {
  const page=fs.readFileSync(path.join(root,'app/inventory/page.tsx'),'utf8');
  const component=fs.readFileSync(path.join(root,'components/InventoryManager.tsx'),'utf8');
  assert.match(page,/profile\?\.role === "farmer" \|\| profile\?\.role === "supplier"/);
  assert.match(page,/if \(!canManageInventory\)/);
  assert.match(page,/<InventoryManager canManageInventory \/>/);
  assert.match(component,/canManageInventory \?/);
  assert.match(component,/Inventory management is available to Farmer and Agri-Vet Supplier accounts/);
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

test('role-based PostgreSQL security tests use JWT claims and roll back fixtures', () => {
  const sql=fs.readFileSync(path.join(root,'supabase/tests/security_workflows.sql'),'utf8');
  for(const token of [
    'set local role authenticated',
    'request.jwt.claims',
    'mavuno.test.seller_a',
    'mavuno.test.seller_b',
    'mavuno.test.buyer_a',
    'mavuno.test.buyer_b',
    'mavuno.test.admin',
    'public.checkout_cart',
    'public.report_direct_payment',
    'public.confirm_direct_payment',
    'public.request_refund',
    'public.report_payment_reversal',
    'public.respond_payment_reversal',
    'public.admin_moderate_product',
    'public.admin_review_verification',
    'public.admin_resolve_refund',
    'public.adjust_inventory',
    'Cancellation preserves paused status',
    'Cancellation preserves removed status',
    'rollback;'
  ]) assert.ok(sql.toLowerCase().includes(token.toLowerCase()),`Missing PostgreSQL security scenario: ${token}`);
});

test('admin role remains owner-provisioned and browser clients use only public keys', () => {
  const schema=fs.readFileSync(path.join(root,'supabase/schema.sql'),'utf8');
  const clientFiles=[
    fs.readFileSync(path.join(root,'lib/supabase/client.ts'),'utf8'),
    fs.readFileSync(path.join(root,'lib/supabase/server.ts'),'utf8'),
    fs.readFileSync(path.join(root,'proxy.ts'),'utf8')
  ].join('\n');
  assert.match(schema,/if r='admin' then r := 'buyer_individual'/i);
  assert.match(clientFiles,/NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(clientFiles,/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  assert.doesNotMatch(clientFiles,/SUPABASE_SERVICE_ROLE_KEY|service_role/i);
});

test('role navigation separates Farmer, Supplier, Buyer, and Administrator links', () => {
  const {getDashboardKind,getRoleNavigation}=loadTypeScriptModule('lib/roles.ts');
  assert.equal(getDashboardKind('farmer'),'farmer');
  assert.equal(getDashboardKind('supplier'),'supplier');
  for(const role of ['buyer_individual','buyer_business','buyer_institution']) assert.equal(getDashboardKind(role),'buyer');
  assert.equal(getDashboardKind('admin'),'admin');
  assert.equal(getDashboardKind('unknown-role'),'unknown');

  const routes=(role)=>getRoleNavigation(role).map(link=>link.href);
  assert.ok(routes('farmer').includes('/farms#crops'));
  assert.ok(routes('farmer').includes('/farms#activities'));
  assert.ok(routes('farmer').includes('/farms#machinery'));
  assert.ok(routes('farmer').includes('/farms#workers'));
  assert.ok(routes('supplier').includes('/inventory#locations'));
  assert.ok(routes('supplier').includes('/inventory#movements'));
  assert.ok(routes('supplier').includes('/orders'));
  assert.ok(routes('buyer_individual').includes('/saved-products'));
  assert.ok(routes('buyer_individual').includes('/marketplace?category=farm_produce'));
  assert.ok(routes('buyer_business').includes('/marketplace?category=agri_vet'));
  assert.ok(routes('admin').includes('/admin'));
  for(const role of ['farmer','supplier','buyer_individual','buyer_business','buyer_institution']){
    assert.ok(!routes(role).includes('/admin'));
  }
  assert.deepEqual(routes('unknown-role'),[]);
});

test('dashboard selects the authenticated profile role and renders role-specific data', () => {
  const page=fs.readFileSync(path.join(root,'app/dashboard/page.tsx'),'utf8');
  const nav=fs.readFileSync(path.join(root,'components/Nav.tsx'),'utf8');
  assert.match(page,/supabase\.auth\.getUser\(\)/);
  assert.match(page,/\.eq\("id", user\.id\)/);
  assert.match(page,/getDashboardKind\(profile\.role\)/);
  for(const kind of ['farmer','supplier','buyer','admin','unknown']) assert.ok(page.includes(`kind === "${kind}"`),`Missing ${kind} dashboard branch`);
  assert.match(page,/We could not load some farmer records/);
  assert.match(page,/We could not load some supplier records/);
  assert.match(page,/We could not load some buyer records/);
  assert.match(nav,/getRoleNavigation\(role\)/);
  assert.match(nav,/\.eq\("id", user\.id\)/);
});

test('saved products are owner-scoped and the UI does not offer buyers admin self-assignment', () => {
  const page=fs.readFileSync(path.join(root,'app/saved-products/page.tsx'),'utf8');
  const saveButton=fs.readFileSync(path.join(root,'components/SaveProduct.tsx'),'utf8');
  const signup=fs.readFileSync(path.join(root,'app/signup/page.tsx'),'utf8');
  const schema=fs.readFileSync(path.join(root,'supabase/schema.sql'),'utf8');
  assert.match(page,/buyerRoles\.includes\(profile\.role\)/);
  assert.match(page,/\.eq\("user_id", user\.id\)/);
  assert.match(saveButton,/\.eq\("user_id", user\.id\)/);
  assert.match(saveButton,/\.eq\("product_id", productId\)/);
  assert.doesNotMatch(signup,/<option value="admin"/i);
  assert.match(schema,/if r='admin' then r := 'buyer_individual'/i);
});

test('signup and sign-in use Supabase Auth and link between the existing flows', () => {
  const signup=fs.readFileSync(path.join(root,'app/signup/page.tsx'),'utf8');
  const login=fs.readFileSync(path.join(root,'app/login/page.tsx'),'utf8');
  assert.match(signup,/auth\.signUp/);
  assert.match(signup,/href="\/login"/);
  assert.match(signup,/email confirmation is enabled/i);
  assert.match(signup,/role="status"/);
  assert.match(login,/auth\.signInWithPassword/);
  assert.match(login,/href="\/signup"/);
  assert.match(login,/email not confirmed/i);
  assert.match(login,/role="alert"/);
});

test('farmer homepage section uses the local photo and existing farmer signup flow', () => {
  const page=fs.readFileSync(path.join(root,'app/page.tsx'),'utf8');
  const signup=fs.readFileSync(path.join(root,'app/signup/page.tsx'),'utf8');
  const css=fs.readFileSync(path.join(root,'app/globals.css'),'utf8');
  const image=path.join(root,'public/images/farmer-how-it-works.png');
  assert.ok(fs.existsSync(image),'Farmer photo must be present in public/images');
  assert.match(page,/src="\/images\/farmer-how-it-works\.png"/);
  assert.match(page,/className="farmer-how-it-works"/);
  assert.match(page,/Getting started on Mavuno Market is simple/);
  for(const title of ['Create your profile','List your produce','Connect with buyers','Manage orders','Grow your business']){
    assert.ok(page.includes(title),`Missing farmer step: ${title}`);
  }
  assert.match(page,/<Link className="btn farmer-how-join" href="\/signup">[\s\S]*Join as a Farmer/);
  assert.match(signup,/useState\("farmer"\)/);
  assert.doesNotMatch(signup,/<option value="admin"/i);
  assert.match(css,/\.farmer-how-layout\{[^}]*display:grid/);
  assert.match(css,/\.farmer-how-photo\{[^}]*aspect-ratio:630\/683/);
  assert.match(css,/@media\(max-width:850px\)\{\.farmer-how-layout\{grid-template-columns:minmax\(0,1fr\)/);
  assert.doesNotMatch(css,/@media\(max-width:850px\)\{[^}]*\.farmer-how-photo\{max-height:/);
});

test('supplier homepage section uses its photo and preselects only the supplier signup role', () => {
  const page=fs.readFileSync(path.join(root,'app/page.tsx'),'utf8');
  const signup=fs.readFileSync(path.join(root,'app/signup/page.tsx'),'utf8');
  const css=fs.readFileSync(path.join(root,'app/globals.css'),'utf8');
  const supplierStart=page.indexOf('aria-labelledby="supplier-how-it-works-title"');
  const supplierEnd=page.indexOf('<main className="container"',supplierStart);
  const section=page.slice(supplierStart,supplierEnd);
  assert.ok(supplierStart>page.indexOf('aria-labelledby="farmer-how-it-works-title"'));
  assert.ok(fs.existsSync(path.join(root,'public/images/agrovet-how-it-works.png')));
  assert.match(section,/src="\/images\/agrovet-how-it-works\.png"/);
  assert.match(section,/Supply\. Connect\. Grow\./);
  assert.match(section,/className="farmer-how-content supplier-how-content"/);
  assert.match(section,/Mavuno Market helps agrovet businesses reach more farmers/);
  for(const title of ['Register your business','List your products','Reach more farmers','Manage stock and orders','Grow your business']){
    assert.ok(page.includes(title),`Missing supplier step: ${title}`);
  }
  assert.match(section,/href="\/signup\?role=supplier"[\s\S]*Join as an Agrovet Supplier/);
  assert.match(signup,/new URLSearchParams\(window\.location\.search\)\.get/);
  assert.match(signup,/requestedRole && selectableRoles\.includes\(requestedRole\)/);
  assert.match(signup,/setRole\(requestedRole\)/);
  assert.match(signup,/<option value="supplier">/);
  assert.doesNotMatch(signup,/<option value="admin"/i);
  assert.match(css,/\.supplier-how-content>h2\{font-size:clamp\(34px,3\.2vw,46px\)\}/);
  assert.doesNotMatch(section,/payment gateway|M-Pesa|verified payments/i);
});

test('buyer homepage section uses the latest photo and contains benefits without signup or delivery claims', () => {
  const page=fs.readFileSync(path.join(root,'app/page.tsx'),'utf8');
  const buyerStart=page.indexOf('aria-labelledby="buyer-how-it-works-title"');
  const buyerEnd=page.indexOf('<main className="container"',buyerStart);
  const section=page.slice(buyerStart,buyerEnd);
  const benefitsStart=page.indexOf('const buyerBenefits = [');
  const benefitsEnd=page.indexOf('];',benefitsStart);
  const benefits=page.slice(benefitsStart,benefitsEnd);
  assert.ok(buyerStart>page.indexOf('aria-labelledby="supplier-how-it-works-title"'));
  assert.ok(fs.existsSync(path.join(root,'public/images/buyer-how-it-works.png')));
  assert.match(section,/src="\/images\/buyer-how-it-works\.png"/);
  assert.match(section,/alt="Buyer selecting fresh leafy produce at a local market"/);
  assert.match(section,/Discover\. Buy\. Benefit\./);
  assert.match(section,/Mavuno Market connects you with trusted farmers and Agrovet/);
  for(const benefit of ['Find quality products','Connect with sellers','Get fair prices','Support local agriculture']){
    assert.ok(page.toLowerCase().includes(benefit.toLowerCase()),`Missing buyer benefit: ${benefit}`);
  }
  assert.equal((benefits.match(/title:/g)||[]).length,4);
  assert.match(section,/buyerBenefits\.map/);
  assert.match(section,/href="\/signup\?role=buyer_individual"[\s\S]*Continue as a buyer/);
  assert.doesNotMatch(section,/Join as a Buyer|Create Buyer Account|Get Started|delivery|pickup|payment gateway|M-Pesa/i);
});

test('homepage hero preserves its full image aspect ratio on tablet and laptop widths', () => {
  const css=fs.readFileSync(path.join(root,'app/globals.css'),'utf8');
  assert.match(css,/\.home-hero\{[^}]*min-height:56\.264vw/);
  assert.match(css,/@media\(max-width:600px\)\{\.home-hero\{[^}]*min-height:0/);
});
