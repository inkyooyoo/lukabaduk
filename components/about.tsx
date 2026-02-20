import Image from "next/image"

export default function About() {
  return (
    <section id="about" className="py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-12">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
            About Us
          </p>
        </div>

        <div className="grid items-center gap-16 lg:grid-cols-2">
          <div>
            <h2 className="font-serif text-3xl font-bold leading-tight text-foreground md:text-4xl lg:text-5xl text-balance">
              더 재미있고 흥미로운
              <br />
              새로운 바둑의 시작
            </h2>
            <p className="mt-8 text-base leading-relaxed text-muted-foreground md:text-lg">
              루카바둑은 전통 바둑의 전략적 깊이에 새로운 규칙과 재미 요소를 더해 
              누구나 쉽고 흥미롭게 즐길 수 있도록 탄생한 혁신적인 바둑입니다. 
              기존 바둑의 진입 장벽을 낮추면서도, 전략적 사고의 본질은 그대로 담았습니다.
            </p>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
              우리는 루카바둑의 보급, 체계적인 연구, 
              그리고 맞춤형 교육 프로그램을 통해 
              모든 세대가 루카바둑의 재미와 가치를 경험할 수 있도록 돕고 있습니다.
            </p>

            <div className="mt-12 grid grid-cols-2 gap-8">
              <div>
                <p className="font-serif text-3xl font-bold text-foreground md:text-4xl">10+</p>
                <p className="mt-1 text-sm text-muted-foreground">년의 루카바둑 연구</p>
              </div>
              <div>
                <p className="font-serif text-3xl font-bold text-foreground md:text-4xl">5,000+</p>
                <p className="mt-1 text-sm text-muted-foreground">교육 수료 인원</p>
              </div>
            </div>
          </div>

          <div className="relative aspect-[4/5] overflow-hidden rounded-sm">
            <Image
              src="/images/about.jpg"
              alt="바둑돌 정물 사진"
              fill
              className="object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
