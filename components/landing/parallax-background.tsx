"use client"

import { motion, MotionValue, useTransform } from "framer-motion"

interface ParallaxBackgroundProps {
  scrollProgress: MotionValue<number>
}

export function ParallaxBackground({ scrollProgress }: ParallaxBackgroundProps) {
  // Create different parallax speeds for layers
  const y1 = useTransform(scrollProgress, [0, 1], [0, -200])
  const y2 = useTransform(scrollProgress, [0, 1], [0, -400])
  const y3 = useTransform(scrollProgress, [0, 1], [0, -600])
  const rotate1 = useTransform(scrollProgress, [0, 1], [0, 45])
  const rotate2 = useTransform(scrollProgress, [0, 1], [0, -30])
  const scale1 = useTransform(scrollProgress, [0, 0.5, 1], [1, 1.2, 1])
  const opacity1 = useTransform(scrollProgress, [0, 0.3, 0.7, 1], [0.6, 1, 1, 0.4])

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {/* Layer 1: Slow moving large orbs */}
      <motion.div
        className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#7c3aed]/20 blur-[100px]"
        style={{ y: y1, rotate: rotate1, scale: scale1 }}
      />
      <motion.div
        className="absolute top-1/4 -right-48 w-[500px] h-[500px] rounded-full bg-[#3b82f6]/15 blur-[120px]"
        style={{ y: y1, rotate: rotate2 }}
      />

      {/* Layer 2: Medium speed geometric shapes */}
      <motion.div
        className="absolute top-1/3 left-1/4 w-64 h-64"
        style={{ y: y2, opacity: opacity1 }}
      >
        <div className="w-full h-full border border-[#7c3aed]/20 rounded-3xl rotate-12 animate-[float-slow_8s_ease-in-out_infinite]" />
      </motion.div>
      <motion.div
        className="absolute top-2/3 right-1/4 w-48 h-48"
        style={{ y: y2 }}
      >
        <div className="w-full h-full border border-[#a78bfa]/15 rounded-full animate-[float-medium_6s_ease-in-out_infinite]" />
      </motion.div>

      {/* Layer 3: Fast moving small particles */}
      <motion.div style={{ y: y3 }} className="absolute inset-0">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-[#a78bfa]"
            style={{
              left: `${(i * 17) % 100}%`,
              top: `${(i * 23) % 100}%`,
              opacity: 0.3 + (i % 5) * 0.1,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 3 + (i % 3),
              repeat: Infinity,
              delay: i * 0.2,
            }}
          />
        ))}
      </motion.div>

      {/* DNA Helix lines */}
      <motion.svg
        className="absolute top-0 right-0 w-full h-full opacity-10"
        style={{ y: y2 }}
        viewBox="0 0 1000 2000"
        preserveAspectRatio="none"
      >
        <motion.path
          d="M800,0 Q850,200 750,400 Q650,600 800,800 Q950,1000 750,1200 Q550,1400 800,1600 Q1050,1800 800,2000"
          fill="none"
          stroke="url(#helixGradient)"
          strokeWidth="2"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 3, ease: "easeInOut" }}
        />
        <defs>
          <linearGradient id="helixGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="50%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
        </defs>
      </motion.svg>

      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(167, 139, 250, 0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(167, 139, 250, 0.5) 1px, transparent 1px)
          `,
          backgroundSize: "100px 100px",
        }}
      />
    </div>
  )
}
