"use client"

import { useRef } from "react"
import { motion, useInView } from "framer-motion"

const testimonials = [
  {
    quote: "HELIX transformed how we approach content. Our engagement increased 340% in just 3 months.",
    author: "Sarah Chen",
    role: "Marketing Director",
    company: "TechFlow Inc",
    avatar: "SC",
  },
  {
    quote: "The AI insights are incredibly accurate. It&apos;s like having a social media expert available 24/7.",
    author: "Michael Torres",
    role: "Founder",
    company: "CreativeStudio",
    avatar: "MT",
  },
  {
    quote: "We&apos;ve tried many tools, but HELIX is the only one that truly understands our brand voice.",
    author: "Emily Rodriguez",
    role: "Content Lead",
    company: "BrandNova",
    avatar: "ER",
  },
  {
    quote: "The content suggestions are spot-on every time. It&apos;s revolutionized our workflow.",
    author: "David Kim",
    role: "Social Media Manager",
    company: "GrowthLabs",
    avatar: "DK",
  },
  {
    quote: "HELIX helped us identify trends we would have missed. Game-changing for our strategy.",
    author: "Lisa Wang",
    role: "CMO",
    company: "Sparkle Beauty",
    avatar: "LW",
  },
  {
    quote: "From analytics to content creation, HELIX does it all. Best investment we&apos;ve made.",
    author: "James Miller",
    role: "CEO",
    company: "Nexus Digital",
    avatar: "JM",
  },
]

export function TestimonialsSection() {
  const ref = useRef<HTMLElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  return (
    <section ref={ref} id="testimonials" className="py-24 md:py-32 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <span className="text-sm text-[#a78bfa] font-medium tracking-wider uppercase">
            Testimonials
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold mt-3 mb-4">
            <span className="text-foreground">Loved by</span>{" "}
            <span className="gradient-text">brands worldwide</span>
          </h2>
          <p className="max-w-2xl mx-auto text-muted-foreground text-lg">
            See what industry leaders are saying about their experience with HELIX.
          </p>
        </motion.div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((testimonial, i) => (
            <motion.div
              key={testimonial.author}
              initial={{ opacity: 0, y: 40 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.1 + i * 0.1, duration: 0.6 }}
            >
              <motion.div
                whileHover={{ y: -5 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="h-full p-6 md:p-8 rounded-2xl bg-[#0a0612]/80 border border-[#1f1838] hover:border-[#3a2d5e] backdrop-blur-sm relative overflow-hidden group"
              >
                {/* Quote mark */}
                <div className="absolute top-6 right-6 text-6xl text-[#1f1838] font-serif group-hover:text-[#3a2d5e] transition-colors">
                  &ldquo;
                </div>

                {/* Content */}
                <div className="relative z-10">
                  <p className="text-foreground mb-6 leading-relaxed">
                    {testimonial.quote}
                  </p>

                  {/* Author */}
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#7c3aed] to-[#3b82f6] flex items-center justify-center text-white font-semibold">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <div className="font-semibold text-foreground">{testimonial.author}</div>
                      <div className="text-sm text-muted-foreground">
                        {testimonial.role}, {testimonial.company}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Hover gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#7c3aed]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </motion.div>
            </motion.div>
          ))}
        </div>

        {/* Logos marquee */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: 0.8 }}
          className="mt-16 pt-16 border-t border-[#1f1838]"
        >
          <p className="text-center text-sm text-muted-foreground mb-8">
            Trusted by leading brands
          </p>
          <div className="relative overflow-hidden">
            <div className="flex gap-12 items-center justify-center flex-wrap opacity-40">
              {["TechFlow", "CreativeStudio", "BrandNova", "GrowthLabs", "Nexus Digital", "Sparkle Beauty"].map((brand) => (
                <motion.div
                  key={brand}
                  whileHover={{ opacity: 1 }}
                  className="text-xl font-display font-bold text-foreground"
                >
                  {brand}
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
