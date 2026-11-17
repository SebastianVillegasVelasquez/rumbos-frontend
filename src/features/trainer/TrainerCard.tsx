import { forwardRef, type ReactNode } from 'react'
import { esTrainer } from '../../i18n/trainer.es.ts'

// The card every trainer screen shares: the welcome flow's card (navy header with
// a yellow edge, a body that scrolls inside, a footer that stays put), so the
// primary action is always reachable. Nothing here enters the top-right corner the
// host keeps for its exit control (the header pads right on narrow windows).

export const Banner = ({ children, tone }: { children: ReactNode; tone: 'sun' | 'danger' }) => (
  <p
    role={tone === 'danger' ? 'alert' : 'note'}
    className={`flex-none px-[var(--flow-pad)] py-2 text-sm font-semibold ${
      tone === 'danger' ? 'bg-danger-tint text-danger' : 'bg-sun-tint text-sun-dark'
    }`}
  >
    {children}
  </p>
)

interface TrainerCardProps {
  // The title takes the focus when a screen opens.
  title: string
  // A small line over the title (the step count, the lesson).
  kicker?: string
  preview?: boolean
  banner?: ReactNode
  busy?: boolean
  children: ReactNode
  footer: ReactNode
  wide?: boolean
}

export const TrainerCard = forwardRef<HTMLHeadingElement, TrainerCardProps>(
  (
    { title, kicker, preview = false, banner, busy = false, children, footer, wide = true },
    ref
  ) => (
    <div className="flow-stage relative">
      <section
        className="flow-card"
        data-wide={wide}
        aria-labelledby="trainer-title"
        aria-busy={busy}
      >
        <header className="flow-card-head">
          {kicker && <p className="text-sm font-bold">{kicker}</p>}
          <h2
            id="trainer-title"
            ref={ref}
            tabIndex={-1}
            className="font-heading text-xl font-extrabold outline-none"
          >
            {title}
          </h2>
        </header>
        {preview && <Banner tone="sun">{esTrainer.preview}</Banner>}
        {banner}
        <div className="flow-card-scroll">
          <div className="flow-pad flex flex-col gap-4">{children}</div>
        </div>
        <footer className="flow-card-foot justify-between">{footer}</footer>
      </section>
    </div>
  )
)
TrainerCard.displayName = 'TrainerCard'
