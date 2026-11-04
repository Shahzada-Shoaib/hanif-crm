import { Badge } from '@/components/ui/badge'
import type { CurrentUser } from '@/types'

export default function UserStatusBadge({ user }: { user: CurrentUser }) {
  if (user.status === 'disabled') return <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-500">Disabled</Badge>
  const label = user.role === 'super_admin' ? 'Super admin' : user.role === 'admin' ? 'Admin' : 'User'
  const style = user.role === 'super_admin'
    ? 'border-blue-200 bg-blue-50 text-trust'
    : user.role === 'admin'
      ? 'border-teal/20 bg-teal/10 text-teal'
      : 'border-slate-200 bg-white text-slate-600'
  return <Badge variant="outline" className={style}>{label}</Badge>
}
