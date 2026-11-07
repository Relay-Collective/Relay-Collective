import { Check, Eye, EyeOff, Lock } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../../hooks/useApp'
import { dataService } from '../../services'
import { MAX_DIRECTORY_DESCRIPTION } from '../../services/dataService'
import type { OrgDiscoverability, Organization } from '../../types'
import { Notice } from '../admin/controls'
import { TextAreaField } from '../form/TextAreaField'
import { primaryButton } from '../ui'
import { Skeleton } from '../workspace/states'
import { compactButton, panel, panelHead, panelTitle } from '../workspace/styles'

const OPTIONS: { value: OrgDiscoverability; label: string; text: string; icon: typeof Eye }[] = [
  {
    value: 'discoverable',
    label: 'Discoverable',
    text: 'Your approved organization can appear in Relay Collective’s organization search.',
    icon: Eye,
  },
  {
    value: 'invitation_only',
    label: 'Invitation Only',
    text: 'People can join your organization only through an authorized invitation.',
    icon: EyeOff,
  },
]

// Organization Visibility: whether people can find the organization and ask to join. Administrators change
// it; everyone else sees the current setting. Members already on the team are unaffected either way.
export function OrganizationVisibilitySettings({ org, isAdmin }: { org: Organization | undefined; isAdmin: boolean }) {
  const { refresh } = useApp()
  const [draft, setDraft] = useState<{ orgId: string; value: OrgDiscoverability; description: string }>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [saved, setSaved] = useState(false)

  // Start from what's saved, and again whenever another administrator changes it
  const savedValue = org?.discoverability ?? 'invitation_only'
  const savedDescription = org?.directoryDescription ?? ''
  const current = draft && draft.orgId === org?.id ? draft : org && { orgId: org.id, value: savedValue, description: savedDescription }
  const approved = org?.status === 'APPROVED'
  const changed = !!current && (current.value !== savedValue || current.description.trim() !== savedDescription)

  async function save() {
    if (!current || busy) return
    setBusy(true)
    setError(undefined)
    setSaved(false)
    try {
      await dataService.setOrganizationVisibility(current.value, current.description)
      setDraft(undefined)
      setSaved(true)
      refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="visibility-title" className={panel}>
      <div className={panelHead}>
        <h2 id="visibility-title" className={`${panelTitle} flex items-center gap-2`}>
          <Eye className="h-4 w-4 text-rc-teal-ink" aria-hidden /> Organization Visibility
        </h2>
      </div>
      <div className="space-y-4 px-5 py-4">
        <p className="text-sm text-slate-600">Choose whether people can find your organization and request to join its workspace.</p>
        {!current ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <>
            <fieldset disabled={!isAdmin || busy}>
              <legend className="sr-only">Who can find your organization</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {OPTIONS.map((o) => {
                  const on = current.value === o.value
                  const locked = o.value === 'discoverable' && !approved
                  return (
                    <label
                      key={o.value}
                      className={`flex flex-col rounded-xl border p-3.5 transition has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-rc-blue has-[:focus-visible]:ring-offset-2 ${
                        on ? 'border-rc-blue bg-brand-50/40 shadow-[0_0_0_1px_var(--color-rc-blue)]' : 'border-slate-200'
                      } ${isAdmin && !locked ? 'cursor-pointer hover:border-slate-300' : 'cursor-default'} ${locked ? 'opacity-60' : ''}`}
                    >
                      <input
                        type="radio"
                        name="discoverability"
                        value={o.value}
                        checked={on}
                        disabled={locked}
                        onChange={() => {
                          setDraft({ ...current, value: o.value })
                          setSaved(false)
                        }}
                        className="sr-only"
                      />
                      <span className="flex items-center gap-2 font-semibold text-rc-navy">
                        <o.icon className={`h-4 w-4 ${on ? 'text-rc-blue' : 'text-slate-500'}`} aria-hidden />
                        {o.label}
                        {on && <Check className="ml-auto h-4 w-4 text-rc-blue" aria-hidden />}
                      </span>
                      <span className="mt-1 text-sm text-slate-600">{o.text}</span>
                    </label>
                  )
                })}
              </div>
            </fieldset>
            {!approved && (
              <p className="flex items-start gap-2 text-sm text-slate-500">
                <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                Your organization can be found in search once Relay Collective approves it.
              </p>
            )}
            {current.value === 'discoverable' && (
              <TextAreaField
                id="directory-description"
                label="Description in search"
                optional
                rows={2}
                maxLength={MAX_DIRECTORY_DESCRIPTION}
                disabled={!isAdmin || busy}
                hint="A sentence about what you do, shown to people searching. Don’t include private addresses or client details."
                value={current.description}
                onChange={(e) => {
                  setDraft({ ...current, description: e.target.value })
                  setSaved(false)
                }}
              />
            )}
            {isAdmin ? (
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className={`${primaryButton} ${compactButton}`} disabled={!changed || busy} onClick={() => void save()}>
                  {busy ? 'Saving…' : 'Save visibility'}
                </button>
                {saved && !changed && (
                  <span role="status" className="text-sm font-medium text-emerald-700">
                    Saved.
                  </span>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Only your organization’s administrators can change this.</p>
            )}
            {error && <Notice tone="error">{error}</Notice>}
          </>
        )}
      </div>
    </section>
  )
}
