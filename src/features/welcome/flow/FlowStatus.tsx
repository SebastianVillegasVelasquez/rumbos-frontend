import type { ReactNode } from 'react'

// One pattern for every status the flow shows (what Continuar waits for, the
// video exit, a quiz result): an icon, then text. Never color alone. `role` is
// left to the caller because only some of these are live announcements.
export const FlowStatus = ({
  icon,
  children,
  id,
  role,
  className = '',
}: {
  icon: ReactNode
  children: ReactNode
  id?: string
  role?: 'status'
  className?: string
}) => (
  <div id={id} role={role} className={`flex items-start gap-2 text-sm font-semibold ${className}`}>
    <span aria-hidden className="mt-0.5 shrink-0">
      {icon}
    </span>
    <span className="min-w-0 break-words">{children}</span>
  </div>
)
