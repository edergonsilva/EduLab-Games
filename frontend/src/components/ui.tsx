import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

export function formatBrazilDateTime(value?: string | null) {
  if (!value) return '—'
  const timestamp = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger'
  size?: 'sm' | 'md'
}

const buttonVariants = {
  primary: 'bg-brand text-white hover:bg-brand-dark disabled:bg-brand/50',
  secondary: 'border border-line bg-white text-ink hover:border-brand/40 hover:bg-brand-pale disabled:opacity-50',
  quiet: 'bg-transparent text-muted hover:bg-brand-pale hover:text-brand-dark disabled:opacity-50',
  danger: 'bg-red-50 text-danger hover:bg-red-100 disabled:opacity-50',
}

export function Button({
  className,
  size = 'md',
  variant = 'primary',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        'inline-flex min-h-10 items-center justify-center gap-2 rounded-md font-semibold transition-colors focus-visible:outline-none disabled:cursor-not-allowed',
        size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2.5 text-sm',
        buttonVariants[variant],
        className,
      )}
      {...props}
    />
  )
}

type FieldProps = {
  label: string
  hint?: string
  error?: string
  children: ReactNode
  className?: string
}

export function Field({ label, hint, error, children, className }: FieldProps) {
  return (
    <label className={cx('grid self-start content-start gap-1.5 text-sm font-medium text-ink', className)}>
      <span>{label}</span>
      {children}
      {hint && <span className="text-xs font-normal text-muted">{hint}</span>}
      {error && <span role="alert" className="text-xs font-medium text-danger">{error}</span>}
    </label>
  )
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx('field-control', className)} {...props} />
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx('field-control', className)} {...props} />
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx('field-control min-h-28 resize-y leading-6', className)} {...props} />
}

export function Card({ children, className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cx('rounded-lg border border-line bg-surface shadow-panel', className)} {...props}>{children}</section>
}

export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={cx('page-enter mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8', className)}>{children}</main>
}

export function BrandMark() {
  return (
    <span className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-white">
      <img alt="EduLab Games" className="absolute left-0 top-0 w-11 max-w-none object-cover object-top" src="/assets/edulab_logo.png" />
    </span>
  )
}

export function Mascot({ className }: { className?: string }) {
  return <img alt="Mascote do EduLab Games" className={cx('h-20 w-16 shrink-0 object-contain sm:h-24 sm:w-20', className)} src="/assets/edulab_mascote.png" />
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  mascot,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  mascot?: ReactNode
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-5 border-b border-line pb-6">
      <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-5">
        <div className="min-w-0 max-w-3xl">
          {eyebrow && <p className="mb-2 text-xs font-bold uppercase text-brand">{eyebrow}</p>}
          <h1 className="font-display text-3xl font-semibold tracking-normal text-ink sm:text-4xl">{title}</h1>
          {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-muted sm:text-base">{description}</p>}
        </div>
        {mascot ?? <Mascot className="h-16 w-12 sm:h-24 sm:w-20" />}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

export function SectionHeading({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions}
    </div>
  )
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'brand' | 'accent' | 'danger' }) {
  const tones = {
    neutral: 'bg-slate-100 text-slate-700',
    brand: 'bg-brand-soft text-brand-dark',
    accent: 'bg-accent-soft text-amber-900',
    danger: 'bg-red-50 text-danger',
  }
  return <span className={cx('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold', tones[tone])}>{children}</span>
}

export function Modal({
  children,
  onClose,
  labelledBy,
  className,
}: {
  children: ReactNode
  onClose: () => void
  labelledBy: string
  className?: string
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink/55 p-4 backdrop-blur-sm"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <section aria-labelledby={labelledBy} aria-modal="true" role="dialog" className={cx('my-auto w-full max-w-xl rounded-lg border border-line bg-white p-5 shadow-popover sm:p-7', className)}>
        {children}
      </section>
    </div>
  )
}