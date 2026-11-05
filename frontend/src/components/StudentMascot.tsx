import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getProcessedImage } from '../utils/removeWhiteBackground'
import { MASCOT_ACTIONS, getAvailableActions, type MascotAction, DEFAULT_ACTION } from '../utils/mascotActions'

export function StudentMascot() {
  const slotRef = useRef<HTMLDivElement | null>(null)
  const flightRef = useRef<HTMLDivElement | null>(null)
  const mascotRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const [intro, setIntro] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [action, setAction] = useState<MascotAction>(DEFAULT_ACTION)
  const [currentImageUrl, setCurrentImageUrl] = useState<string>('')
  const [introImageUrl, setIntroImageUrl] = useState<string>('')
  const [processedImages, setProcessedImages] = useState<Record<MascotAction, string>>({} as Record<MascotAction, string>)

  const availableActions = getAvailableActions()
  const actionsCount = availableActions.length
  const anglePerAction = 360 / actionsCount

  // Load and process all images on mount
  useEffect(() => {
    const loadImages = async () => {
      const processed: Record<string, string> = {}
      
      // Process intro image
      try {
        const introUrl = await getProcessedImage('/assets/padrao.jpg')
        setIntroImageUrl(introUrl)
      } catch (error) {
        console.error('Failed to process intro image:', error)
        setIntroImageUrl('/assets/padrao.jpg')
      }
      
      for (const [actionKey, config] of Object.entries(MASCOT_ACTIONS)) {
        try {
          const processedUrl = await getProcessedImage(config.image)
          processed[actionKey] = processedUrl
        } catch (error) {
          console.error(`Failed to process image for action ${actionKey}:`, error)
          processed[actionKey] = config.image
        }
      }
      
      setProcessedImages(processed as Record<MascotAction, string>)
    }

    loadImages()
  }, [])

  // Update current image when action changes
  useEffect(() => {
    const url = processedImages[action] || MASCOT_ACTIONS[action]?.image
    setCurrentImageUrl(url)
  }, [action, processedImages])

  // Intro animation
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setIntro(false)
      return
    }

    const target = slotRef.current?.getBoundingClientRect()
    const flyer = flightRef.current
    if (!target || !flyer || typeof flyer.animate !== 'function') {
      setIntro(false)
      return
    }

    const width = target.width
    const height = target.height
    flyer.style.width = `${width}px`
    flyer.style.height = `${height}px`

    const startX = Math.max(12, window.innerWidth - width - 20)
    const startY = 18
    const centerScale = 2.1
    const centerX = (window.innerWidth - width * centerScale) / 2
    const centerY = (window.innerHeight - height * centerScale) / 2

    let flight: Animation
    try {
      flight = flyer.animate([
        {
          opacity: 0,
          transform: `translate3d(${startX}px, ${startY}px, 0) scale(.35) rotate(-22deg)`,
          offset: 0,
        },
        {
          opacity: 1,
          transform: `translate3d(${centerX}px, ${centerY}px, 0) scale(${centerScale}) rotate(6deg)`,
          offset: 0.4,
        },
        {
          opacity: 1,
          transform: `translate3d(${centerX}px, ${centerY}px, 0) scale(${centerScale}) rotate(-4deg)`,
          offset: 0.62,
        },
        {
          opacity: 1,
          transform: `translate3d(${target.left}px, ${target.top}px, 0) scale(1) rotate(0)`,
          offset: 1,
        },
      ], {
        duration: 4300,
        easing: 'cubic-bezier(.18,.72,.24,1)',
        fill: 'forwards',
      })
    } catch {
      setIntro(false)
      return
    }

    flight.onfinish = () => setIntro(false)
    return () => flight.cancel()
  }, [])

  // Auto-reset action
  useEffect(() => {
    if (action === DEFAULT_ACTION) return
    const config = MASCOT_ACTIONS[action]
    const timer = window.setTimeout(() => setAction(DEFAULT_ACTION), config.duration)
    return () => window.clearTimeout(timer)
  }, [action])

  // Handle menu keyboard navigation
  useEffect(() => {
    if (!menuOpen) return
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
    function closeOnOutsideClick(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node) && triggerRef.current !== event.target) {
        setMenuOpen(false)
      }
    }
    window.addEventListener('pointerdown', closeOnOutsideClick)
    return () => window.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [menuOpen])

  function handleMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])]
    const activeIndex = items.indexOf(document.activeElement as HTMLButtonElement)
    if (event.key === 'Escape') {
      event.preventDefault()
      setMenuOpen(false)
      triggerRef.current?.focus()
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const direction = event.key === 'ArrowDown' ? 1 : -1
      items[(activeIndex + direction + items.length) % items.length]?.focus()
    } else if (event.key === 'Home') {
      event.preventDefault()
      items[0]?.focus()
    } else if (event.key === 'End') {
      event.preventDefault()
      items[items.length - 1]?.focus()
    }
  }

  const handleMenuClose = () => {
    setMenuOpen(false)
  }

  const handleActionSelect = (actionName: MascotAction) => {
    setAction(actionName)
    setMenuOpen(false)
  }

  return (
    <div ref={slotRef} className="relative h-20 w-[52px] shrink-0 sm:h-28 sm:w-[72px]">
      {intro ? (
        createPortal(
          <div
            ref={flightRef}
            aria-hidden="true"
            className="student-mascot-intro pointer-events-none fixed left-0 top-0 z-[100]"
            style={{
              backgroundImage: `url("${introImageUrl || new URL('/assets/padrao.jpg', window.location.origin).toString()}")`,
              backgroundSize: 'contain',
              backgroundPosition: 'center',
            }}
          />,
          document.body,
        )
      ) : (
        <>
          {menuOpen && (
            <div 
              className="fixed inset-0 z-30"
              onClick={handleMenuClose}
              style={{ pointerEvents: 'auto' }}
            />
          )}
          <div 
            ref={menuRef} 
            className={`transition-all duration-300 ${
              menuOpen 
                ? 'fixed z-40 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2' 
                : 'absolute inset-0'
            }`}
            style={{
              width: menuOpen ? 'auto' : 'auto',
              height: menuOpen ? 'auto' : 'auto',
            }}
          >
            <button
              ref={triggerRef}
              aria-label={menuOpen ? 'Fechar ações do mascote' : 'Abrir ações do mascote'}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-controls="student-mascot-menu"
              className={`student-mascot-float block cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 transition-all duration-300 ${
                menuOpen 
                  ? 'w-48 h-48 sm:w-64 sm:h-64' 
                  : 'w-full h-full hover:scale-110'
              }`}
              onClick={() => setMenuOpen((open) => !open)}
              type="button"
            >
              <div
                ref={mascotRef}
                aria-hidden="true"
                className="student-mascot-sprite size-full drop-shadow-lg rounded-full overflow-hidden"
                style={{
                  backgroundImage: `url("${currentImageUrl}")`,
                  backgroundSize: 'contain',
                  backgroundPosition: 'center',
                }}
              />
            </button>

            {menuOpen && (
              <div
                className="absolute z-40"
                id="student-mascot-menu"
                onKeyDown={handleMenuKeyDown}
                role="menu"
                style={{
                  width: '800px',
                  height: '800px',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: 'none',
                }}
            >
              {availableActions.map(([actionKey, config], index) => {
                const angle = (index * anglePerAction) * (Math.PI / 180)
                const radius = 250
                const x = Math.cos(angle) * radius
                const y = Math.sin(angle) * radius

                return (
                  <button
                    key={actionKey}
                    className="student-mascot-menu-item absolute px-2 py-1 hover:scale-110 flex items-center justify-center text-center text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 pointers-events-auto whitespace-nowrap"
                    onClick={() => handleActionSelect(actionKey)}
                    role="menuitem"
                    type="button"
                    style={{
                      left: `calc(50% + ${x}px)`,
                      top: `calc(50% + ${y}px)`,
                      transform: 'translate(-50%, -50%)',
                      pointerEvents: 'auto',
                    }}
                    title={config.label}
                  >
                    <span className="px-1">{config.label}</span>
                  </button>
                )
              })}
            </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}