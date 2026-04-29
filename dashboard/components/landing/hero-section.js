"use client"

import { useRef } from "react"
import { motion, useScroll, useTransform } from "framer-motion"
import Link from "next/link"

export function HeroSection() {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  })

  const y = useTransform(scrollYProgress, [0, 1], [0, 200])
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0])
  const scale = useTransform(scrollYProgress, [0, 0.5], [1, 0.9])

  return (
    <section
      ref={ref}
      className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden"
    >
      <motion.div
        style={{ y, opacity, scale }}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center"
      >
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#3a2d5e] bg-[#1a0f33]/50 backdrop-blur-sm mb-8"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#7c3aed] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#a78bfa]" />
          </span>
          <span className="text-sm text-[#cbc6dd]">AI-Powered Social Media Strategy</span>
        </motion.div>

        {/* Main Heading */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display font-bold tracking-tight mb-6"
        >
          <span className="text-slate-100">The DNA of your brand,</span>
          <br />
          <span className="gradient-text">decoded.</span>
        </motion.h1>

        {/* Subheading */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="max-w-2xl mx-auto text-lg sm:text-xl text-slate-400 mb-10 text-balance"
        >
          Transform your social media presence with AI that understands your brand. 
          Get strategic insights, content ideas, and growth tactics tailored to your unique voice.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
            <Link
              href="/chat"
              className="btn-primary px-8 py-4 rounded-xl text-base font-semibold text-white inline-flex items-center gap-2"
            >
              Start Free Trial
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </Link>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
            <a
              href="#how-it-works"
              className="btn-secondary px-8 py-4 rounded-xl text-base font-semibold text-slate-100 inline-flex items-center gap-2"
            >
              Watch Demo
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </a>
          </motion.div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.8 }}
          className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto"
        >
          {[
            { value: "10K+", label: "Active Brands" },
            { value: "50M+", label: "Posts Analyzed" },
            { value: "3.2x", label: "Avg Growth" },
            { value: "98%", label: "Satisfaction" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8 + i * 0.1 }}
              className="text-center"
            >
              <div className="text-3xl md:text-4xl font-display font-bold gradient-text mb-1">
                {stat.value}
              </div>
              <div className="text-sm text-slate-500">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="flex flex-col items-center gap-2 text-slate-500"
          >
            <span className="text-xs tracking-wider uppercase">Scroll to explore</span>
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Floating 3D elements */}
      <motion.div
        className="absolute top-1/4 left-10 md:left-20"
        animate={{
          y: [0, -20, 0],
          rotate: [0, 5, 0],
        }}
        transition={{ duration: 6, repeat: Infinity }}
      >
        <div className="w-16 h-16 md:w-24 md:h-24 rounded-2xl bg-gradient-to-br from-[#7c3aed]/20 to-transparent border border-[#7c3aed]/30 backdrop-blur-sm" />
      </motion.div>

      <motion.div
        className="absolute bottom-1/4 right-10 md:right-20"
        animate={{
          y: [0, 20, 0],
          rotate: [0, -5, 0],
        }}
        transition={{ duration: 5, repeat: Infinity }}
      >
        <div className="w-20 h-20 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-[#3b82f6]/20 to-transparent border border-[#3b82f6]/30 backdrop-blur-sm" />
      </motion.div>

      <motion.div
        className="absolute top-1/3 right-1/4 hidden lg:block"
        animate={{
          y: [0, -15, 0],
          x: [0, 10, 0],
        }}
        transition={{ duration: 7, repeat: Infinity }}
      >
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#a78bfa]/20 to-transparent border border-[#a78bfa]/30 backdrop-blur-sm rotate-45" />
      </motion.div>
    </section>
  )
}
