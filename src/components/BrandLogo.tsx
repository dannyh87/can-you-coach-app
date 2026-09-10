import Image from 'next/image'

type BrandLogoProps = {
  variant?: 'wordmark' | 'mark'
  theme?: 'light' | 'dark'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  priority?: boolean
  className?: string
}

const wordmarkSizes = {
  sm: { width: 150, height: 50, className: 'h-8 w-auto' },
  md: { width: 180, height: 60, className: 'h-10 w-auto' },
  lg: { width: 260, height: 87, className: 'h-16 w-auto' },
  xl: { width: 360, height: 120, className: 'h-24 w-auto' },
}

const markSizes = {
  sm: { width: 40, height: 40, className: 'h-10 w-10' },
  md: { width: 56, height: 56, className: 'h-14 w-14' },
  lg: { width: 80, height: 80, className: 'h-20 w-20' },
  xl: { width: 112, height: 112, className: 'h-28 w-28' },
}

export default function BrandLogo({
  variant = 'wordmark',
  theme = 'light',
  size = 'md',
  priority = false,
  className = '',
}: BrandLogoProps) {
  if (variant === 'mark') {
    const dimensions = markSizes[size]

    return (
      <Image
        src="/brand/logo_noWordsOrBackground.png"
        alt="Can You Coach"
        width={dimensions.width}
        height={dimensions.height}
        priority={priority}
        className={`${dimensions.className} object-contain ${className}`}
      />
    )
  }

  const dimensions = wordmarkSizes[size]
  const src = theme === 'dark' ? '/brand/logoNoBackgroundv2.png' : '/brand/cyc_logo.png'

  return (
    <Image
      src={src}
      alt="Can You Coach"
      width={dimensions.width}
      height={dimensions.height}
      priority={priority}
      className={`${dimensions.className} object-contain ${className}`}
    />
  )
}
