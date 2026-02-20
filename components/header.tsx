"use client"

import { useState } from "react"
import Link from "next/link"
import { Menu, X } from "lucide-react"

const navLinks = [
  { label: "소개", href: "#about" },
  { label: "사업영역", href: "#services" },
  { label: "연구", href: "#research" },
  { label: "교육", href: "#education" },
  { label: "연락처", href: "#contact" },
  { label: "게임하기", href: "/lukabaduk.html", external: true },
]

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
        <Link href="/" className="font-serif text-lg sm:text-xl font-bold tracking-tight text-foreground shrink-0">
          루카바둑
        </Link>

        <nav className="hidden items-center gap-6 lg:gap-8 md:flex min-w-0">
          {navLinks.map((link) => {
            const isGame = link.label === "게임하기";
            const linkClass = isGame
              ? "text-base font-bold text-amber-800 transition-colors hover:text-amber-700"
              : "text-sm font-medium text-muted-foreground transition-colors hover:text-foreground";
            return "external" in link && link.external ? (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                {link.label}
              </a>
            ) : (
              <Link key={link.href} href={link.href} className={linkClass}>
                {link.label}
              </Link>
            );
          })}
        </nav>

        <Link
          href="#contact"
          className="hidden rounded-sm bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 md:inline-block"
        >
          문의하기
        </Link>

        <button
          className="md:hidden text-foreground p-2 -m-2 min-w-[44px] min-h-[44px] flex items-center justify-center touch-manipulation"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "메뉴 닫기" : "메뉴 열기"}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-border bg-background px-4 py-5 md:hidden max-h-[calc(100vh-4rem)] overflow-y-auto overscroll-contain">
          <nav className="flex flex-col gap-0">
            {navLinks.map((link) => {
              const isGame = link.label === "게임하기";
              const linkClass = isGame
                ? "py-3.5 text-lg font-bold text-amber-800 transition-colors hover:text-amber-700 touch-manipulation"
                : "py-3.5 text-base font-medium text-muted-foreground transition-colors hover:text-foreground touch-manipulation";
              return "external" in link && link.external ? (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMobileOpen(false)}
                  className={linkClass}
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={linkClass}
                >
                  {link.label}
                </Link>
              );
            })}
            <Link
              href="#contact"
              onClick={() => setMobileOpen(false)}
              className="mt-4 rounded-sm bg-primary px-5 py-3.5 text-center text-sm font-medium text-primary-foreground touch-manipulation"
            >
              문의하기
            </Link>
          </nav>
        </div>
      )}
    </header>
  )
}
