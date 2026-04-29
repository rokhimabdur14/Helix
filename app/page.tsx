"use client"

import { useEffect, useRef, useState } from "react"
import { motion, useScroll, useTransform, useSpring, useInView } from "framer-motion"
import Link from "next/link"
import { Header } from "@/components/landing/header"
import { HeroSection } from "@/components/landing/hero-section"
import { FeaturesSection } from "@/components/landing/features-section"
import { HowItWorksSection } from "@/components/landing/how-it-works-section"
import { TestimonialsSection } from "@/components/landing/testimonials-section"
import { CTASection } from "@/components/landing/cta-section"
import { Footer } from "@/components/landing/footer"
import { ParallaxBackground } from "@/components/landing/parallax-background"

export default function LandingPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  })

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  })

  return (
    <div ref={containerRef} className="relative min-h-screen overflow-hidden">
      {/* Ambient background */}
      <div className="ambient-glow" />
      <div className="noise-overlay" />
      
      {/* Parallax background elements */}
      <ParallaxBackground scrollProgress={smoothProgress} />

      {/* Main content */}
      <div className="relative z-10">
        <Header />
        <main>
          <HeroSection />
          <FeaturesSection />
          <HowItWorksSection />
          <TestimonialsSection />
          <CTASection />
        </main>
        <Footer />
      </div>

      {/* Scroll progress indicator */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#3b82f6] via-[#7c3aed] to-[#a78bfa] origin-left z-50"
        style={{ scaleX: smoothProgress }}
      />
    </div>
  )
}
