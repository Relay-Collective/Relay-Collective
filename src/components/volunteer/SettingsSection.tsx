import type { ReactNode } from 'react'
import { panel, panelHead, panelTitle } from '../workspace/styles'

// One titled group of settings or profile fields
export function SettingsSection({ id, icon, title, description, children }: { id: string; icon: ReactNode; title: string; description: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className={panel}>
      <div className={`${panelHead} items-start`}>
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rc-mint text-rc-teal-ink" aria-hidden>
            {icon}
          </span>
          <div>
            <h2 id={id} className={panelTitle}>
              {title}
            </h2>
            <p className="text-sm text-slate-600">{description}</p>
          </div>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}
