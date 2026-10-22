// Dev-only stand-in for the Moodle plugin (format_rumbos): embeds the app in an
// iframe and speaks the host side of the postMessage protocol (docs/EMBED.md).
// It is not part of the production build (it is not a Vite input).
import { encodeMockAssertion } from '../src/features/embed/mockAssertion.ts'

type Availability = 'available' | 'restricted' | 'hidden' | 'unavailable' | 'missing'
type Completion = 'none' | 'incomplete' | 'complete' | 'failed'

interface Row {
  cmid: number
  name: string
  modname: string
  sectionId: number
  availability: Availability
  info: string
  completion: Completion
}

// The same activities the mock API knows (cmids 101-109).
const rows: Row[] = [
  [101, 'Quiz de introducción', 'quiz', 1, 'available', 'complete'],
  [102, 'Video de bienvenida', 'url', 1, 'available', 'complete'],
  [103, 'Taller 1: configuración del entorno', 'assign', 2, 'available', 'incomplete'],
  [104, 'Guía del curso', 'resource', 2, 'available', 'none'],
  [105, 'Quiz de mitad de curso', 'quiz', 3, 'restricted', 'none'],
  [106, 'Grabación: Semana 3', 'url', 3, 'available', 'failed'],
  [107, 'Entrega de proyecto final', 'assign', 4, 'hidden', 'none'],
  [108, 'Certificado del curso', 'customcert', 4, 'unavailable', 'none'],
  [109, 'Contenido SCORM: fundamentos', 'scorm', 2, 'available', 'none'],
].map(([cmid, name, modname, sectionId, availability, completion]) => ({
  cmid: cmid as number,
  name: name as string,
  modname: modname as string,
  sectionId: sectionId as number,
  availability: availability as Availability,
  info: availability === 'restricted' ? 'Disponible cuando completes «Taller 1».' : '',
  completion: completion as Completion,
}))

const sections = [1, 2, 3, 4].map((n) => ({ id: n, number: n, name: `Semana ${n}` }))

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

const config = {
  role: 'student' as 'student' | 'editor',
  courseId: 1,
  autoPush: true,
  // Moodle's editing mode; an editor gets host-init mode "editor" only while it is on.
  editing: true,
  tokenTtl: 900,
  tenantDisabled: false,
  wrongTenantHost: false,
  gone: false,
  frameSize: 'desktop' as 'desktop' | 'phone' | 'tablet',
  // Contract v5.4: "absent" plays a plugin that predates it.
  completionEnabled: 'true' as 'true' | 'false' | 'absent',
}

const alias = location.hostname === 'localhost' ? '127.0.0.1' : 'localhost'
const defaultAppUrl = `${location.protocol}//${alias}:${location.port}/embed`

let appUrl = defaultAppUrl
let hostParam = location.origin
let iframe: HTMLIFrameElement | null = null

const appOrigin = () => new URL(appUrl, location.href).origin

// ---- Log ------------------------------------------------------------------------

const logEl = $('log')
const log = (direction: string, message: unknown) => {
  const record = message as Record<string, unknown>
  const summary =
    typeof record === 'object' && record
      ? Object.entries(record)
          .filter(([key]) => key !== 'type' && key !== 'v')
          .map(([key, value]) =>
            key === 'assertion'
              ? 'assertion=[opaque]'
              : key === 'state'
                ? 'state=[CourseState]'
                : `${key}=${JSON.stringify(value)}`
          )
          .join(' ')
      : String(message)
  const line = document.createElement('div')
  line.textContent = `${new Date().toLocaleTimeString()} ${direction} ${String(record?.type ?? '?')} ${summary}`
  logEl.append(line)
  logEl.scrollTop = logEl.scrollHeight
}

// ---- CourseState ------------------------------------------------------------------

const buildState = () => {
  const activities = []
  const unavailableCmids: number[] = []
  for (const row of rows) {
    if (row.availability === 'missing') continue
    // Students cannot see hidden activities at all; editors see "hidden" ones
    // and an "unavailable" activity shows up to them as hidden.
    const cannotSee =
      row.availability === 'unavailable' ||
      (row.availability === 'hidden' && config.role === 'student')
    if (cannotSee && config.role === 'student') {
      unavailableCmids.push(row.cmid)
      continue
    }
    activities.push(
      toHostActivity(row, row.availability === 'unavailable' ? 'hidden' : row.availability)
    )
  }
  return {
    schemaVersion: 1,
    courseId: config.courseId,
    generatedAt: new Date().toISOString(),
    sections,
    activities,
    unavailableCmids,
    ...(config.completionEnabled === 'absent'
      ? {}
      : { courseCompletionEnabled: config.completionEnabled === 'true' }),
  }
}

const toHostActivity = (row: Row, availability: string) => ({
  cmid: row.cmid,
  name: row.name,
  modname: row.modname,
  sectionId: row.sectionId,
  url: `https://moodle.example/mod/${row.modname}/view.php?id=${row.cmid}`,
  availability,
  availabilityInfo: availability === 'restricted' ? row.info || null : null,
  completion: row.completion,
})

// ---- Messaging --------------------------------------------------------------------

const assertion = () =>
  encodeMockAssertion({
    role: config.role,
    course: config.courseId,
    host: config.wrongTenantHost ? 'https://evil.example' : location.origin,
    jti: crypto.randomUUID(),
    exp: Math.floor(Date.now() / 1000) + 60,
    ttl: config.tokenTtl,
    tenantDisabled: config.tenantDisabled,
  })

const send = (message: Record<string, unknown>) => {
  if (!iframe?.contentWindow) return
  log('host→app', message)
  iframe.contentWindow.postMessage(message, appOrigin())
}

const pushState = () => send({ type: 'rumbos:host-state', v: 1, state: buildState() })

window.addEventListener('message', (event) => {
  if (!iframe || event.source !== iframe.contentWindow || event.origin !== appOrigin()) return
  const data = event.data as Record<string, unknown> | null
  if (config.gone) {
    log('app→host', { ...data, ignored: 'host is gone' })
    return
  }
  log('app→host', data)
  switch (data?.type) {
    case 'rumbos:embed-ready':
      send({
        type: 'rumbos:host-init',
        v: 1,
        mode: config.role === 'editor' && config.editing ? 'editor' : 'student',
        locale: 'es',
        courseId: config.courseId,
        assertion: assertion(),
        state: buildState(),
      })
      return
    case 'rumbos:request-state':
      pushState()
      return
    case 'rumbos:request-launch':
      send({ type: 'rumbos:host-launch', v: 1, assertion: assertion() })
      return
    case 'rumbos:open-activity': {
      const row = rows.find((item) => item.cmid === data.cmid)
      const note = row
        ? `Would open https://moodle.example/mod/${row.modname}/view.php?id=${row.cmid}`
        : `Unknown cmid ${String(data.cmid)}: nothing to open`
      log('host', { type: 'note', text: note })
      return
    }
    case 'rumbos:open-activity-settings': {
      // Contract v5.4: editor mode only, and the cmid must be in the last state.
      const row = rows.find((item) => item.cmid === data.cmid)
      const allowed = config.role === 'editor' && config.editing && row
      log('host', {
        type: 'note',
        text: allowed
          ? `Would open https://moodle.example/course/modedit.php?update=${row.cmid} in a new tab`
          : `Refused open-activity-settings for ${String(data.cmid)} (needs an editor and a known cmid)`,
      })
      return
    }
    case 'rumbos:request-fullscreen':
      setFullscreen(data.on === true)
      return
    case 'rumbos:error':
      $('fallback').style.display = 'block'
      $('fallback').textContent =
        `The plugin would now fall back to the standard course content (code: ${String(data.code)}).`
      return
  }
})

// ---- Fullscreen (contract v5.4) ----------------------------------------------------
// While fullscreen the host owns the exit: a 64x64 control in the top-right
// corner, above the app, and Escape. The app only follows host-fullscreen.

let exitControl: HTMLButtonElement | null = null

const setFullscreen = (on: boolean) => {
  $('frame-wrap').classList.toggle('fullscreen', on)
  if (on && !exitControl) {
    exitControl = Object.assign(document.createElement('button'), {
      textContent: 'Exit',
      title: 'Host exit control (top-right 64x64)',
      onclick: () => setFullscreen(false),
    })
    exitControl.style.cssText =
      'position:fixed;top:0;right:0;width:64px;height:64px;z-index:200;background:#12284a;color:#fff;border:0;font:700 14px system-ui;cursor:pointer'
    document.body.append(exitControl)
  }
  if (!on) {
    exitControl?.remove()
    exitControl = null
  }
  send({ type: 'rumbos:host-fullscreen', v: 1, on })
}

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && exitControl) setFullscreen(false)
})

// ---- Frame ----------------------------------------------------------------------------

const frameStyle = () => {
  const wrap = $('frame-wrap')
  wrap.style.width =
    config.frameSize === 'phone' ? '390px' : config.frameSize === 'tablet' ? '820px' : '100%'
  wrap.style.maxWidth = '100%'
  wrap.style.height = config.frameSize === 'desktop' ? '640px' : '80dvh'
  wrap.style.minHeight = '320px'
}

const mountFrame = () => {
  $('fallback').style.display = 'none'
  $('frame-wrap').classList.remove('fullscreen')
  const url = new URL(appUrl, location.href)
  url.searchParams.set('host', hostParam)
  const next = document.createElement('iframe')
  next.title = 'Rumbos'
  next.allow = 'fullscreen'
  next.src = url.toString()
  $('frame-wrap').replaceChildren(next)
  iframe = next
  config.gone = false
  frameStyle()
  log('host', { type: 'note', text: `iframe → ${url.origin}${url.pathname}?host=${hostParam}` })
}

// ---- Controls ----------------------------------------------------------------------------

const button = (label: string, onClick: () => void) => {
  const element = document.createElement('button')
  element.type = 'button'
  element.textContent = label
  element.addEventListener('click', onClick)
  return element
}

const labelled = (text: string, control: HTMLElement) => {
  const label = document.createElement('label')
  label.append(text, control)
  return label
}

const select = <T extends string>(
  options: readonly T[],
  value: T,
  onChange: (value: T) => void
) => {
  const element = document.createElement('select')
  for (const option of options) element.append(new Option(option, option, false, option === value))
  element.addEventListener('change', () => onChange(element.value as T))
  return element
}

const checkbox = (checked: boolean, onChange: (checked: boolean) => void) => {
  const element = document.createElement('input')
  element.type = 'checkbox'
  element.checked = checked
  element.addEventListener('change', () => onChange(element.checked))
  return element
}

const buildControls = () => {
  const controls = $('controls')

  const session = document.createElement('fieldset')
  session.append(
    Object.assign(document.createElement('legend'), { textContent: 'Session' }),
    labelled(
      'role',
      select(['student', 'editor'] as const, config.role, (value) => {
        config.role = value
        mountFrame()
      })
    ),
    labelled(
      'editing on',
      checkbox(config.editing, (value) => {
        config.editing = value
        mountFrame()
      })
    ),
    labelled(
      'course',
      Object.assign(document.createElement('input'), {
        type: 'number',
        value: String(config.courseId),
        style: 'width: 4rem',
        onchange: (event: Event) => {
          config.courseId = Number((event.target as HTMLInputElement).value) || 1
        },
      })
    ),
    labelled(
      'token ttl (s)',
      Object.assign(document.createElement('input'), {
        type: 'number',
        value: String(config.tokenTtl),
        style: 'width: 4rem',
        onchange: (event: Event) => {
          config.tokenTtl = Number((event.target as HTMLInputElement).value) || 900
        },
      })
    ),
    labelled(
      'tenant disabled',
      checkbox(config.tenantDisabled, (value) => (config.tenantDisabled = value))
    ),
    labelled(
      'backend knows another host',
      checkbox(config.wrongTenantHost, (value) => (config.wrongTenantHost = value))
    ),
    labelled(
      'app URL',
      Object.assign(document.createElement('input'), {
        value: appUrl,
        style: 'width: 22rem',
        onchange: (event: Event) => {
          appUrl = (event.target as HTMLInputElement).value
        },
      })
    ),
    button('(Re)load app', mountFrame),
    button('Load with wrong ?host=', () => {
      hostParam = 'https://evil.example'
      mountFrame()
      hostParam = location.origin
    }),
    button('Load with no ?host=', () => {
      const keep = hostParam
      hostParam = ''
      mountFrame()
      hostParam = keep
    })
  )

  const scenarios = document.createElement('fieldset')
  scenarios.append(
    Object.assign(document.createElement('legend'), { textContent: 'Scenarios' }),
    labelled(
      'frame',
      select(['desktop', 'tablet', 'phone'] as const, config.frameSize, (value) => {
        config.frameSize = value
        frameStyle()
      })
    ),
    labelled(
      'push state on every change',
      checkbox(config.autoPush, (value) => (config.autoPush = value))
    ),
    button('Push state now', pushState),
    button('Expire token (dev)', () => {
      send({ type: 'rumbos:dev-expire-token', v: 1 })
    }),
    button('Host disappears / returns', () => {
      config.gone = !config.gone
      log('host', { type: 'note', text: config.gone ? 'host stops answering' : 'host answers' })
    }),
    button('Send malformed messages', () => {
      const target = iframe?.contentWindow
      if (!target) return
      const bad: unknown[] = [
        'rumbos:host-state',
        { type: 'rumbos:host-state', v: 1 },
        { type: 'rumbos:host-state', v: 1, state: { schemaVersion: 1 } },
        { type: 'rumbos:host-state', v: 2, state: buildState() },
        { type: 'rumbos:host-launch', v: 1, assertion: 'x'.repeat(100_000) },
        { type: 'rumbos:unknown', v: 1 },
        {
          type: 'rumbos:host-state',
          v: 1,
          state: { ...buildState(), activities: [{ cmid: 'NaN' }] },
        },
        null,
      ]
      for (const message of bad) {
        log('host→app', { type: 'malformed', sample: JSON.stringify(message)?.slice(0, 60) })
        target.postMessage(message, appOrigin())
      }
    }),
    button('Unsolicited host-launch', () =>
      send({ type: 'rumbos:host-launch', v: 1, assertion: assertion() })
    ),
    // An activity popup above the app: the app pauses; on close the host sends
    // the refreshed state (change a completion first to see the live effects).
    button('Overlay open', () => send({ type: 'rumbos:host-overlay', v: 1, open: true })),
    button('Overlay close + state', () => {
      send({ type: 'rumbos:host-overlay', v: 1, open: false })
      pushState()
    }),
    // The host forgets to refresh: the app must ask once by itself.
    button('Overlay close, no state', () =>
      send({ type: 'rumbos:host-overlay', v: 1, open: false })
    ),
    // A quiz handed in inside the popup: 103 completes, the popup closes.
    button('Quiz submitted (103 complete, overlay close + state)', () => {
      const row = rows.find((item) => item.cmid === 103)
      if (row) row.completion = 'complete'
      send({ type: 'rumbos:host-overlay', v: 1, open: true })
      setTimeout(() => {
        send({ type: 'rumbos:host-overlay', v: 1, open: false })
        pushState()
      }, 600)
    }),
    labelled(
      'courseCompletionEnabled',
      select(['true', 'false', 'absent'] as const, config.completionEnabled, (value) => {
        config.completionEnabled = value
        pushState()
      })
    )
  )

  const table = document.createElement('table')
  const head = table.createTHead().insertRow()
  for (const title of [
    'cmid',
    'activity',
    'section',
    'availability',
    'restriction text',
    'completion',
  ])
    head.append(Object.assign(document.createElement('th'), { textContent: title }))
  const body = table.createTBody()
  const changed = () => {
    if (config.autoPush) pushState()
  }
  for (const row of rows) {
    const tr = body.insertRow()
    tr.insertCell().textContent = String(row.cmid)
    tr.insertCell().textContent = row.name
    tr.insertCell().textContent = String(row.sectionId)
    tr.insertCell().append(
      select(
        ['available', 'restricted', 'hidden', 'unavailable', 'missing'] as const,
        row.availability,
        (value) => {
          row.availability = value
          changed()
        }
      )
    )
    tr.insertCell().append(
      Object.assign(document.createElement('input'), {
        value: row.info,
        style: 'width: 16rem',
        onchange: (event: Event) => {
          row.info = (event.target as HTMLInputElement).value
          changed()
        },
      })
    )
    tr.insertCell().append(
      select(['none', 'incomplete', 'complete', 'failed'] as const, row.completion, (value) => {
        row.completion = value
        changed()
      })
    )
  }

  controls.append(session, scenarios, table)
}

const filler = (lines: number) =>
  Array.from({ length: lines }, (_, i) => `Host page content, line ${i + 1}.`).join(' ')

$('filler-top').textContent = filler(30)
$('filler-bottom').textContent = filler(60)
buildControls()
mountFrame()
