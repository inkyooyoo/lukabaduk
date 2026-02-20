import Link from "next/link"

const footerLinks = {
  사업영역: [
    { label: "루카바둑 소개", href: "#services" },
    { label: "루카바둑 연구", href: "#research" },
    { label: "루카바둑 교육", href: "#education" },
  ],
  회사: [
    { label: "회사 소개", href: "#about" },
    { label: "문의하기", href: "#contact" },
    { label: "게임하기", href: "/lukabaduk.html" },
    { label: "채용정보", href: "/recruitment" },
  ],
}

export default function Footer() {
  return (
    <footer className="border-t border-border bg-muted/50 py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid gap-12 md:grid-cols-3">
          <div>
            <Link href="/" className="font-serif text-xl font-bold text-foreground">
              루카바둑
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              기존 바둑에 새로움을 더한 루카바둑을 소개하고, 연구하며, 교육하는 전문 기업입니다.
            </p>
          </div>

          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {category}
              </p>
              <ul className="mt-4 space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-foreground transition-colors hover:text-muted-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 md:flex-row">
          <p className="text-xs text-muted-foreground">
            {'© 2026 루카바둑. All rights reserved.'}
          </p>
          <p className="text-xs text-muted-foreground">
            contact@lucabaduk.com
          </p>
        </div>
      </div>
    </footer>
  )
}
