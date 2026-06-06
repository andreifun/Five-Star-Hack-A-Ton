"use client"

import { motion } from "framer-motion"
import { Logo } from "./logo"
import { BusinessSwitcher } from "./business-switcher"

export function Header() {
  return (
    <motion.div
      className="flex items-center overflow-hidden rounded-full bg-muted pr-0.5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center px-4 py-2.5">
        <Logo className="h-5" />
      </div>
      <BusinessSwitcher />
    </motion.div>
  )
}
