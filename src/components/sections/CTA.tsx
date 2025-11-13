import { Button } from "../ui/button"

type CTAProps = {
  onStart?: () => void
}

export default function CTA({ onStart }: CTAProps) {
  return (
    <section className="py-24 md:py-32 px-6 md:px-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-brand-primary-600 via-purple-600 to-rose-600 opacity-90" />
      <div className="relative z-10 max-w-4xl mx-auto text-center">
        <h2 className="text-4xl md:text-5xl font-black mb-4 text-white">Ready to be a part of our Family?!</h2>
        <p className="text-xl mb-10 text-indigo-100">Join thousands of Indian businesses already using Ecomमित्र.</p>
        <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
          <Button onClick={onStart} size="xl" variant="gradient">Start Free Trial</Button>
          <Button variant="glass" size="xl">Book Demo</Button>
        </div>
      </div>
    </section>
  )
}


