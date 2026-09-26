import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CloudSync } from './cloud-sync.ts'
import { emptyDocument, toDocument, validateDocument } from './cloud-progress.ts'
import { safeReturnPath } from './auth-redirect.ts'

const snapshot = (revision = 1, qp = 10) => ({ revision, document: { ...emptyDocument(), qp }, profile: { displayName: 'Master', theme: 'dark' } })
function setup(initial = null) {
  const backups = [], writes = [], applied = [], saves = []
  let remote = snapshot()
  const transport = { read: async () => structuredClone(remote), save: async s => {
    saves.push(structuredClone(s))
    if (s.revision !== remote.revision) throw { code: '40001' }
    remote = { ...structuredClone(s), revision: remote.revision + 1 }
    return remote.revision
  } }
  const sync = new CloudSync(transport, { write: s => writes.push(structuredClone(s)), backup: s => backups.push(structuredClone(s)) }, initial, async (s, valid) => { if (valid()) applied.push(s) }, () => {})
  return { sync, transport, backups, writes, applied, saves, remote: s => { remote = s } }
}
test('first load uses cloud progress, without uploading guest progress', async () => {
  const {sync, applied, saves} = setup()
  await sync.refresh()
  assert.equal(applied[0].document.qp, 10)
  assert.equal(sync.current.dirty, false)
  assert.equal(saves.length, 0)
  sync.dispose()
})
test('failed upload retains pending progress and retries the same revision', async () => {
  const {sync, transport, writes} = setup()
  await sync.refresh()
  sync.edit({...emptyDocument(), qp: 25}, sync.current.profile)
  const save = transport.save
  transport.save = async () => { throw Error('offline') }
  await sync.flush()
  assert.equal(sync.current.dirty, true)
  assert.match(sync.error, /Not synced/)
  assert.equal(writes.at(-1).document.qp, 25)
  transport.save = save
  await sync.flush()
  assert.equal(sync.current.dirty, false)
  assert.equal(sync.current.revision, 2)
  sync.dispose()
})
test('revision conflicts pause uploads; choosing cloud retains recovery copies', async () => {
  const {sync, remote, saves, backups, applied} = setup()
  await sync.refresh()
  sync.edit({...emptyDocument(), qp: 20}, sync.current.profile)
  remote(snapshot(2, 30))
  await sync.flush()
  assert.equal(sync.conflict.document.qp, 30)
  await sync.flush()
  assert.equal(saves.length, 1)
  await sync.resolve(false)
  assert.equal(backups.length, 2)
  assert.equal(applied.at(-1).document.qp, 30)
  assert.equal(sync.current.dirty, false)
  sync.dispose()
})
test('choosing device retries against conflict revision and detects another race', async () => {
  const {sync, remote} = setup()
  await sync.refresh()
  sync.edit({...emptyDocument(), qp: 20}, sync.current.profile)
  remote(snapshot(2, 30))
  await sync.refresh()
  remote(snapshot(3, 40))
  await sync.resolve(true)
  assert.equal(sync.conflict.revision, 3)
  assert.equal(sync.current.document.qp, 20)
  await sync.resolve(true)
  assert.equal(sync.current.revision, 4)
  assert.equal(sync.current.dirty, false)
  sync.dispose()
})
test('pending edits made during upload remain dirty and keep the new revision', async () => {
  const {sync, transport} = setup()
  await sync.refresh()
  sync.edit({...emptyDocument(), qp: 20}, sync.current.profile)
  let complete
  transport.save = () => new Promise(resolve => { complete = resolve })
  const saving = sync.flush()
  sync.edit({...emptyDocument(), qp: 30}, sync.current.profile)
  complete(2)
  await saving
  assert.equal(sync.current.document.qp, 30)
  assert.equal(sync.current.revision, 2)
  assert.equal(sync.current.dirty, true)
  sync.dispose()
})
test('disposing a session ignores in-flight responses and stops scheduled writes', async () => {
  const {sync, transport, writes} = setup()
  await sync.refresh()
  sync.edit({...emptyDocument(), qp: 20}, sync.current.profile)
  let complete
  transport.save = () => new Promise(resolve => { complete = resolve })
  const saving = sync.flush()
  const before = writes.length
  sync.dispose()
  complete(2)
  await saving
  assert.equal(writes.length, before)
  assert.equal(sync.current.dirty, true)
})
test('restored unsynced cache conflicts with changes from another device', async () => {
  const {sync} = setup({...snapshot(0, 50), dirty: true})
  await sync.refresh()
  assert.equal(sync.current.document.qp, 50)
  assert.equal(sync.conflict.revision, 1)
  sync.dispose()
})
test('save serialization excludes game metadata and preserves order', () => {
  const servant = id => ({ servantId: id, servantName: 'Not uploaded', ascensionLevel: 1, skillLevels: [0,1,2], appendSkillLevels: [1,2,3], ascensionMaterials: {secret: true} })
  const d = toDocument({ version: 1, qp: 25, servants: [servant(2),servant(1)], ownedByMaterialId: {'10': 15} })
  assert.deepEqual(d.servants.map(s=>s.servantId), [2,1])
  assert.equal(JSON.stringify(d).includes('Not uploaded'), false)
  assert.equal(validateDocument(d), d)
  assert.throws(()=>validateDocument({...d, qp: -1}))
  assert.throws(()=>validateDocument({...d, version: 9}))
})
test('OAuth return paths reject external, protocol-relative and backslash redirects', () => {
  for (const p of ['https://evil.test', '//evil.test', '/\\evil.test', '/auth/callback', '/\n/evil.test']) assert.equal(safeReturnPath(p), '/')
  assert.equal(safeReturnPath('/material/1?q=bone'), '/material/1?q=bone')
})

test('new accounts create an empty private profile without importing guest progress', async () => {
  const {sync, remote, saves} = setup()
  remote(snapshot(0, 0))
  await sync.refresh()
  assert.equal(sync.current.dirty, true)
  await sync.flush()
  assert.equal(saves[0].document.qp, 0)
  assert.equal(sync.current.revision, 1)
  sync.dispose()
})
test('edits during a remote refresh are preserved instead of applying a stale read', async () => {
  const {sync, transport} = setup()
  await sync.refresh()
  let complete
  transport.read = () => new Promise(resolve => { complete = resolve })
  const refreshing = sync.refresh()
  sync.edit({...emptyDocument(), qp: 99}, sync.current.profile)
  complete(snapshot(2, 50))
  await refreshing
  assert.equal(sync.current.document.qp, 99)
  assert.equal(sync.conflict.document.qp, 50)
  sync.dispose()
})
