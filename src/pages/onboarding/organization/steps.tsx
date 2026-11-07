import { Building2, Globe, Mail, Pencil, Phone, User as UserIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { focusRing, softPanel } from '../../../components/auth/styles'
import type { FieldErrors } from '../../../components/driverDraft'
import { AddressPicker } from '../../../components/form/AddressPicker'
import { FieldMessage } from '../../../components/form/FieldMessage'
import { TextAreaField } from '../../../components/form/TextAreaField'
import { TextField } from '../../../components/form/TextField'
import { CheckCard } from '../../../components/onboarding/CheckCard'
import { label as labelClass } from '../../../components/ui'
import {
  AVAILABILITY_LABEL,
  ORG_KINDS,
  PLATFORM_INTERESTS,
  SERVICE_CATEGORIES,
  labelOf,
  type Availability,
} from '../../../onboarding/options'
import { MAX_DESCRIPTION, normalizeWebsite, type OrganizationDraft } from '../../../onboarding/organizationDraft'

export interface StepProps {
  draft: OrganizationDraft
  update: (patch: Partial<OrganizationDraft>) => void
  errors: FieldErrors
  goTo: (stepId: string) => void
}

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((i) => i !== item) : [...list, item]
}

const RequiredNote = () => <p className="mb-6 text-sm text-slate-500">All fields are required unless marked optional.</p>

// ---- Step 1: who the organization is

export function IdentityStep({ draft, update, errors }: StepProps) {
  return (
    <div className="space-y-6">
      <RequiredNote />
      <TextField
        id="orgName"
        label="Organization name"
        autoComplete="organization"
        icon={<Building2 className="h-5 w-5" />}
        placeholder="e.g. Belkin House"
        value={draft.orgName}
        error={errors.orgName}
        onChange={(e) => update({ orgName: e.target.value })}
        autoFocus
      />

      <fieldset aria-describedby="kind-message">
        <legend className={labelClass}>Organization type</legend>
        <div className="grid gap-2.5 sm:grid-cols-2" data-invalid={errors.kind ? 'true' : undefined}>
          {ORG_KINDS.map((k) => {
            const on = draft.kind === k.value
            return (
              <label
                key={k.value}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border bg-white p-3.5 transition has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-rc-blue has-[:focus-visible]:ring-offset-2 ${
                  on ? 'border-rc-blue shadow-[0_0_0_1px_var(--color-rc-blue)]' : 'border-rc-line hover:border-slate-300'
                } ${k.value === 'OTHER' ? 'sm:col-span-2' : ''}`}
              >
                <input
                  type="radio"
                  name="kind"
                  value={k.value}
                  checked={on}
                  onChange={() => update({ kind: k.value })}
                  aria-invalid={errors.kind && !draft.kind ? true : undefined}
                  className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-rc-blue)]"
                />
                <span>
                  <span className="block text-sm font-semibold text-rc-navy">{k.label}</span>
                  <span className="block text-[13px] text-slate-500">{k.description}</span>
                </span>
              </label>
            )
          })}
        </div>
        <FieldMessage id="kind-message" error={errors.kind} />
      </fieldset>

      <AddressPicker
        id="address"
        label="Primary location"
        hint="Where your organization works from. Rides you request start here."
        value={draft.address}
        selected={Boolean(draft.placeId)}
        error={errors.address}
        onQueryChange={(address) => update({ address, placeId: undefined })}
        onSelect={(place) => update({ address: place.address, city: place.city, placeId: place.id })}
      />

      <TextField
        id="website"
        label="Website"
        optional
        type="url"
        inputMode="url"
        autoComplete="url"
        icon={<Globe className="h-5 w-5" />}
        placeholder="example.org"
        value={draft.website}
        error={errors.website}
        onChange={(e) => update({ website: e.target.value })}
        onBlur={() => draft.website.trim() && update({ website: normalizeWebsite(draft.website) })}
      />

      <TextAreaField
        id="description"
        label="Short description"
        hint="Who you serve and how, in a sentence or two. This helps our team review your application."
        maxLength={MAX_DESCRIPTION}
        value={draft.description}
        error={errors.description}
        onChange={(e) => update({ description: e.target.value })}
      />
    </div>
  )
}

// ---- Step 2: how to reach them

export function ContactStep({ draft, update, errors }: StepProps) {
  return (
    <div className="space-y-6">
      <RequiredNote />
      <p className={`${softPanel} text-sm text-slate-600`}>We've filled in what we know from your account. Change anything that's different.</p>
      <div className="grid gap-6 sm:grid-cols-2">
        <TextField
          id="contactName"
          label="Primary contact name"
          autoComplete="name"
          icon={<UserIcon className="h-5 w-5" />}
          value={draft.contactName}
          error={errors.contactName}
          onChange={(e) => update({ contactName: e.target.value })}
          autoFocus
        />
        <TextField
          id="contactRole"
          label="Role or position"
          autoComplete="organization-title"
          placeholder="e.g. Program coordinator"
          value={draft.contactRole}
          error={errors.contactRole}
          onChange={(e) => update({ contactRole: e.target.value })}
        />
      </div>
      <TextField
        id="contactEmail"
        label="Professional email"
        type="email"
        inputMode="email"
        autoComplete="email"
        icon={<Mail className="h-5 w-5" />}
        hint="Where our team writes about your application. It isn't shown to drivers."
        value={draft.contactEmail}
        error={errors.contactEmail}
        onChange={(e) => update({ contactEmail: e.target.value })}
      />
      <TextField
        id="contactPhone"
        label="Phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        icon={<Phone className="h-5 w-5" />}
        placeholder="604-555-0123"
        hint="Your front desk or main line. Drivers call it if they can't find someone at pickup."
        value={draft.contactPhone}
        error={errors.contactPhone}
        onChange={(e) => update({ contactPhone: e.target.value })}
      />
    </div>
  )
}

// ---- Step 3: the work they do

export function ServicesStep({ draft, update, errors }: StepProps) {
  return (
    <fieldset aria-describedby="serviceCategories-message">
      <legend className="mb-4 text-sm text-slate-600">Choose all that apply.</legend>
      <div className="grid gap-3 sm:grid-cols-2" data-invalid={errors.serviceCategories ? 'true' : undefined}>
        {SERVICE_CATEGORIES.map((c) => (
          <CheckCard
            key={c.value}
            checked={draft.serviceCategories.includes(c.value)}
            onChange={() => update({ serviceCategories: toggle(draft.serviceCategories, c.value) })}
            title={c.label}
            icon={<c.icon className="h-5 w-5" />}
          />
        ))}
      </div>
      <FieldMessage id="serviceCategories-message" error={errors.serviceCategories} />
      <p className="mt-6 text-sm text-slate-500">This describes your organization for our team and partners. It doesn't change what you can do on Relay Collective.</p>
    </fieldset>
  )
}

// ---- Step 4: what they'd use

function AvailabilityBadge({ availability }: { availability: Availability }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
        availability === 'live' ? 'bg-rc-mint text-rc-teal-ink' : 'bg-slate-100 text-slate-600'
      }`}
    >
      {AVAILABILITY_LABEL[availability]}
    </span>
  )
}

export function InterestsStep({ draft, update }: StepProps) {
  return (
    <fieldset>
      <legend className="mb-4 text-sm text-slate-600">Optional. Choose any that would help.</legend>
      <div className="space-y-3">
        {PLATFORM_INTERESTS.map((p) => (
          <CheckCard
            key={p.value}
            checked={draft.platformInterests.includes(p.value)}
            onChange={() => update({ platformInterests: toggle(draft.platformInterests, p.value) })}
            title={p.label}
            description={p.description}
            icon={<p.icon className="h-5 w-5" />}
            badge={<AvailabilityBadge availability={p.availability} />}
          />
        ))}
      </div>
      <p className={`${softPanel} mt-6 text-sm text-slate-600`}>
        <strong className="text-rc-navy">Transportation coordination</strong> is available to approved organizations today. Planned capabilities aren't
        built yet: choosing them tells us what to build next, and we'll let you know when they're ready.
      </p>
    </fieldset>
  )
}

// ---- Step 5: review

function ReviewSection({ title, stepId, goTo, rows }: { title: string; stepId: string; goTo: (id: string) => void; rows: [string, ReactNode][] }) {
  return (
    <section className="rounded-xl border border-rc-line bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-rc-line px-5 py-3">
        <h2 className="font-heading text-base font-bold text-rc-navy">{title}</h2>
        <button
          type="button"
          onClick={() => goTo(stepId)}
          className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-rc-blue hover:bg-brand-50 ${focusRing}`}
          aria-label={`Edit ${title.toLowerCase()}`}
        >
          <Pencil className="h-4 w-4" aria-hidden /> Edit
        </button>
      </div>
      <dl className="grid gap-x-6 gap-y-2.5 px-5 py-4 text-sm sm:grid-cols-[9.5rem_minmax(0,1fr)]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-slate-500">{k}</dt>
            <dd className="break-words font-medium text-rc-navy">{v || '—'}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function ReviewStep({ draft, update, errors, goTo }: StepProps) {
  return (
    <div className="space-y-4">
      <ReviewSection
        title="Organization"
        stepId="identity"
        goTo={goTo}
        rows={[
          ['Name', draft.orgName],
          ['Type', draft.kind && labelOf(ORG_KINDS, draft.kind)],
          ['Location', [draft.address, draft.city].filter(Boolean).join(', ')],
          ['Website', draft.website ? normalizeWebsite(draft.website) : 'Not added'],
          ['Description', <span className="whitespace-pre-line font-normal text-slate-700">{draft.description}</span>],
        ]}
      />
      <ReviewSection
        title="Contact"
        stepId="contact"
        goTo={goTo}
        rows={[
          ['Contact', `${draft.contactName}, ${draft.contactRole}`],
          ['Email', draft.contactEmail],
          ['Phone', draft.contactPhone],
        ]}
      />
      <ReviewSection
        title="Work and interests"
        stepId="services"
        goTo={goTo}
        rows={[
          ['Services', draft.serviceCategories.map((c) => labelOf(SERVICE_CATEGORIES, c)).join(', ')],
          ['Interested in', draft.platformInterests.map((p) => labelOf(PLATFORM_INTERESTS, p)).join(', ') || 'Nothing selected'],
        ]}
      />

      <div className="rounded-xl bg-rc-navy p-5 text-white">
        <h2 className="font-heading text-base font-bold text-white">What happens next</h2>
        <ol className="mt-3 space-y-2 text-sm text-white/80">
          <li>1. The Relay Collective team reviews your application.</li>
          <li>2. Until then, your workspace is limited: you can look around and add destinations, but not request rides.</li>
          <li>3. Once approved, your team can request rides and invite colleagues.</li>
        </ol>
      </div>

      <label
        className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-rc-blue has-[:focus-visible]:ring-offset-2 ${
          errors.acknowledged ? 'border-red-300 bg-red-50/50' : 'border-rc-line'
        }`}
      >
        <input
          type="checkbox"
          checked={draft.acknowledged}
          onChange={(e) => update({ acknowledged: e.target.checked })}
          aria-invalid={errors.acknowledged ? true : undefined}
          aria-describedby="acknowledged-message"
          className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-rc-blue)]"
        />
        <span className="text-sm text-slate-700">
          I'm authorized to register this organization, and the details above are accurate. I understand Relay Collective reviews every application
          before it's approved.
        </span>
      </label>
      <FieldMessage id="acknowledged-message" error={errors.acknowledged} />
    </div>
  )
}
