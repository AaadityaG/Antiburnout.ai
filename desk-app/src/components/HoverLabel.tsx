import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface HoverLabelProps {
  label: string
  children: React.ReactNode
  className?: string
  position?: 'top' | 'bottom'
}

export default function HoverLabel({ label, children, className = '', position = 'bottom' }: HoverLabelProps) {
  const [hovered, setHovered] = useState(false)

  const labelClass = position === 'top'
    ? 'absolute -top-9 px-2.5 py-1 text-[10px] font-semibold tracking-wider uppercase text-accent bg-glass glass-blur border border-white/15 rounded-md whitespace-nowrap z-50 pointer-events-none'
    : 'absolute -bottom-9 px-2.5 py-1 text-[10px] font-semibold tracking-wider uppercase text-accent bg-glass glass-blur border border-white/15 rounded-md whitespace-nowrap z-50 pointer-events-none'

  const initialY = position === 'top' ? -8 : 8

  return (
    <div
      className={`relative inline-flex flex-col items-center ${className}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
      <AnimatePresence>
        {hovered && (
          <motion.span
            initial={{ opacity: 0, y: initialY }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: initialY }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={labelClass}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}
