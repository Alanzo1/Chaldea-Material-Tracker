import { test } from 'node:test'
import assert from 'node:assert/strict'
import { activateTracker, readGuestProgress, readTrackedMaterialsState, writeTrackedMaterialsState, setCurrentQp, subscribeTracker } from './material-tracker.ts'

test('legacy guest migration preserves quantities, QP, and servant ordering; account edits stay separate', () => {
  const storage = new Map()
  globalThis.window = { localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) } }
  const servant = (id,name) => ({servantId:id, servantName:name, ascensionLevel:2, skillLevels:[2,3,4], appendSkillLevels:[1,2,3]})
  storage.set('trackedMaterialsStateV1', JSON.stringify({version:1, servants:[servant(2,'Z'), servant(1,'A')], ownedByMaterialId:{'10':30}}))
  storage.set('trackerCurrentQp', '500')
  const guest = readGuestProgress()
  assert.equal(guest.qp, 500)
  assert.deepEqual(guest.servants.map(s=>s.servantId), [2,1])
  activateTracker(guest, null)
  let notifications = 0
  const unsubscribe = subscribeTracker(()=>notifications++)
  writeTrackedMaterialsState({...guest, qp:400, ownedByMaterialId:{'10':20}})
  assert.equal(notifications, 1)
  assert.equal(readGuestProgress().qp, 400)
  const accountWrites = []
  activateTracker({version:1, servants:[], ownedByMaterialId:{}, qp:10}, s=>accountWrites.push(s))
  setCurrentQp(100)
  assert.equal(accountWrites.at(-1).qp, 100)
  assert.equal(readGuestProgress().qp, 400)
  activateTracker(readGuestProgress(), null)
  assert.equal(readTrackedMaterialsState().qp, 400)
  writeTrackedMaterialsState(guest) // Undo restores quantities and QP together.
  assert.equal(readGuestProgress().qp, 500)
  assert.equal(readGuestProgress().ownedByMaterialId['10'], 30)
  unsubscribe()
  delete globalThis.window
})
