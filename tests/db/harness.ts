import { PGlite, type Transaction } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// A fresh embedded Postgres with every migration applied, for testing access rules against the real SQL.
// Supabase's own schemas (auth, storage, the API roles) come from supabase-stub.sql.

const ROOT = fileURLToPath(new URL('../../', import.meta.url))

// Supabase Cron isn't available here; the deadline job it schedules isn't part of these tests
function withoutCron(sql: string): string {
  return sql.replace(/^create extension if not exists pg_cron.*$/m, '').replace(/^select cron\.schedule\(.*$/m, '')
}

export async function migratedDatabase(): Promise<PGlite> {
  const db = new PGlite()
  await db.exec(readFileSync(`${ROOT}tests/db/supabase-stub.sql`, 'utf8'))
  for (const file of readdirSync(`${ROOT}supabase/migrations`).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(withoutCron(readFileSync(`${ROOT}supabase/migrations/${file}`, 'utf8')))
  }
  return db
}

export interface Actor {
  authUserId?: string // signed out when missing
}

// Runs a query the way PostgREST would for this person: as anon or authenticated, with their JWT subject.
// Each call is its own transaction, so a refused statement leaves nothing behind.
export async function as<T>(db: PGlite, actor: Actor, run: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [actor.authUserId ?? ''])
    await tx.exec(actor.authUserId ? 'set local role authenticated' : 'set local role anon')
    return run(tx)
  })
}

// The message Postgres (or one of our functions) refused with
export async function refusal(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (err) {
    return (err as Error).message
  }
  throw new Error('Expected the database to refuse, but it allowed it')
}
