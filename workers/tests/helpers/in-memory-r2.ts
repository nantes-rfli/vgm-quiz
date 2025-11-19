import { Buffer } from 'node:buffer'
import type { R2Object, R2ObjectBody, R2Objects } from '@cloudflare/workers-types'

class InMemoryR2Object {
  constructor(private readonly value: string) {}

  async text(): Promise<string> {
    return this.value
  }
}

export class InMemoryR2Bucket {
  #store = new Map<string, string>()

  async put(key: string, value: string | ArrayBuffer | ArrayBufferView): Promise<R2ObjectBody> {
    let text: string

    if (typeof value === 'string') {
      text = value
    } else if (value instanceof ArrayBuffer) {
      text = Buffer.from(value).toString()
    } else {
      const view = value as ArrayBufferView
      text = Buffer.from(view.buffer, view.byteOffset, view.byteLength).toString()
    }

    this.#store.set(key, text)
    return { key } as R2ObjectBody
  }

  async head(key: string): Promise<R2Object | null> {
    return this.#store.has(key) ? ({ key } as R2Object) : null
  }

  async get(key: string): Promise<R2ObjectBody | null> {
    const value = this.#store.get(key)
    return value ? (new InMemoryR2Object(value) as unknown as R2ObjectBody) : null
  }

  async delete(key: string): Promise<void> {
    this.#store.delete(key)
  }

  async list(options?: { prefix?: string }): Promise<R2Objects> {
    const prefix = options?.prefix ?? ''
    const objects = Array.from(this.#store.entries())
      .filter(([key]) => (prefix ? key.startsWith(prefix) : true))
      .map(([key, value]) => ({
        key,
        size: value.length,
        uploaded: new Date(),
      }))

    return {
      objects,
      truncated: false,
    } as R2Objects
  }

  dump(): Map<string, string> {
    return this.#store
  }
}
