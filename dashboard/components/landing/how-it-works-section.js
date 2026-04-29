"use client"

import { useRef } from "react"
import { motion, useInView, useScroll, useTransform } from "framer-motion"

const steps = [
  {
    number: "01",
    title: "Connect Your Brand",
    description: "Link your social media accounts and let HELIX analyze your existing content, audience, and brand voice.",
    image: "🔗",
  },
  {
    number: "02",
    title: "AI Analysis",
    description: "Our AI decodes your brand DNA, identifying patterns, strengths, and opportunities for growth.",
    image: "🧬",
  },
  {
    number: "03",
    title: "Get Strategies",
    description: "Receive personalized content strategies, posting schedules, and creative ideas tailored to your goals.",
    image: "📊",
  },
  {
    number: "04",
    title: "Grow & Scale",
    description: "Execute your strategy, track performance in real-time, and continuously optimize for better results.",
    image: "🚀",
  },
]

export function HowItWorksSection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  })

  const y = useTransform(scrollYProgress, [0, 1], [100, -100])

  return (
    <section ref={ref} id="how-it-works" className="py-24 md:py-32 relative overflow-hidden">
      {/* Background decoration */}
      <motion.div
        style={{ y }}
        className="absolute -left-1/4 top-1/4 w-96 h-96 bg-[#7c3aed]/10 rounded-full blur-[150px]"
      />
      <motion.div
        style={{ y: useTransform(scrollYProgress, [0, 1], [-100, 100]) }}
        className="absolute -right-1/4 bottom-1/4 w-96 h-96 bg-[#3b82f6]/10 rounded-full blur-[150px]"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-16 md:mb-24"
        >
          <span className="text-sm text-[#a78bfa] font-medium tracking-wider uppercase">
            Simple Process
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold mt-3 mb-4">
            <span className="text-slate-100">How HELIX</span>{" "}
            <span className="gradient-text">works</span>
          </h2>
          <p className="max-w-2xl mx-auto text-slate-400 text-lg">
            Get started in minutes and transform your social media strategy with AI-powered insights.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="relative">
          {/* Connection line */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#3a2d5e] to-transparent -translate-y-1/2" />

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
            {steps.map((step, i) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 50 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.2 + i * 0.15, duration: 0.6 }}
                className="relative"
              >
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="relative p-6 md:p-8 rounded-2xl bg-[#0a0612]/80 border border-[#1f1838] hover:border-[#3a2d5e] backdrop-blur-sm text-center group"
                >
                  {/* Step number */}
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-[#7c3aed] to-[#3b82f6] text-white text-sm font-bold">
                    {step.number}
                  </div>

                  {/* Icon */}
                  <motion.div
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.6 }}
                    className="text-5xl mb-6 mt-4"
                  >
                    {step.image}
                  </motion.div>

                  {/* Content */}
                  <h3 className="text-xl font-semibold text-slate-100 mb-3 group-hover:text-[#a78bfa] transition-colors">
                    {step.title}
                  </h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    {step.description}
                  </p>

                  {/* Connector arrow for desktop */}
                  {i < steps.length - 1 && (
                    <div className="hidden lg:block absolute top-1/2 -right-3 transform translate-x-1/2 -translate-y-1/2 z-10">
                      <motion.div
                        animate={{ x: [0, 5, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="w-6 h-6 rounded-full bg-[#1a0f33] border border-[#3a2d5e] flex items-center justify-center"
                      >
                        <svg className="w-3 h-3 text-[#a78bfa]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </motion.div>
                    </div>
                  )}
                </motion.div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="text-center mt-16"
        >
          <motion.a
            href="/chat"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            className="btn-primary inline-flex items-center gap-2 px-8 py-4 rounded-xl text-base font-semibold text-white"
          >
            Start Your Journey
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </motion.a>
        </motion.div>
      </div>
    </section>
  )
}
