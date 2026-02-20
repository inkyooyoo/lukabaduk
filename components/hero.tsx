import Image from "next/image"
import Link from "next/link"

export default function Hero() {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <Image
        src="/images/hero-baduk.jpg"
        alt="바둑판 위의 흑백 돌"
        fill
        className="object-cover"
        priority
      />
      <div className="absolute inset-0 bg-foreground/60" />

      <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
        <p className="mb-4 text-sm font-medium uppercase tracking-[0.3em] text-primary-foreground/70">
          LUCA BADUK
        </p>
        <h1 className="font-serif text-4xl font-bold leading-tight text-primary-foreground md:text-6xl lg:text-7xl text-balance">
          바둑에 새로움을 더하다
          <br />
          루카바둑
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-primary-foreground/80 md:text-lg">
          루카바둑은 기존 바둑에 새로운 재미와 흥미를 더한 혁신적인 바둑입니다.
          <br className="hidden md:block" />
          루카바둑을 소개하고, 연구하며, 교육하는 전문 기업입니다.
        </p>
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href="#about"
            className="rounded-sm bg-primary-foreground px-8 py-3 text-sm font-medium text-foreground transition-opacity hover:opacity-90"
          >
            회사 소개
          </Link>
          <Link
            href="#contact"
            className="rounded-sm border border-primary-foreground/30 px-8 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-foreground/10"
          >
            문의하기
          </Link>
        </div>
      </div>
    </section>
  )
}
