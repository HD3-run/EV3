import { Bold } from "lucide-react"
import { Toggle } from "@/components/ui/toggle"

export function ToggleDemo() {
  return (
    <Toggle aria-label="Toggle bold" size="icon">
      <Bold className="h-4 w-4" />
    </Toggle>
  )
}

export default ToggleDemo


