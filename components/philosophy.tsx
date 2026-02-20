export default function Philosophy() {
  return (
    <section className="bg-foreground py-24 lg:py-32">
      <div className="mx-auto max-w-4xl px-6 text-center lg:px-8">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-primary-foreground/50">
          Our Philosophy
        </p>
        <blockquote className="mt-8 font-serif text-2xl font-bold leading-relaxed text-primary-foreground md:text-3xl lg:text-4xl text-balance">
          {'"'}익숙한 바둑에 새로움을 더하면,
          <br />
          누구나 빠져드는 재미가 됩니다.{'"'}
        </blockquote>
        <p className="mt-8 text-sm text-primary-foreground/50">
          루카바둑이 추구하는 가치
        </p>

        <div className="mt-16 grid gap-8 text-left md:grid-cols-3">
          {[
            {
              title: "재미",
              description: "기존 바둑의 틀을 넘어, 누구나 흥미롭게 즐길 수 있는 새로운 경험을 만듭니다.",
            },
            {
              title: "혁신",
              description: "전통 바둑의 깊이 위에 참신한 규칙과 요소를 더해 끊임없이 진화합니다.",
            },
            {
              title: "성장",
              description: "루카바둑을 통해 전략적 사고력과 창의력을 키우며 함께 성장합니다.",
            },
          ].map((value) => (
            <div key={value.title} className="border-t border-primary-foreground/10 pt-6">
              <h3 className="font-serif text-lg font-bold text-primary-foreground">
                {value.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-primary-foreground/60">
                {value.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
