import Image from 'next/image'

type BrandLogoProps = {
  variant?: 'full' | 'lockup' | 'symbol' | 'wordmark' | 'mark'
  theme?: 'light' | 'dark'
  size?: 'header' | 'sm' | 'md' | 'lg' | 'xl'
  priority?: boolean
  decorative?: boolean
  className?: string
}

const wordmarkSizes = {
  header: { width: 180, height: 60, className: 'h-10 w-auto' },
  sm: { width: 150, height: 50, className: 'h-8 w-auto' },
  md: { width: 180, height: 60, className: 'h-10 w-auto' },
  lg: { width: 260, height: 87, className: 'h-16 w-auto' },
  xl: { width: 360, height: 120, className: 'h-24 w-auto' },
}

const markSizes = {
  header: { width: 46, height: 50, className: 'h-9 w-auto sm:h-12' },
  sm: { width: 40, height: 40, className: 'h-10 w-10' },
  md: { width: 56, height: 56, className: 'h-14 w-14' },
  lg: { width: 80, height: 80, className: 'h-20 w-20' },
  xl: { width: 112, height: 112, className: 'h-28 w-28' },
}

export default function BrandLogo({
  variant = 'full',
  theme = 'light',
  size = 'md',
  priority = false,
  decorative = false,
  className = '',
}: BrandLogoProps) {
  if (variant === 'lockup') {
    const dimensions = markSizes.header

    return (
      <span className={`inline-flex min-w-0 shrink-0 items-center gap-1.5 min-[360px]:gap-2 sm:gap-3 ${className}`}>
        <Image
          src="/brand/logo-symbol-cropped.png"
          alt=""
          width={dimensions.width}
          height={dimensions.height}
          priority={priority}
          className={`${dimensions.className} shrink-0 object-contain`}
          aria-hidden="true"
        />
        <span className="shrink-0 whitespace-nowrap text-[18px] font-black tracking-tight text-[var(--brand-navy)] min-[360px]:text-[20px] sm:text-2xl">
          Can You Coach
        </span>
      </span>
    )
  }

  if (variant === 'symbol' || variant === 'mark') {
    const dimensions = markSizes[size]

    return (
      <Image
        src="/brand/logo-symbol-cropped.png"
        alt={decorative ? '' : 'Can You Coach'}
        width={dimensions.width}
        height={dimensions.height}
        priority={priority}
        className={`${dimensions.className} object-contain ${className}`}
        aria-hidden={decorative || undefined}
      />
    )
  }

  const dimensions = wordmarkSizes[size]
  const src = theme === 'dark' ? '/brand/logoNoBackgroundv2.png' : '/brand/logo-full-cropped.png'

  return (
    <Image
      src={src}
      alt={decorative ? '' : 'Can You Coach'}
      width={dimensions.width}
      height={dimensions.height}
      priority={priority}
      className={`${dimensions.className} object-contain ${className}`}
      aria-hidden={decorative || undefined}
    />
  )
}
