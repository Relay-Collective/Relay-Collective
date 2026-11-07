import { Info, KeyRound } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { USER_KIND } from '../../admin/labels'
import { adminPaths } from '../../admin/paths'
import { Breadcrumbs } from '../../components/admin/controls'
import { secondaryButton } from '../../components/ui'
import { PageHeader } from '../../components/workspace/PageHeader'
import { EmptyState, SectionError, SkeletonRows } from '../../components/workspace/states'
import { compactButton, panel } from '../../components/workspace/styles'
import { useAdmin } from '../../hooks/useAdmin'
import { useApp } from '../../hooks/useApp'
import { ResetPanel } from './AccountActions'
import { AccountDangerZone } from './AccountDangerZone'
import { AccountProfile } from './AccountDetails'

// One account, with the help a platform admin can give: a password reset, or (in the Danger Zone) deleting it for good
export function UserDetail() {
  const { id = '' } = useParams()
  const { currentUser, refresh } = useApp()
  const { accounts, orgName } = useAdmin()
  const navigate = useNavigate()
  const [resetting, setResetting] = useState(false)
  const user = accounts.data?.find((u) => u.id === id)
  const isSelf = user?.id === currentUser?.id

  const crumbs = [{ label: 'Users', to: adminPaths.users }, { label: user?.name ?? 'User' }]

  if (!user) {
    return (
      <div>
        <Breadcrumbs items={crumbs} />
        <div className={panel}>
          {!accounts.data ? (
            accounts.error ? <SectionError message="We couldn't load this account. Please try again." /> : <SkeletonRows rows={4} label="Loading account" />
          ) : (
            // A permanently deleted account is gone from the list: nothing here is rebuilt from what a tab remembers
            <EmptyState
              icon={<Info className="h-6 w-6" />}
              title="Account not available"
              text="This account doesn’t exist, or it was permanently deleted. Check the link, or go back to Users."
            />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs items={crumbs} />
        <PageHeader
          title={
            <>
              {user.name}
              {isSelf && <span className="ml-2 text-base font-normal text-slate-500">(you)</span>}
            </>
          }
          description={[USER_KIND[user.role], orgName(user.orgId)].filter(Boolean).join(' · ')}
          actions={
            !resetting &&
            !user.deletionStatus && (
              <button type="button" className={`${secondaryButton} ${compactButton}`} onClick={() => setResetting(true)}>
                <KeyRound className="h-4 w-4" aria-hidden /> Reset password
              </button>
            )
          }
        />
        {resetting && <ResetPanel user={user} isSelf={isSelf} onClose={() => setResetting(false)} />}
      </div>
      <AccountProfile user={user} />
      <AccountDangerZone
        user={user}
        isSelf={isSelf}
        onChanged={refresh}
        onDeleted={() => {
          refresh()
          navigate(adminPaths.users, { replace: true, state: { deleted: user.name } })
        }}
      />
    </div>
  )
}
