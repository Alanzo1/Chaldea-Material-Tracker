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
// Guest profiles: a new profile starts empty, switching back restores Main, and the choice survives reload.
await page.getByRole('button',{name:/^Profile:/}).click()
await page.getByRole('button',{name:'New profile'}).click()
await page.getByLabel('New profile name').fill('JP alt')
await page.getByRole('button',{name:'Add',exact:true}).click()
await page.waitForFunction(()=>document.querySelector('input[id^=owned-]')?.value==='0')
await page.getByLabel('Quantity owned').fill('7')
await page.getByRole('button',{name:'Save',exact:true}).click()
await page.reload()
await page.locator('[aria-busy=false]').waitFor()
await page.waitForFunction(()=>document.querySelector('input[id^=owned-]')?.value==='7')
await page.getByRole('button',{name:/^Profile:/}).click()
await page.getByRole('list',{name:'Profiles'}).getByRole('button',{name:'Main',exact:true}).click()
await page.waitForFunction(()=>document.querySelector('input[id^=owned-]')?.value==='99')
assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('chaldea:guest-profiles')).profiles.map(p=>p.name)),['Main','JP alt'])
await page.goto(`${base}/account?error=sign-in`)
await page.getByRole('alert').filter({hasText:'Sign-in was canceled'}).waitFor()
await page.route(`${supabaseUrl}/auth/v1/settings`, route=>route.fulfill({json:{external:{google:false}}}))
await page.getByRole('button',{name:'Continue with Google'}).click()
await page.getByRole('alert').filter({hasText:'Google sign-in is not enabled yet'}).waitFor()
assert.deepEqual(errors,[])
console.log('PASS guest account desktop/mobile, theme persistence, inventory persistence, guest profiles, recoverable auth error')
await ctx.close()
} finally { await browser.close() }
})

test('authenticated game profiles: import, switch, create, rename, delete, offline, conflict, remote delete', async () => {
const browser = await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL || undefined,headless:true})
try {
const ctx = await browser.newContext({viewport:{width:1280,height:900}})
const page = await ctx.newPage()
const errors=[]
page.on('pageerror',e=>errors.push(e.message))
const id='00000000-0000-0000-0000-000000000001'
const user={id,aud:'authenticated',role:'authenticated',email:'test@example.test',user_metadata:{full_name:'Test Master'},app_metadata:{provider:'google'},created_at:new Date().toISOString()}
const token = [Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'test'].join('.')
const session={access_token:token,refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user}
const cookie='base64-'+Buffer.from(JSON.stringify(session)).toString('base64url')
// In-memory stand-in for the profile RPCs, with the same error codes as the migration.
const cloud={settings:{display_name:'Cloud Master',theme:'dark'},profiles:[{id:'main-id',name:'Main',revision:1,document:{version:1,qp:400,servants:[],ownedByMaterialId:{'6505':4}}}]}
let writes=0, offline=false, nextId=1
const fail=(code,message)=>({status:400,json:{code,message,details:null,hint:null}})
const byId=pid=>cloud.profiles.find(p=>p.id===pid)
await page.route(`${supabaseUrl}/**`,async route=>{
 const url=route.request().url()
 const rpc=url.match(/\/rpc\/(\w+)/)?.[1]
 const body=rpc ? route.request().postDataJSON() ?? {} : {}
 if(rpc && offline && rpc!=='read_progress_profiles') return route.fulfill({status:503,json:{message:'Simulated outage'}})
 if(rpc==='read_progress_profiles') return route.fulfill({json:{settings:cloud.settings,profiles:cloud.profiles}})
 if(rpc==='save_account_settings') { cloud.settings={display_name:body.display_name,theme:body.theme}; return route.fulfill({status:204}) }
 if(rpc==='create_progress_profile') {
  const name=body.profile_name.trim()
  if(cloud.profiles.length>=10) return route.fulfill(fail('P0001','Profile limit reached'))
  if(cloud.profiles.some(p=>p.name.toLowerCase()===name.toLowerCase())) return route.fulfill(fail('23505','duplicate key'))
  const row={id:`p${nextId++}`,name,revision:1,document:body.progress_document}
  cloud.profiles.push(row)
  return route.fulfill({json:{id:row.id,name:row.name,revision:1}})
 }
 if(rpc==='save_progress_profile') {
  writes++
  const row=byId(body.profile_id)
  if(!row) return route.fulfill(fail('P0002','Profile not found'))
  if(row.revision!==body.expected_revision) return route.fulfill(fail('40001','Save conflict'))
  row.document=body.progress_document; row.revision++
  return route.fulfill({json:row.revision})
 }
 if(rpc==='rename_progress_profile') {
  const row=byId(body.profile_id)
  if(!row) return route.fulfill(fail('P0002','Profile not found'))
  row.name=body.profile_name.trim(); return route.fulfill({status:204})
 }
 if(rpc==='delete_progress_profile') {
  if(cloud.profiles.length<=1) return route.fulfill(fail('P0001','Cannot delete last profile'))
  cloud.profiles=cloud.profiles.filter(p=>p.id!==body.profile_id); return route.fulfill({status:204})
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
const owned=()=>page.getByLabel('Quantity owned').inputValue()
const settled=()=>page.getByRole('status').filter({hasText:/^Saved$/}).first().waitFor()
const profileMenu=()=>page.getByRole('button',{name:/^Profile:/})
const pick=async name=>{ await profileMenu().click(); await page.getByRole('list',{name:'Profiles'}).getByRole('button',{name,exact:true}).click() }

// Sign-in import is offered, and declining leaves the cloud untouched.
await page.goto(`${base}/account`)
await page.getByRole('dialog').filter({hasText:'Add your 1 device profile to your account?'}).waitFor()
await page.getByRole('button',{name:'Not now'}).click()
assert.equal(writes,0)
assert.equal(cloud.profiles.length,1)

// Account settings save on their own.
await page.getByLabel('Display name').fill('Updated Master')
await page.getByRole('button',{name:'Save name'}).click()
await page.waitForTimeout(300)
assert.equal(cloud.settings.display_name,'Updated Master')

// Importing adds the device profile next to Main, renamed to avoid the clash, without replacing Main.
await page.getByRole('button',{name:'Add device profiles'}).click()
await page.getByRole('dialog').getByRole('button',{name:'Add 1 profile'}).click()
await page.getByRole('status').filter({hasText:'Added 1 profile from this device.'}).waitFor()
assert.deepEqual(cloud.profiles.map(p=>p.name),['Main','Main (device)'])
assert.equal(cloud.profiles[0].document.qp,400)
assert.equal(cloud.profiles[1].document.qp,900)

// Switching loads each profile's own inventory, and survives a reload.
await page.goto(`${base}/material/6505`)
await page.locator('[aria-busy=false]').waitFor()
assert.equal(await owned(),'4')
await pick('Main (device)')
await page.waitForFunction(()=>document.querySelector('input[id^=owned-]')?.value==='99')
await page.reload()
await page.locator('[aria-busy=false]').waitFor()
await page.waitForFunction(()=>document.querySelector('input[id^=owned-]')?.value==='99')
assert.equal(await profileMenu().getAttribute('aria-label'),'Profile: Main (device)')

// Creating a profile switches to it empty; saving writes only to that profile.
await profileMenu().click()
await page.getByRole('button',{name:'New profile'}).click()
await page.getByLabel('New profile name').fill('main')
await page.getByRole('button',{name:'Add',exact:true}).click()
await page.getByRole('alert').filter({hasText:'already exists'}).waitFor()
await page.getByLabel('New profile name').fill('JP alt')
await page.getByRole('button',{name:'Add',exact:true}).click()
await page.waitForFunction(()=>document.querySelector('input[id^=owned-]')?.value==='0')
await page.getByLabel('Quantity owned').fill('5')
await page.getByRole('button',{name:'Save',exact:true}).click()
await page.waitForTimeout(1200)
const jp=cloud.profiles.find(p=>p.name==='JP alt')
assert.equal(jp.document.ownedByMaterialId['6505'],5)
assert.equal(cloud.profiles.find(p=>p.name==='Main').document.ownedByMaterialId['6505'],4)
await pick('Main')
await page.waitForFunction(()=>document.querySelector('input[id^=owned-]')?.value==='4')

// Rename and delete from Account.
await page.goto(`${base}/account`)
await page.locator('[aria-busy=false]').waitFor()
await page.getByRole('button',{name:'Rename JP alt'}).click()
await page.getByLabel('Rename JP alt').fill('JP')
await page.getByRole('button',{name:'Save',exact:true}).click()
await page.getByText('JP',{exact:true}).waitFor()
assert.equal(jp.name,'JP')
await page.getByRole('button',{name:'Delete Main (device)'}).click()
await page.getByRole('button',{name:'Delete profile'}).click()
await page.getByRole('button',{name:'Delete Main (device)'}).waitFor({state:'detached'})
assert.deepEqual(cloud.profiles.map(p=>p.name),['Main','JP'])

// Offline edits stay in that profile's device copy until synced.
await pick('JP')
await settled()
offline=true
await page.goto(`${base}/material/6505`)
await page.locator('[aria-busy=false]').waitFor()
await page.waitForFunction(()=>document.querySelector('input[id^=owned-]')?.value==='5')
await page.getByLabel('Quantity owned').fill('6')
await page.getByRole('button',{name:'Save',exact:true}).click()
await page.waitForFunction(({id,pid})=>JSON.parse(localStorage.getItem(`chaldea:account:${id}:profile:${pid}`) ?? '{}').dirty===true,{id,pid:jp.id})
offline=false
await page.goto(`${base}/account`)
await settled()
await page.waitForTimeout(1200)
assert.equal(jp.document.ownedByMaterialId['6505'],6)

// A save clash on one profile asks which copy to keep, naming the profile.
jp.revision++; jp.document={...jp.document,qp:1234}
await page.goto(`${base}/material/6505`)
await page.locator('[aria-busy=false]').waitFor()
jp.revision++
await page.getByLabel('Quantity owned').fill('7')
await page.getByRole('button',{name:'Save',exact:true}).click()
await page.getByRole('dialog').filter({hasText:'Choose which “JP” progress to keep'}).waitFor()
await page.getByRole('button',{name:'Use cloud progress',exact:true}).click()
await page.waitForFunction(()=>document.querySelector('input[id^=owned-]')?.value==='6')

// Deleting the active profile on another device moves this tab to the first profile.
cloud.profiles=cloud.profiles.filter(p=>p.id!==jp.id)
await page.evaluate(()=>window.dispatchEvent(new Event('focus')))
await page.getByRole('status').filter({hasText:'“JP” was deleted on another device.'}).waitFor()
await page.waitForFunction(()=>document.querySelector('input[id^=owned-]')?.value==='4')

// Sign out returns to guest progress, untouched by the account.
await page.goto(`${base}/account`)
await page.getByRole('button',{name:'Sign out',exact:true}).click()
await page.getByRole('button',{name:'Continue with Google'}).waitFor()
assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('trackedMaterialsStateV1')).ownedByMaterialId['6505']),99)
assert.deepEqual(errors,[])
console.log('PASS mocked authenticated game profiles')
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
