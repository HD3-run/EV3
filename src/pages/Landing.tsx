import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion, useInView } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";
import { Button } from "../components/ui/button";
import NavBar from "../components/NavBar";
import FeaturesGrid from "../components/sections/FeaturesGrid";
import CTA from "../components/sections/CTA";
import Footer from "../components/Footer";
import { useLocation } from "wouter"; 


export default function LandingNew() {
  const prefersReducedMotion = useReducedMotion();
  // Override reduced motion for our galactic stars - they're essential for the design
  const showGalacticStars = true;
  
  // Debug info for galactic stars
  useEffect(() => {
    if (prefersReducedMotion) {
      console.log('🌟 Galactic Stars: Reduced motion detected, using subtle animations');
      console.log('✨ Override: Galactic stars are now visible with gentle pulsing effects');
    } else {
      console.log('🌟 Galactic Stars: Full animations enabled');
      console.log('✨ Galactic stars with full motion effects are active');
    }
    console.log('🌌 Galaxy Background: Loading Cigar Galaxy image from ESA Hubble');
    console.log('🔍 Check: Galaxy should be visible as background with purple/blue nebula effects');
  }, [prefersReducedMotion]);
  const [_, setLocation] = useLocation();
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  // Refs for intersection observer
  const heroRef = useRef(null);
  const isHeroInView = useInView(heroRef, { once: false, margin: "-100px" });

  useEffect(() => {
    // Faster, optimized loading sequence
    const interval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => setIsLoaded(true), 300);
          return 100;
        }
        return prev + 5; // Faster loading
      });
    }, 30); // Reduced interval

    // Throttled mouse tracking with lower update frequency
    let rafId: number | null = null;
    let lastUpdate = 0;
    const THROTTLE_MS = 100; // Update only every 100ms
    
    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastUpdate < THROTTLE_MS) return;
      
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        const nx = (e.clientX / window.innerWidth - 0.5) * 0.5; // Reduced multiplier for subtler effect
        const ny = (e.clientY / window.innerHeight - 0.5) * 0.5;
        setMousePosition({ x: nx, y: ny });
        lastUpdate = now;
        rafId = null;
      });
    };
    
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('mousemove', handleMouseMove);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  // Optimized Loading Screen - Reduced particles and complexity
  const LoadingScreen = () => (
    <motion.div
      className="fixed inset-0 bg-black flex items-center justify-center z-50"
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Reduced Particle System - only 8 particles instead of 30 */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-gradient-to-r from-cyan-400 to-purple-500 rounded-full will-change-transform"
            style={{
              left: `${(i * 12.5) % 100}%`,
              top: `${((i * 17) % 80) + 10}%`,
            }}
            animate={{
              opacity: [0, 1, 0],
              scale: [0, 1.5, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.2,
              ease: "easeOut"
            }}
          />
        ))}
      </div>

      {/* Simplified Loading Ring */}
      <div className="relative">
        {/* Single rotating ring instead of 3 */}
        <motion.div
          className="w-32 h-32 rounded-full border-4 border-transparent"
          style={{
            borderTopColor: '#a855f7',
            borderRightColor: '#ec4899',
            willChange: 'transform',
          }}
          animate={{ rotate: 360 }}
          transition={{ 
            duration: 1.5, 
            repeat: Infinity, 
            ease: "linear" 
          }}
        />
        
        {/* Center Content */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-xl tracking-wide font-black text-transparent bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text mb-2">
              Ecomमित्र
            </div>
            <motion.div
              className="text-cyan-400 text-lg font-bold"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              {Math.round(loadingProgress)}%
            </motion.div>
          </div>
        </div>

        {/* Simplified Progress Indicators - 6 instead of 12 */}
        <div className="absolute -inset-12">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full will-change-transform"
              style={{
                top: '50%',
                left: '50%',
                transformOrigin: '0 0',
                background: loadingProgress > i * 16.66 ? '#06b6d4' : '#334155',
              }}
              animate={{
                rotate: i * 60,
                x: '60px',
              }}
              transition={{ duration: 0.3 }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );

  // features moved to components/sections/FeaturesGrid

  const quickWins = [
    { 
      title: "Save 10+ Hours Weekly", 
      description: "Automate order processing, inventory updates, and invoice generation. Focus on growing your business instead of manual data entry.",
      icon: "⚡",
      metric: "10+ Hours Saved",
      color: "from-yellow-500 to-amber-500"
    },
    { 
      title: "Process 10x More Orders", 
      description: "Handle hundreds of orders simultaneously with bulk CSV uploads. Scale your operations without hiring more staff.",
      icon: "📈",
      metric: "10x Efficiency",
      color: "from-green-500 to-emerald-500"
    },
    { 
      title: "Zero Manual Errors", 
      description: "Automated calculations, stock validation, and payment matching eliminate human errors. Get accurate data every time.",
      icon: "🎯",
      metric: "99.9% Accuracy",
      color: "from-blue-500 to-cyan-500"
    },
    { 
      title: "Real-Time Insights", 
      description: "Make data-driven decisions with live dashboards. Know your profit margins, top products, and channel performance instantly.",
      icon: "📊",
      metric: "Instant Updates",
      color: "from-purple-500 to-pink-500"
    },
  ];

  const businessBenefits = [
    {
      title: "GST Compliant Invoicing",
      description: "Auto-generate GST-compliant invoices with proper tax calculations. Stay compliant without hiring a CA.",
      icon: "📋",
      highlight: "GST Ready"
    },
    {
      title: "Multi-Channel Mastery", 
      description: "Manage Phone, Email, Catalog, and Manual orders from one platform. Never lose track of any order source.",
      icon: "🌐",
      highlight: "All Channels"
    },
    {
      title: "Customer-First Approach",
      description: "Share product catalogs, track customer history, and build relationships. Turn one-time buyers into loyal customers.",
      icon: "❤️",
      highlight: "Customer Loyalty"
    },
    {
      title: "Grow Without Limits",
      description: "Start small, scale big. Our platform grows with your business - from 10 orders to 10,000 orders per day.",
      icon: "🚀",
      highlight: "Unlimited Scale"
    }
  ];

  const handleStartFreeTrial = () => {
    setLocation("/dashboard");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0b0f] via-[#0b0014] to-black text-slate-100 overflow-hidden">

      {/* Top CTA Section */}
      <section className="py-32 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#00ff9c] via-[#ff00e0] to-[#00c2ff] opacity-90" />
        
        {/* Animated Background Elements */}
        <div className="absolute inset-0">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute top-1/4 left-1/4 w-64 h-64 bg-gradient-to-br from-[#7c3aed]/20 to-[#ec4899]/20 rounded-full blur-3xl"
          />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-to-br from-[#a855f7]/20 to-[#ec4899]/20 rounded-full blur-3xl"
          />
        </div>
        
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.h2
            initial={{ opacity: 0, y: 30, scale: 0.8 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, type: "spring", stiffness: 100 }}
            className="text-5xl md:text-6xl font-black mb-6 text-white font-techno"
          >
            "aim for the sun you reach the moon"
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-2xl mb-12 text-indigo-100"
          >
            For us, the sky is not the limit — it’s the launchpad....<span className="ml-1.3xl tracking-wide font-bold">Ecomमित्र</span>
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-8 justify-center items-center"
          >
            {/* 3D Start Free Trial Button */}
            <motion.button
              whileHover={{ 
                scale: 1.1,
                rotateY: 5,
                rotateX: -5,
                boxShadow: "0 25px 50px -12px rgba(0, 194, 255, 0.5)"
              }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300 }}
              className="relative px-14 py-7 bg-gradient-to-r from-[#001018] to-[#0a0b0f] text-[#00ff9c] rounded-2xl font-extrabold text-xl md:text-2xl overflow-hidden group border border-[#00c2ff]/40"
              onClick={handleStartFreeTrial}
            >
              <span className="relative z-10">Start Free Trial</span>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#00c2ff]/20 to-transparent transform -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            </motion.button>
            
            {/* 3D Book Demo Button */}
            <motion.button
              whileHover={{ 
                scale: 1.1,
                rotateY: -5,
                rotateX: 5,
                boxShadow: "0 25px 50px -12px rgba(255, 0, 224, 0.3)"
              }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300 }}
              className="relative px-14 py-7 border-4 border-[#ff00e0] text-white rounded-2xl font-extrabold text-xl md:text-2xl overflow-hidden group"
            >
              <span className="relative z-10">Book Demo</span>
              <div className="absolute inset-0 bg-[#ff00e0] transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
              <span className="absolute inset-0 flex items-center justify-center text-[#0a0b0f] opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                Book Demo
              </span>
            </motion.button>
          </motion.div>
        </div>
      </section>
      {/* Optimized Background Elements - Reduced blur and complexity */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
        {/* Simplified gradient layer with reduced blur */}
        <motion.div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(circle at 30% 40%, rgba(255, 0, 224, 0.12) 0%, transparent 50%),
              radial-gradient(circle at 70% 60%, rgba(0, 132, 255, 0.08) 0%, transparent 45%)
            `,
            filter: 'blur(30px)',
            willChange: 'transform',
            transform: `translate3d(${mousePosition.x * 20}px, ${mousePosition.y * 20}px, 0)`,
          }}
        />

        {/* Reduced Floating Particles - 6 instead of 16 */}
        {!prefersReducedMotion && [...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white/60 rounded-full will-change-transform"
            style={{
              left: `${20 + (i * 12) % 60}%`,
              top: `${20 + (i * 15) % 60}%`,
            }}
            animate={{
              y: [-20, -60, -20],
              opacity: [0.3, 0.8, 0.3],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: 6 + (i % 2) * 2,
              repeat: Infinity,
              delay: i * 0.5,
              ease: "easeInOut"
            }}
          />
        ))}

        {/* Simplified nebula swirls with reduced blur */}
        <motion.div
          className="absolute top-10 left-6 w-80 h-80 md:w-96 md:h-96"
          style={{
            background: "radial-gradient(closest-side, rgba(168,85,247,0.15), transparent 70%)",
            filter: "blur(25px)",
            borderRadius: "50%",
            willChange: 'transform',
            transform: `translate3d(${mousePosition.x * 10}px, ${mousePosition.y * 10}px, 0)`
          }}
          animate={{ scale: [0.98, 1.05, 0.98] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-10 right-8 w-72 h-72 md:w-80 md:h-80"
          style={{
            background: "radial-gradient(closest-side, rgba(0,194,255,0.12), transparent 70%)",
            filter: "blur(25px)",
            borderRadius: "50%",
            willChange: 'transform',
            transform: `translate3d(${mousePosition.x * -8}px, ${mousePosition.y * -8}px, 0)`
          }}
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Preloader */}
      <AnimatePresence>
        {!isLoaded && <LoadingScreen />}
      </AnimatePresence>

      {/* Navigation */}
      {isLoaded && <NavBar onStartFreeTrial={handleStartFreeTrial} />}

      {/* Hero Section with Optimized Showcase */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Optimized Floating Elements - Only show when in view */}
        {isHeroInView && !prefersReducedMotion && (
          <div className="absolute inset-0 pointer-events-none">
            {/* Enhanced Floating Stars with Parallax Movement */}
            {[...Array(12)].map((_, i) => {
              const speed = 0.5 + (i % 3) * 0.3; // Different speeds for parallax
              const direction = i % 2 === 0 ? 1 : -1; // Alternate directions
              
              return (
                <motion.div
                  key={`floating-star-${i}`}
                  className="absolute will-change-transform"
                  style={{
                    top: `${15 + (i * 8) % 70}%`,
                    left: `${10 + (i * 10) % 80}%`,
                  }}
                  animate={{
                    y: [0, -12 * direction, 0],
                    x: [0, mousePosition.x * speed * 0.1, 0],
                    rotate: [0, 360, 0],
                    scale: [0.8, 1.2, 0.8],
                    opacity: [0.4, 0.9, 0.4],
                  }}
                  transition={{ 
                    duration: 6 + (i % 4), 
                    repeat: Infinity, 
                    delay: i * 0.3, 
                    ease: "easeInOut" 
                  }}
                >
                  <span className="text-white/70 text-2xl drop-shadow-lg">✦</span>
                </motion.div>
              );
            })}

            {/* Reduced Snowflakes - 5 instead of 10 */}
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={`flake-${i}`}
                className="absolute will-change-transform"
                style={{
                  top: `${(i * 18) % 80}%`,
                  left: `${(i * 20) % 80}%`,
                }}
                animate={{
                  y: [-15, 30],
                  opacity: [0.8, 0.5],
                }}
                transition={{ duration: 7 + i, repeat: Infinity, repeatType: "reverse", delay: i * 0.3, ease: "easeInOut" }}
              >
                <span className="text-cyan-200/60 text-xl">❄</span>
              </motion.div>
            ))}
          </div>
        )}
      
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="mb-8"
          >
            <motion.div 
              className="inline-block mt-10 md:mt-16 mb-6 px-3 py-2"
              whileHover={{ 
                scale: 1.05,
                transition: { duration: 0.2 }
              }}
            >
              <div className="relative inline-flex items-center justify-center">
                <span className="text-xl sm:text-3xl md:text-4xl leading-[1.35] tracking-normal font-extrabold whitespace-nowrap px-1 py-[3.5px] bg-gradient-to-r from-[#00ff9c] to-[#00c2ff] bg-clip-text text-transparent relative z-10 select-none font-techno">Ecomमित्र</span>
              </div>
            </motion.div>
            
            <motion.h1
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="text-4xl md:text-6xl font-extrabold mb-6 leading-tight bg-gradient-to-br from-[#00ff9c] via-[#00c2ff] to-[#ff00e0] bg-clip-text text-transparent"
            >
               With pride in our roots and love for every individual, we stand by small businesses — because you matter, and your dreams deserve to thrive!
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="text-xl md:text-2xl text-slate-300 max-w-4xl mx-auto mb-12 leading-relaxed"
            >
              Build the Future with <span className="text-[#00c2ff] font-semibold">Ecomमित्र</span>. Join and level up your business with constant monitoring and analysis of your ecommerce business.
            </motion.p>
          </motion.div>
          
          {/* Quick Wins Section */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.8 }}
            className="mb-16"
          >
            <motion.h2
              className="text-3xl md:text-4xl font-bold text-center mb-4 bg-gradient-to-r from-[#00ff9c] to-[#00c2ff] bg-clip-text text-transparent"
              whileHover={{ scale: 1.05 }}
            >
              Quick Wins for Your Business
            </motion.h2>
            <p className="text-lg text-slate-400 text-center mb-8 max-w-2xl mx-auto">
              See immediate results with these powerful benefits
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {quickWins.map((win, index: number) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.9 + index * 0.08 }}
                  whileHover={{ 
                    y: -8,
                    scale: 1.03,
                    transition: { duration: 0.2 }
                  }}
                  className="relative group"
                >
                  <div className={`bg-gradient-to-br ${win.color} p-1 rounded-2xl shadow-2xl`}>
                    <div className="bg-slate-900/90 backdrop-blur-xl p-6 rounded-xl border border-slate-700/50 h-full">
                      <div className="text-4xl mb-4 text-center">{win.icon}</div>
                      <div className={`w-full bg-gradient-to-br ${win.color} rounded-lg px-3 py-2 mb-3 text-center`}>
                        <span className="text-white font-bold text-sm">{win.metric}</span>
                      </div>
                      <h3 className="text-lg font-bold text-white mb-2 text-center">{win.title}</h3>
                      <p className="text-slate-300 text-sm leading-relaxed text-center">{win.description}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Business Benefits Section */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 1.2 }}
            className="mb-16"
          >
            <motion.h2
              className="text-4xl md:text-5xl font-bold text-center mb-4 bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent"
              whileHover={{ scale: 1.05 }}
            >
              🇮🇳 Built for Indian Businesses
            </motion.h2>
            <p className="text-xl text-slate-400 text-center mb-12 max-w-3xl mx-auto">
              Everything you need to succeed in the Indian e-commerce market
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {businessBenefits.map((benefit, index: number) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, delay: 1.4 + index * 0.08 }}
                  whileHover={{ 
                    scale: 1.03,
                    transition: { duration: 0.2 }
                  }}
                  className="bg-gradient-to-br from-slate-800/30 to-slate-900/30 backdrop-blur-md border border-orange-500/20 shadow-xl hover:border-orange-500/40 transition-all duration-300 p-6 rounded-xl"
                >
                  <div className="text-4xl mb-4 text-center">
                    {benefit.icon}
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2 text-center">{benefit.title}</h3>
                  <p className="text-slate-300 text-sm mb-3 text-center leading-relaxed">{benefit.description}</p>
                  <div className="text-center">
                    <span className="inline-block px-3 py-1 bg-gradient-to-r from-[#ff00e0] to-[#ff4d00] rounded-full text-xs font-semibold text-white">
                      {benefit.highlight}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.8 }}
            className="flex flex-col sm:flex-row gap-6 justify-center items-center"
          >
            <motion.div
              whileHover={{ 
                scale: 1.05, 
                boxShadow: "0 25px 50px -12px rgba(99, 102, 241, 0.5)"
              }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                size="lg"
                onClick={handleStartFreeTrial}
                className="text-xl px-12 py-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-2xl shadow-2xl shadow-indigo-500/25 border-0"
              >
                START FREE TRIAL
                <ArrowRight className="w-6 h-6 ml-3" />
              </Button>
            </motion.div>
            
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                variant="outline"
                size="lg"
                className="text-xl px-12 py-6 border-2 border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white font-semibold rounded-2xl"
              >
                <Play className="w-5 h-5 mr-3" />
                Watch Demo
              </Button>
            </motion.div>
          </motion.div>
        </div>

        {/* Realistic Galaxy Background - ESA Hubble Style */}
        {showGalacticStars && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* Galaxy Image Background */}
            <motion.div
              className="absolute inset-0 opacity-40"
              style={{
                backgroundImage: 'url("/cosmic-background.png")',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                filter: 'blur(1px)',
              }}
              animate={prefersReducedMotion ? {
                opacity: [0.3, 0.5, 0.3],
              } : {
                scale: [1, 1.02, 1],
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={prefersReducedMotion ? { duration: 20, repeat: Infinity, ease: "easeInOut" } : { duration: 40, repeat: Infinity, ease: "easeInOut" }}
            />
            
            {/* Additional Galaxy Layer for Depth */}
            <motion.div
              className="absolute inset-0 opacity-25"
              style={{
                backgroundImage: 'url("/cosmic-background.png")',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                filter: 'blur(3px)',
                transform: 'scale(1.1)',
              }}
              animate={prefersReducedMotion ? {
                opacity: [0.2, 0.3, 0.2],
              } : {
                scale: [1.1, 1.12, 1.1],
                rotate: [0, 1, 0],
                opacity: [0.2, 0.35, 0.2],
              }}
              transition={prefersReducedMotion ? { duration: 25, repeat: Infinity, ease: "easeInOut" } : { duration: 50, repeat: Infinity, ease: "easeInOut" }}
            />
            
            {/* Fallback Galaxy-like Gradient */}
            <motion.div
              className="absolute inset-0 opacity-30"
              style={{
                background: 'radial-gradient(ellipse at 30% 40%, rgba(143, 97, 187, 0.8) 0%, rgba(75, 0, 130, 0.6) 25%, rgba(25, 25, 112, 0.4) 50%, rgba(0, 0, 0, 0.2) 80%, transparent 100%)',
                filter: 'blur(2px)',
              }}
              animate={prefersReducedMotion ? {
                opacity: [0.2, 0.4, 0.2],
              } : {
                scale: [1, 1.05, 1],
                opacity: [0.2, 0.5, 0.2],
              }}
              transition={prefersReducedMotion ? { duration: 15, repeat: Infinity, ease: "easeInOut" } : { duration: 30, repeat: Infinity, ease: "easeInOut" }}
            />
            
            {/* Parallax Star Field - Creates illusion of movement through space */}
            <div className="absolute inset-0">
              {[...Array(80)].map((_, i) => {
                const colors = ['#FFFFFF', '#E0F7FF', '#FFF8E1', '#B0E0E6', '#FFE4E1', '#F0F8FF'];
                const randomColor = colors[i % colors.length];
                
                // Create different "layers" of stars for depth
                const layer = Math.floor(i / 20); // 4 layers (0-3)
                const size = layer === 0 ? Math.random() * 1 + 0.5 : // Far stars (small)
                             layer === 1 ? Math.random() * 1.5 + 1 : // Mid-far stars
                             layer === 2 ? Math.random() * 2 + 1.5 : // Mid-close stars
                             Math.random() * 3 + 2; // Close stars (large)
                
                const opacity = layer === 0 ? Math.random() * 0.3 + 0.1 : // Far stars (dim)
                                layer === 1 ? Math.random() * 0.4 + 0.2 : // Mid-far stars
                                layer === 2 ? Math.random() * 0.5 + 0.3 : // Mid-close stars
                                Math.random() * 0.7 + 0.4; // Close stars (bright)
                
                // Different movement speeds based on layer (parallax effect)
                const speedMultiplier = layer === 0 ? 0.1 : // Far stars move slowly
                                       layer === 1 ? 0.3 : // Mid-far stars
                                       layer === 2 ? 0.6 : // Mid-close stars
                                       1.0; // Close stars move fast
                
                // Random direction for each star
                const directionX = (Math.random() - 0.5) * 2; // -1 to 1
                const directionY = (Math.random() - 0.5) * 2; // -1 to 1
                
                return (
                  <motion.div
                    key={`parallax-star-${i}`}
                    className="absolute rounded-full"
                    style={{
                      left: `${Math.random() * 100}%`,
                      top: `${Math.random() * 100}%`,
                      width: size,
                      height: size,
                      background: randomColor,
                      boxShadow: `0 0 ${size * 6}px ${randomColor}`,
                      opacity: opacity,
                    }}
                    animate={prefersReducedMotion ? {
                      opacity: [opacity * 0.6, opacity, opacity * 0.6],
                    } : {
                      // Parallax movement based on mouse position
                      x: [
                        mousePosition.x * directionX * speedMultiplier * 0.5,
                        mousePosition.x * directionX * speedMultiplier * 1.5,
                        mousePosition.x * directionX * speedMultiplier * 0.5
                      ],
                      y: [
                        mousePosition.y * directionY * speedMultiplier * 0.5,
                        mousePosition.y * directionY * speedMultiplier * 1.5,
                        mousePosition.y * directionY * speedMultiplier * 0.5
                      ],
                      scale: [0.8, 1.2, 0.8],
                      opacity: [opacity * 0.3, opacity, opacity * 0.3],
                    }}
                    transition={{
                      duration: 3 + Math.random() * 4,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: Math.random() * 6,
                    }}
                  />
                );
              })}
            </div>
            
            {/* Warp Speed Lines - Enhanced parallax effect */}
            <div className="absolute inset-0 pointer-events-none">
              {[...Array(15)].map((_, i) => {
                const speed = 0.2 + (i % 3) * 0.2; // Different speeds
                const opacity = 0.1 + (i % 2) * 0.1; // Varying opacity
                const height = 1 + (i % 3); // Different line heights
                
                return (
                  <motion.div
                    key={`warp-line-${i}`}
                    className="absolute bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    style={{
                      left: `${Math.random() * 100}%`,
                      top: `${Math.random() * 100}%`,
                      width: '2px',
                      height: `${height}px`,
                      opacity: opacity,
                      transform: `rotate(${Math.random() * 360}deg)`,
                    }}
                    animate={{
                      x: [
                        mousePosition.x * speed * 0.3,
                        mousePosition.x * speed * 0.8,
                        mousePosition.x * speed * 0.3
                      ],
                      y: [
                        mousePosition.y * speed * 0.3,
                        mousePosition.y * speed * 0.8,
                        mousePosition.y * speed * 0.3
                      ],
                      scale: [0.5, 1.5, 0.5],
                      opacity: [opacity * 0.3, opacity, opacity * 0.3],
                    }}
                    transition={{
                      duration: 2 + Math.random() * 3,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: Math.random() * 4,
                    }}
                  />
                );
              })}
            </div>

          </div>
        )}
      </section>

      {/* Screenshot showcase section (neo-brutalist) */}
      <section className="py-20 sm:py-24 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-r from-[#00ff9c] to-[#00c2ff] bg-clip-text text-transparent">Dashboard Features</h2>
            <p className="mt-4 text-lg text-slate-400">Track your OP in a unified dashboard.</p>
          </div>
          <div className="max-w-7xl mx-auto">
            <img
              className="w-full rounded-lg shadow-2xl neo-brutalist-card border-[#00c2ff]/40 scale-110"
              alt="Futuristic dashboard screenshot"
              src="/dashboard.png" />
          </div>
        </div>
      </section>

      

      {/* Features Section */}
      <FeaturesGrid />

      {/* Bottom CTA */}
      <CTA onStart={handleStartFreeTrial} />

      {/* Footer */}
      <Footer />
    </div>
  );
}
