import Image from "next/image"
import Link from "next/link"

export default function Research() {
  return (
    <section id="research" className="py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-4">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
            Research
          </p>
        </div>

        <div className="grid items-center gap-16 lg:grid-cols-2">
          <div className="relative aspect-[3/4] overflow-hidden rounded-sm lg:order-1">
            <Image
              src="/images/research.jpg"
              alt="바둑 연구 현장"
              fill
              className="object-cover"
            />
          </div>

          <div className="lg:order-2">
            <h2 className="font-serif text-3xl font-bold leading-tight text-foreground md:text-4xl lg:text-5xl text-balance">
              끊임없이 진화하는
              <br />
              루카바둑 연구
            </h2>
            <p className="mt-8 text-base leading-relaxed text-muted-foreground md:text-lg">
              루카바둑 연구소는 루카바둑만의 고유한 전략과 패턴을 깊이 있게 탐구합니다. 
              기존 바둑과 차별화되는 루카바둑의 규칙과 전략을 분석하고, 
              더 재미있고 균형 잡힌 게임으로 발전시켜 나갑니다.
            </p>

            <ul className="mt-8 space-y-4">
              {[
                "루카바둑 고유 전략 및 패턴 분석",
                "루카바둑 교육 방법론 개발",
                "게임 밸런스 및 규칙 최적화 연구",
                "루카바둑과 사고력 향상의 상관관계 연구",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground" />
                  <span className="text-sm text-muted-foreground md:text-base">{item}</span>
                </li>
              ))}
            </ul>

            <Link
              href="#contact"
              className="mt-10 inline-block rounded-sm border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              연구 협력 문의
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
