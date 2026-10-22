'use client'
// The plan chosen on the signup page is shared by the ink aside (chips) and the
// card (default profile, CTA): one client store around the server-rendered
// AuthShell, so switching the plan never leaves the page.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { SignupPlan } from './signup-plans'

interface PlanStore { plans: SignupPlan[]; plan: SignupPlan | null; choose: (code: string) => void; locked: boolean; /** Freeze the chips once the account exists (step 2 on). */ lock: () => void }

const Ctx = createContext<PlanStore>({ plans: [], plan: null, choose: () => {}, locked: true, lock: () => {} })

export function SignupPlanProvider({ plans, initialCode, locked: initialLocked = false, children }: { plans: SignupPlan[]; initialCode: string | null; locked?: boolean; children: ReactNode }) {
  const [code, setCode] = useState<string | null>(initialCode)
  const [locked, setLocked] = useState(initialLocked)
  const lock = useCallback(() => setLocked(true), [])
  const choose = useCallback((next: string) => {
    setCode(next)
    try { const url = new URL(window.location.href); url.searchParams.set('plan', next); window.history.replaceState(null, '', url) } catch { /* no URL to keep */ }
  }, [])
  const value = useMemo<PlanStore>(() => ({ plans, plan: plans.find((p) => p.code === code) ?? null, choose, locked, lock }), [plans, code, choose, locked, lock])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSignupPlan(): PlanStore {
  return useContext(Ctx)
}
