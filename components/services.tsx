import { BookOpen, Lightbulb, Users } from "lucide-react"

const services = [
  {
    number: "01",
    icon: BookOpen,
    title: "루카바둑 소개",
    description:
      "기존 바둑에 새로운 규칙과 재미를 더한 루카바둑을 알기 쉽게 소개합니다. 초보자부터 전문가까지, 루카바둑만의 매력을 폭넓게 전달하는 콘텐츠와 행사를 기획하고 운영합니다.",
  },
  {
    number: "02",
    icon: Lightbulb,
    title: "루카바둑 연구",
    description:
      "루카바둑만의 전략과 패턴을 체계적으로 연구합니다. AI 기술과 실전 분석을 결합하여 루카바둑의 가능성을 탐구하고, 연구 결과를 교육 콘텐츠와 학술 자료로 발전시킵니다.",
  },
  {
    number: "03",
    icon: Users,
    title: "루카바둑 교육",
    description:
      "어린이, 청소년, 성인을 위한 맞춤형 루카바둑 교육 프로그램을 운영합니다. 수준별 커리큘럼과 온라인 강의를 통해 누구나 루카바둑의 재미를 경험할 수 있습니다.",
  },
]

export default function Services() {
  return (
    <section id="services" className="bg-foreground py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-4">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-primary-foreground/50">
            Our Services
          </p>
        </div>
        <h2 className="mb-16 font-serif text-3xl font-bold text-primary-foreground md:text-4xl lg:text-5xl text-balance">
          핵심 사업 영역
        </h2>

        <div className="grid gap-px bg-primary-foreground/10 md:grid-cols-3">
          {services.map((service) => (
            <div
              key={service.number}
              className="group bg-foreground p-8 transition-colors hover:bg-primary-foreground/5 lg:p-12"
            >
              <span className="font-serif text-sm text-primary-foreground/30">
                {service.number}
              </span>
              <service.icon className="mt-6 h-6 w-6 text-primary-foreground/60" />
              <h3 className="mt-4 font-serif text-xl font-bold text-primary-foreground md:text-2xl">
                {service.title}
              </h3>
              <p className="mt-4 text-sm leading-relaxed text-primary-foreground/60">
                {service.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
