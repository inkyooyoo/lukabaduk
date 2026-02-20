import Image from "next/image"

const programs = [
  {
    title: "어린이 루카바둑 교실",
    audience: "6세 ~ 12세",
    description:
      "놀이와 루카바둑을 결합한 흥미로운 프로그램으로, 아이들의 논리적 사고력과 집중력을 재미있게 키워줍니다.",
  },
  {
    title: "청소년 심화 과정",
    audience: "13세 ~ 18세",
    description:
      "루카바둑의 전략을 체계적으로 학습하고, 대회 참가를 통해 실력을 한 단계 높여줍니다.",
  },
  {
    title: "성인 입문 클래스",
    audience: "성인 전체",
    description:
      "루카바둑을 처음 접하는 성인을 위한 과정으로, 기초 규칙부터 실전 전략까지 단계별로 배웁니다.",
  },
  {
    title: "온라인 마스터 클래스",
    audience: "중급 이상",
    description:
      "시간과 장소의 제약 없이 루카바둑의 고급 전략과 심화 학습이 가능합니다.",
  },
]

export default function Education() {
  return (
    <section id="education" className="py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-4">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
            Education
          </p>
        </div>

        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <h2 className="font-serif text-3xl font-bold leading-tight text-foreground md:text-4xl lg:text-5xl text-balance">
            맞춤형 루카바둑 교육 프로그램
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground md:text-base">
            모든 세대와 수준에 맞는 체계적인 커리큘럼으로 루카바둑의 즐거움과 가치를 전합니다.
          </p>
        </div>

        <div className="mt-16 relative overflow-hidden rounded-sm aspect-[21/9]">
          <Image
            src="/images/education.jpg"
            alt="바둑 교육 현장"
            fill
            className="object-cover"
          />
        </div>

        <div className="mt-16 grid gap-px border border-border md:grid-cols-2 lg:grid-cols-4">
          {programs.map((program) => (
            <div
              key={program.title}
              className="group border-r border-b border-border p-8 transition-colors hover:bg-muted/50 last:border-r-0 lg:p-10"
            >
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {program.audience}
              </p>
              <h3 className="mt-3 font-serif text-lg font-bold text-foreground">
                {program.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {program.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
