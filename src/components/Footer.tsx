import { Link } from "wouter";

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-surface-800/60 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 md:px-8 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <div className="text-2xl font-black heading-gradient">Ecomमित्र</div>
          <p className="text-sm text-slate-400 mt-3">Modern operations platform for ambitious commerce teams.</p>
        </div>

        <div>
          <div className="text-slate-200 font-semibold mb-3">Product</div>
          <ul className="space-y-2 text-slate-400 text-sm">
            <li><span className="hover:text-slate-200 cursor-pointer">Features</span></li>
            <li><span className="hover:text-slate-200 cursor-pointer">Pricing</span></li>
            <li><span className="hover:text-slate-200 cursor-pointer">Integrations</span></li>
          </ul>
        </div>

        <div>
          <div className="text-slate-200 font-semibold mb-3">Company</div>
          <ul className="space-y-2 text-slate-400 text-sm">
            <li><span className="hover:text-slate-200 cursor-pointer">About</span></li>
            <li><span className="hover:text-slate-200 cursor-pointer">Careers</span></li>
            <li><span className="hover:text-slate-200 cursor-pointer">Contact</span></li>
          </ul>
        </div>

        <div>
          <div className="text-slate-200 font-semibold mb-3">Resources</div>
          <ul className="space-y-2 text-slate-400 text-sm">
            <li><span className="hover:text-slate-200 cursor-pointer">Docs</span></li>
            <li><span className="hover:text-slate-200 cursor-pointer">Blog</span></li>
            <li><span className="hover:text-slate-200 cursor-pointer">Support</span></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-6 flex flex-col md:flex-row items-center justify-between text-slate-500 text-sm">
          <span>© {new Date().getFullYear()} Ecomमित्र. All rights reserved.</span>
          <div className="space-x-4">
            <span className="hover:text-slate-300 cursor-pointer">Terms</span>
            <span className="hover:text-slate-300 cursor-pointer">Privacy</span>
            <Link href="/cookies" className="hover:text-slate-300">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}


