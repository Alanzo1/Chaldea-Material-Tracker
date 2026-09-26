import { test } from 'node:test'
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
try { process.loadEnvFile('.env.local') } catch { /* CI supplies environment variables directly. */ }
const base = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
if (!supabaseUrl) throw new Error('Configure the same Supabase URL as the running app before browser tests.')
const cookieName = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`
// Google and cloud APIs are mocked; these tests never modify a real account.
test('guest account browser flows', async () => {
const browser = await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL || undefined, headless:true})
try {
const ctx = await browser.newContext()
const page = await ctx.newPage()
const errors = []
page.on('pageerror', e=>errors.push(e.message))
await page.goto(`${base}/account`)
await page.getByRole('heading',{name:'Get started'}).waitFor()
await page.getByRole('button',{name:'Continue with Google'}).waitFor()
await page.setViewportSize({width:390,height:844})
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),true)
await page.getByRole('button',{name:'Settings'}).click()
await page.getByRole('button',{name:/Theme/}).click()
assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('dark')),false)
await page.reload()
await page.getByRole('heading',{name:'Get started'}).waitFor()
assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('dark')),false)
await page.goto(`${base}/material/6505`)
await page.locator('[aria-busy=false]').waitFor()
await page.getByLabel('Quantity owned').fill('99')
await page.getByRole('button',{name:'Save',exact:true}).click()
await page.reload()
await page.locator('[aria-busy=false]').waitFor()
await page.waitForFunction(()=>document.querySelector('input[id^=owned-]')?.value==='99')
assert.equal(await page.getByLabel('Quantity owned').inputValue(),'99')
await page.goto(`${base}/account?error=sign-in`)
await page.getByRole('alert').filter({hasText:'Sign-in was canceled'}).waitFor()
await page.route(`${supabaseUrl}/auth/v1/settings`, route=>route.fulfill({json:{external:{google:false}}}))
await page.getByRole('button',{name:'Continue with Google'}).click()
await page.getByRole('alert').filter({hasText:'Google sign-in is not enabled yet'}).waitFor()
assert.deepEqual(errors,[])
console.log('PASS guest account desktop/mobile, theme persistence, inventory persistence, recoverable auth error')
await ctx.close()
} finally { await browser.close() }
})

test('authenticated account browser flows', async () => {
const browser = await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL || undefined,headless:true})
try {
const ctx = await browser.newContext({viewport:{width:390,height:844}})
const page = await ctx.newPage()
const errors=[]
page.on('pageerror',e=>errors.push(e.message))
const id='00000000-0000-0000-0000-000000000001'
const user={id,aud:'authenticated',role:'authenticated',email:'test@example.test',user_metadata:{full_name:'Test Master'},app_metadata:{provider:'google'},created_at:new Date().toISOString()}
const token = [Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'test'].join('.')
const session={access_token:token,refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user}
const cookie='base64-'+Buffer.from(JSON.stringify(session)).toString('base64url')
let cloud={document:{version:1,qp:400,servants:[],ownedByMaterialId:{'6505':4}},revision:1,display_name:'Cloud Master',theme:'dark'}
let writes=0
let offline=false
await page.route(`${supabaseUrl}/**`,async route=>{
 const url=route.request().url()
 if(url.includes('read_user_save')) return route.fulfill({json:cloud})
 if(url.includes('save_user_progress')) {
  if(offline) return route.fulfill({status:503,json:{message:'Simulated outage'}})
  writes++
  const data=route.request().postDataJSON()
  if(data.expected_revision!==cloud.revision) return route.fulfill({status:409,json:{code:'40001',message:'Save conflict'}})
  cloud={document:data.progress_document,revision:cloud.revision+1,display_name:data.profile_name,theme:data.profile_theme}
  return route.fulfill({json:cloud.revision})
 }
 if(url.includes('/logout')) return route.fulfill({status:204})
 if(url.includes('/user')) return route.fulfill({json:user})
 return route.fulfill({json:session})
})
await page.addInitScript(({cookie,cookieName})=>{
 if(!sessionStorage.getItem('test-seeded')) {
 document.cookie=`${cookieName}=${cookie}; Path=/; SameSite=Lax`
 localStorage.setItem('trackedMaterialsStateV1',JSON.stringify({version:1,servants:[],ownedByMaterialId:{'6505':99}}))
 localStorage.setItem('trackerCurrentQp','900')
 sessionStorage.setItem('test-seeded','true')
 }
},{cookie,cookieName})
await page.goto(`${base}/account`)
await page.getByRole('dialog').waitFor()
assert.equal(writes,0)
await page.getByRole('button',{name:'Keep cloud progress'}).click()
await page.getByLabel('Display name').fill('Updated Master')
await page.getByRole('button',{name:'Save name'}).click()
await page.getByRole('status').filter({hasText:/^Saved$/}).waitFor()
assert.equal(cloud.display_name,'Updated Master')
assert.equal(cloud.document.qp,400)
await page.getByRole('button',{name:'Import guest progress',exact:true}).click()
await page.getByRole('dialog').getByRole('button',{name:'Import guest progress'}).click()
await page.getByRole('status').filter({hasText:/^Saved$/}).waitFor()
assert.equal(cloud.document.qp,900)
assert.equal(cloud.document.ownedByMaterialId['6505'],99)
offline=true
await page.getByLabel('Display name').fill('Saved after retry')
await page.getByRole('button',{name:'Save name'}).click()
await page.getByRole('status').filter({hasText:/^Not synced$/}).waitFor()
assert.equal(await page.evaluate(id=>JSON.parse(localStorage.getItem(`chaldea:account:${id}`)).dirty,id),true)
offline=false
await page.getByRole('button',{name:'Sync now'}).click()
await page.getByRole('status').filter({hasText:/^Saved$/}).waitFor()
assert.equal(cloud.display_name,'Saved after retry')
// A second device saved after this tab's last load.
cloud={...cloud,revision:cloud.revision+1,document:{...cloud.document,qp:1234}}
await page.getByLabel('Display name').fill('Conflict Master')
await page.getByRole('button',{name:'Save name'}).click()
await page.getByRole('dialog').filter({hasText:'Choose which progress to keep'}).waitFor()
await page.getByRole('button',{name:'Use cloud progress',exact:true}).click()
await page.getByRole('status').filter({hasText:/^Saved$/}).waitFor()
assert.equal(await page.getByLabel('Display name').inputValue(),'Saved after retry')
const backupCount=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.includes(':recovery:')).length)
assert.ok(backupCount>=3)
await page.getByRole('button',{name:'Sign out',exact:true}).click()
await page.getByRole('button',{name:'Continue with Google'}).waitFor()
assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('trackedMaterialsStateV1')).ownedByMaterialId['6505']),99)
assert.deepEqual(errors,[])
console.log('PASS mocked authenticated mobile UI: import decline/accept, profile autosave, conflict resolution/recovery, sign-out guest isolation')
} finally { await browser.close() }
})

test('expired sessions leave pending account saves intact and return to guest mode', async () => {
  const browser = await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL || undefined,headless:true})
  try {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    const id = '00000000-0000-0000-0000-000000000003'
    const session = {access_token:'expired.token.signature', refresh_token:'expired-refresh', expires_at:1, expires_in:0, token_type:'bearer', user:{id,email:'expired@example.test',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()}}
    const cookie = 'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url')
    let cloudCalls=0
    await page.route(`${supabaseUrl}/**`, route => {
      if (route.request().url().includes('/rest/v1/')) cloudCalls++
      return route.fulfill({status:400,json:{code:'refresh_token_not_found',error_code:'refresh_token_not_found',msg:'Refresh token not found'}})
    })
    await page.addInitScript(({id,cookie,cookieName})=>{
      document.cookie=`${cookieName}=${cookie}; Path=/; SameSite=Lax`
      localStorage.setItem(`chaldea:account:${id}`,JSON.stringify({revision:1,dirty:true,document:{version:1,qp:789,servants:[],ownedByMaterialId:{}},profile:{displayName:'Expired',theme:'dark'}}))
      localStorage.setItem('trackedMaterialsStateV1',JSON.stringify({version:1,qp:123,servants:[],ownedByMaterialId:{}}))
    },{id,cookie,cookieName})
    await page.goto(`${base}/account`)
    await page.getByRole('button',{name:'Continue with Google'}).waitFor()
    await page.locator('[aria-busy=false]').waitFor()
    assert.equal(await page.evaluate(id=>JSON.parse(localStorage.getItem(`chaldea:account:${id}`)).document.qp,id),789)
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('trackedMaterialsStateV1')).qp),123)
    assert.equal(cloudCalls,0)
  } finally { await browser.close() }
})

test('email signup, confirmation resend, invalid login, and password reset request', async () => {
  const browser = await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL || undefined,headless:true})
  try {
    const page = await browser.newPage()
    const calls=[]
    await page.route(`${supabaseUrl}/auth/v1/**`, route=>{
      const url=route.request().url()
      const body=route.request().postDataJSON()
      calls.push({url,body})
      if(url.includes('/token')) return route.fulfill({status:400,json:{code:'invalid_credentials',error_code:'invalid_credentials',msg:'Invalid login credentials'}})
      return route.fulfill({json:url.includes('/signup') ? {user:{id:'test-signup'},session:null} : {}})
    })
    await page.goto(`${base}/account`)
    await page.locator('[aria-busy=false]').waitFor()
    await page.getByLabel('Email',{exact:true}).fill('signup@example.test')
    await page.getByLabel('Password',{exact:true}).fill('test-password-123')
    await page.getByRole('button',{name:'Show password',exact:true}).click()
    assert.equal(await page.getByLabel('Password',{exact:true}).getAttribute('type'),'text')
    await page.getByRole('button',{name:'Hide password',exact:true}).click()
    assert.equal(await page.getByLabel('Password',{exact:true}).getAttribute('type'),'password')
    await page.getByRole('button',{name:'Sign up',exact:true}).click()
    await page.getByRole('status').filter({hasText:'Check your email'}).waitFor()
    const signup=calls.find(c=>c.url.includes('/signup'))
    assert.equal(signup.body.email,'signup@example.test')
    assert.ok(signup.url.includes('redirect_to='))
    await page.getByRole('button',{name:'Resend confirmation email'}).click()
    await page.getByRole('status').filter({hasText:'a new email is on its way'}).waitFor()
    assert.ok(calls.some(c=>c.url.includes('/resend')))
    await page.getByRole('button',{name:'Sign in',exact:true}).click()
    await page.getByLabel('Password',{exact:true}).fill('incorrect-password')
    await page.getByRole('button',{name:'Sign in',exact:true}).click()
    await page.getByRole('alert').filter({hasText:'Email or password is incorrect'}).waitFor()
    await page.getByRole('button',{name:'Forgot password?'}).click()
    await page.getByRole('button',{name:'Send reset link'}).click()
    await page.getByRole('status').filter({hasText:'If an account exists'}).waitFor()
    assert.ok(calls.some(c=>c.url.includes('/recover') && new URL(new URL(c.url).searchParams.get('redirect_to')).searchParams.get('next') === '/account/password'))
  } finally { await browser.close() }
})

test('password update stays available when cloud progress is unavailable', async () => {
  const browser = await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL || undefined,headless:true})
  try {
    const page=await browser.newPage()
    const id='00000000-0000-0000-0000-000000000004'
    const user={id,aud:'authenticated',role:'authenticated',email:'reset@example.test',user_metadata:{},app_metadata:{},created_at:new Date().toISOString()}
    const session={access_token:'test.token.signature',refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user}
    const cookie='base64-'+Buffer.from(JSON.stringify(session)).toString('base64url')
    let passwordUpdated=false
    await page.route(`${supabaseUrl}/**`,route=>{
      if(route.request().url().includes('/rest/')) return route.fulfill({status:503,json:{message:'Unavailable'}})
      if(route.request().method()==='PUT' && route.request().url().includes('/user')) {
        passwordUpdated=route.request().postDataJSON().password==='replacement-password-123'
        return route.fulfill({json:user})
      }
      return route.fulfill({json:user})
    })
    await page.addInitScript(({cookie,cookieName})=>{document.cookie=`${cookieName}=${cookie}; Path=/; SameSite=Lax`},{cookie,cookieName})
    await page.goto(`${base}/account/password`)
    await page.getByLabel('New password',{exact:true}).fill('replacement-password-123')
    await page.getByLabel('Confirm new password').fill('replacement-password-123')
    await page.getByRole('button',{name:'Update password',exact:true}).click()
    await page.getByRole('status').filter({hasText:'Your password has been updated'}).waitFor()
    assert.equal(passwordUpdated,true)
  } finally { await browser.close() }
})
