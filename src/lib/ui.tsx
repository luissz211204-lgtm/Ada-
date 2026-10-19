'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition dark:border-slate-800 dark:bg-slate-950',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3 md:mb-6">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold sm:text-xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export function Button({
  children,
  onClick,
  type = 'button',
  variant = 'secondary',
  size = 'md',
  disabled,
  className,
  title,
  href,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  className?: string;
  title?: string;
  href?: string;
}) {
  const base = 'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition focus:outline-none focus:ring-2 focus:ring-sky-500/60 disabled:cursor-not-allowed disabled:opacity-60';
  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-sky-600 text-white shadow-sm hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-400',
    secondary:
      'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800',
    ghost: 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/80',
    danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-400',
  };
  const sizes: Record<ButtonSize, string> = {
    sm: 'px-2.5 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
  };
  const cls = cn(base, variants[variant], sizes[size], className);

  if (href) {
    return (
      <Link href={href} className={cls} title={title}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls} title={title}>
      {children}
    </button>
  );
}

export function Input({
  value,
  onChange,
  placeholder,
  type = 'text',
  name,
  autoComplete,
  required,
  disabled,
  className,
}: {
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  type?: string;
  name?: string;
  autoComplete?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <input
      name={name}
      type={type}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      autoComplete={autoComplete}
      required={required}
      disabled={disabled}
      className={cn(
        'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 dark:border-slate-700 dark:bg-slate-950 dark:text-white',
        className,
      )}
    />
  );
}

export function Select({
  value,
  onChange,
  children,
  disabled,
  className,
}: {
  value?: string;
  onChange?: (v: string) => void;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      disabled={disabled}
      className={cn(
        'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 dark:border-slate-700 dark:bg-slate-950 dark:text-white',
        className,
      )}
    >
      {children}
    </select>
  );
}

export function Textarea({
  value,
  onChange,
  placeholder,
  rows = 4,
  name,
  disabled,
  className,
}: {
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  rows?: number;
  name?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <textarea
      name={name}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      className={cn(
        'w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 dark:border-slate-700 dark:bg-slate-950 dark:text-white',
        className,
      )}
    />
  );
}

export function Field({
  label,
  children,
  hint,
  error,
  className,
}: {
  label?: string;
  children: ReactNode;
  hint?: string;
  error?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && <label className="text-xs font-medium text-slate-600 dark:text-slate-300">{label}</label>}
      {children}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  );
}

export function Badge({ children, className, tone = 'neutral' }: { children: ReactNode; className?: string; tone?: 'neutral' | 'success' | 'warn' | 'danger' | 'info' }) {
  const tones: Record<string, string> = {
    neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    warn: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    danger: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
    info: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  };
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', tones[tone], className)}>{children}</span>;
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/60 p-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-950/40">
      <h3 className="text-base font-medium">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorNote({ message, onRetry, className }: { message: string; onRetry?: () => void; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300', className)}>
      <span>{message}</span>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  );
}

export function Loading({ text = 'Cargando...' }: { text?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
      <span className="h-2 w-2 animate-pulse rounded-full bg-sky-500" />
      <span>{text}</span>
    </div>
  );
}