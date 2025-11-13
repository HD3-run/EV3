import { useEffect, useState, useCallback, memo } from "react"
import { Link, useLocation } from "wouter"
import { Button } from "./ui/button"
import { useAuth } from "../context/AuthContext"

type NavBarProps = {
  onStartFreeTrial?: () => void
}

const NavBar = memo(({ onStartFreeTrial }: NavBarProps) => {
  const [scrolled, setScrolled] = useState(false)
  const [location] = useLocation()
  const { user: _user } = useAuth()

  // Optimize scroll handler with useCallback
  const handleScroll = useCallback(() => {
    setScrolled(window.scrollY > 10)
  }, [])

  useEffect(() => {
    handleScroll() // Initial check
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  return (
    <nav className={`relative z-50 px-4 sm:px-6 lg:px-8 transition-colors ${scrolled ? 'bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50' : 'bg-transparent'}`}>
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center py-6">
          <div className="flex items-center space-x-5">
            <span className="ml-1 tracking-center text-2xl font-black bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              Ecomमित्र
            </span>
          </div>

          {location === '/' && (
            <div className="hidden md:flex items-center space-x-8">
              <a 
                href="#features" 
                className="font-semibold text-slate-300 hover:text-white transition-colors relative group"
              >
                Features
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-brand-primary-500 to-brand-accent-500 group-hover:w-full transition-all duration-300" />
              </a>
              <a 
                href="#about" 
                className="font-semibold text-slate-300 hover:text-white transition-colors relative group"
              >
                About
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-brand-primary-500 to-brand-accent-500 group-hover:w-full transition-all duration-300" />
              </a>
              <Link href="/login">
                <div>
                  <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white font-semibold">
                    Sign In
                  </Button>
                </div>
              </Link>
              <div>
                <Button onClick={onStartFreeTrial} className="bg-gradient-to-r from-brand-primary-600 to-brand-accent-600 hover:from-brand-primary-600 hover:to-brand-accent-600 text-white font-semibold px-6 py-2 rounded-xl shadow-lg">
                  Start Free Trial
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
});

NavBar.displayName = 'NavBar';

export default NavBar;
