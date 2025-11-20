import * as React from "react"
import { cn } from "../../lib/utils"

export interface ToggleProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  pressed?: boolean
  onPressedChange?: (pressed: boolean) => void
  size?: "default" | "sm" | "lg" | "icon"
}

const sizeClasses: Record<NonNullable<ToggleProps["size"]>, string> = {
  default: "h-10 px-4",
  sm: "h-9 px-3 text-sm",
  lg: "h-11 px-5 text-base",
  icon: "h-10 w-10",
}

export const Toggle = React.forwardRef<HTMLButtonElement, ToggleProps>(
  ({ className, pressed, onPressedChange, size = "default", onClick, ...props }, ref) => {
    const [internalPressed, setInternalPressed] = React.useState<boolean>(false)
    const isControlled = typeof pressed === "boolean"
    const current = isControlled ? pressed : internalPressed

    const handleClick = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      const next = !current
      if (!isControlled) setInternalPressed(next)
      onPressedChange?.(next)
      onClick?.(e)
    }

    return (
      <button
        ref={ref}
        type="button"
        aria-pressed={current}
        data-state={current ? "on" : "off"}
        onClick={handleClick}
        className={cn(
          "inline-flex items-center justify-center rounded-md text-sm font-medium",
          "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
          "bg-white/5 text-slate-200 hover:bg-white/10 border border-white/10",
          "data-[state=on]:bg-brand-primary-600 data-[state=on]:text-white data-[state=on]:border-transparent",
          sizeClasses[size],
          className
        )}
        {...props}
      />
    )
  }
)
Toggle.displayName = "Toggle"

export default Toggle


