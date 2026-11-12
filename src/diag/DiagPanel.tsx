import { useEffect, useState } from 'react'
import { es } from '../i18n/es.ts'
import { diagRows, type DiagEnv } from './diagSnapshot.ts'
import { readEnv } from './readEnv.ts'
import VideoEventProbe from './VideoEventProbe.tsx'

const text = es.diag

// Read-only: it measures the page and prints it. No request, no storage, no
// message to anyone; the viewer sends a screenshot if they want to.
const DiagPanel = () => {
  const [env, setEnv] = useState<DiagEnv>(readEnv)
  const [open, setOpen] = useState(true)

  useEffect(() => {
    const update = () => setEnv(readEnv())
    window.addEventListener('resize', update)
    const timer = window.setInterval(update, 1000)
    return () => {
      window.removeEventListener('resize', update)
      window.clearInterval(timer)
    }
  }, [])

  if (!open) return null
  return (
    <section
      aria-label={text.title}
      className="fixed bottom-2 left-2 z-[2147483000] max-h-[60vh] max-w-[min(26rem,calc(100vw-1rem))] overflow-auto rounded-md border-2 border-black bg-white p-2 font-mono text-[11px] leading-snug text-black shadow-lg"
    >
      <div className="flex items-center justify-between gap-2">
        <strong>{text.title}</strong>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="min-h-[28px] rounded border border-black px-2 font-bold"
        >
          {text.close}
        </button>
      </div>
      <p className="my-1 font-sans">{text.hint}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-2">
        {diagRows(env).map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="font-bold">{label}</dt>
            <dd className="break-words">{value}</dd>
          </div>
        ))}
      </dl>
      <VideoEventProbe />
    </section>
  )
}

export default DiagPanel
