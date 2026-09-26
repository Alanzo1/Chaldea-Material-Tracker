import type { CloudSnapshot, PendingSave, PrivateProfile, ProgressDocument } from "./cloud-progress"

export interface SyncTransport {
  read(): Promise<CloudSnapshot>
  save(snapshot: CloudSnapshot): Promise<number>
}
export interface SyncStorage {
  write(save: PendingSave): void
  backup(save: CloudSnapshot): void
}
// One writer per session. Revision checks arbitrate between tabs and devices.
export class CloudSync {
  current: PendingSave | null
  conflict: CloudSnapshot | null = null
  error = ""
  busy = false
  disposed = false
  private timer: ReturnType<typeof setTimeout> | undefined
  private generation = 0
  private refreshRequested = false
  private transport: SyncTransport
  private storage: SyncStorage
  private apply: (snapshot: CloudSnapshot, stillCurrent: () => boolean) => Promise<void>
  private changed: () => void
  constructor(
    transport: SyncTransport,
    storage: SyncStorage,
    initial: PendingSave | null,
    apply: (snapshot: CloudSnapshot, stillCurrent: () => boolean) => Promise<void>,
    changed: () => void,
  ) { this.current = initial; this.transport = transport; this.storage = storage; this.apply = apply; this.changed = changed }
  private persist() {
    if (!this.current) return
    try { this.storage.write(this.current) } catch { this.error = "Device storage is unavailable. Keep this tab open until your changes sync." }
  }
  edit(document: ProgressDocument, profile: PrivateProfile) {
    if (!this.current || this.disposed) return
    this.current = { ...this.current, document, profile, dirty: true }
    this.generation++
    this.persist()
    this.changed()
    this.schedule()
  }
  private schedule() {
    clearTimeout(this.timer)
    if (!this.disposed) this.timer = setTimeout(() => { void this.flush() }, 700)
  }
  async refresh() {
    if (this.disposed) return
    if (this.busy) { this.refreshRequested = true; return }
    this.busy = true; this.changed()
    const generation = this.generation
    this.error = ""
    try {
      const remote = await this.transport.read()
      if (this.disposed) return
      if (this.current?.dirty) {
        if (this.current.revision !== remote.revision) this.conflict = remote
      } else if (!this.current || this.current.revision !== remote.revision) {
        await this.apply(remote, () => !this.disposed && generation === this.generation)
        if (this.disposed) return
        if (generation !== this.generation) {
          if (this.current?.dirty && this.current.revision !== remote.revision) this.conflict = remote
        } else { this.current = { ...remote, dirty: remote.revision === 0 }; this.persist() }
      }
    } catch (error) { if (!this.disposed) this.error = error instanceof Error ? error.message : "Cloud saves are unavailable. Please retry." }
    finally { this.finish() }
    if (this.current?.dirty && !this.conflict && !this.error) this.schedule()
  }
  async flush() {
    if (this.disposed || this.conflict || !this.current?.dirty) return
    if (this.busy) { this.schedule(); return }
    this.busy = true; this.changed()
    const sent = this.current
    const generation = this.generation
    try {
      const revision = await this.transport.save(sent)
      if (this.disposed) return
      this.current = { ...this.current!, revision, dirty: generation !== this.generation }
      this.error = ""
      this.persist()
    } catch (error) {
      if (this.disposed) return
      if ((error as { code?: string })?.code === "40001") {
        try { this.conflict = await this.transport.read() } catch { this.error = "Could not retrieve the newer save. Retry to resolve the conflict." }
      } else this.error = "Not synced. Your changes remain on this device; retry when connected."
    } finally { this.finish() }
    if (this.current?.dirty && !this.conflict && !this.error) this.schedule()
  }
  async resolve(useDevice: boolean) {
    if (!this.conflict || !this.current || this.busy || this.disposed) return
    const remote = this.conflict
    this.busy = true; this.changed()
    try {
      // Refuse replacement if a recovery copy cannot be retained.
      this.storage.backup(this.current)
      this.storage.backup(remote)
      if (useDevice) this.current = { ...this.current, revision: remote.revision, dirty: true }
      else {
        await this.apply(remote, () => !this.disposed)
        if (this.disposed) return
        this.current = { ...remote, dirty: false }
      }
      this.generation++; this.conflict = null; this.error = ""; this.persist()
    } catch { this.error = "Could not preserve or load these saves. Free device storage or reconnect, then retry." }
    finally { this.finish() }
    if (useDevice && !this.conflict) await this.flush()
  }
  private finish() {
    this.busy = false
    if (this.disposed) return
    this.changed()
    if (this.refreshRequested) { this.refreshRequested = false; void this.refresh() }
  }
  dispose() { this.disposed = true; clearTimeout(this.timer) }
}
