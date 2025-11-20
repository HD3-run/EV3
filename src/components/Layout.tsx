import NavBar from "./NavBar"
import Footer from "./Footer"
import type { ReactNode } from "react"

type LayoutProps = {
  children: ReactNode
  fullWidth?: boolean
}

export default function Layout({ children, fullWidth = false }: LayoutProps) {
  const mainClass = fullWidth
    ? "px-6 md:px-8 py-10"
    : "max-w-7xl mx-auto px-6 md:px-8 py-10"
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-slate-100" style={{ willChange: 'auto' }}>
      <NavBar />
      <main className={mainClass} style={{ contain: 'layout style' }}>
        {children}
      </main>
      <Footer />
    </div>
  )
}


