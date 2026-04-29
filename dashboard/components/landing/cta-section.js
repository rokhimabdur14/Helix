"use client"

import { useRef } from "react"
import { motion, useInView, useScroll, useTransform } from "framer-motion"
import Link from "next/link"

export function CTASection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  })

  const scale = useTransform(scrollYProgress, [0, 0.5], [0.95, 1])
  const opacity = useTransform(scrollYProgress, [0, 0.3], [0.5, 1])

  return (
    <section ref={ref} className="py-24 md:py-32 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          style={{ scale, opacity }}
          className="relative rounded-3xl overflow-hidden"
        >
          {/* Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#1a0f33] via-[#0a0612] to-[#0d0820]" />
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20viewBox%3D%220%200%20256%20256%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cfilter%20id%3D%22noise%22%3E%3CfeTurbulence%20type%3D%22fractalNoise%22%20baseFrequency%3D%220.9%22%20numOctaves%3D%224%22%20stitchTiles%3D%22stitch%22%2F%3E%3C%2Ffilter%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20filter%3D%22url(%23noise)%22%2F%3E%3C%2Fsvg%3E')] opacity-[0.03]" />
          
          {/* Animated orbs */}
          <motion.div
            animate={{
              x: [0, 50, 0],
              y: [0, -30, 0],
            }}
            transition={{ duration: 8, repeat: Infinity }}
            className="absolute -top-20 -left-20 w-64 h-64 bg-[#7c3aed]/30 rounded-full blur-[100px]"
          />
          <motion.div
            animate={{
              x: [0, -40, 0],
              y: [0, 40, 0],
            }}
            transition={{ duration: 10, repeat: Infinity }}
            className="absolute -bottom-20 -right-20 w-80 h-80 bg-[#3b82f6]/30 rounded-full blur-[100px]"
          />

          {/* Content */}
          <div className="relative z-10 px-6 py-16 md:px-12 md:py-24 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold mb-6">
                <span className="text-slate-100">Ready to decode your</span>
                <br />
                <span className="gradient-text">{"brand's potential?"}</span>
              </h2>
              <p className="max-w-2xl mx-auto text-slate-400 text-lg mb-10">
                Join thousands of brands already using HELIX to transform their social media strategy. 
                Start your free trial today — no credit card required.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Link
                    href="/chat"
                    className="btn-primary px-10 py-4 rounded-xl text-base font-semibold text-white inline-flex items-center gap-2"
                  >
                    Start Free Trial
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Link>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <a
                    href="mailto:hello@helix.ai"
                    className="btn-secondary px-10 py-4 rounded-xl text-base font-semibold text-slate-100 inline-flex items-center gap-2"
                  >
                    Contact Sales
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </a>
                </motion.div>
              </div>

              {/* Trust badges */}
              <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-400">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>14-day free trial</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>No credit card required</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Cancel anytime</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Animated border */}
          <div className="absolute inset-0 rounded-3xl border border-[#3a2d5e]" />
        </motion.div>
      </div>
    </section>
  )
}
