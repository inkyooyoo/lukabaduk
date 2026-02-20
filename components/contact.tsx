"use client"

import { Mail, MapPin, Phone } from "lucide-react"

export default function Contact() {
  return (
    <section id="contact" className="py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-4">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
            Contact
          </p>
        </div>

        <h2 className="font-serif text-3xl font-bold text-foreground md:text-4xl lg:text-5xl text-balance">
          함께 이야기 나눠보세요
        </h2>
        <p className="mt-4 max-w-lg text-base text-muted-foreground">
          루카바둑에 관한 모든 문의를 환영합니다. 교육, 연구 협력, 행사 기획 등 어떤 주제든 편하게 연락해주세요.
        </p>

        <div className="mt-16 grid gap-16 lg:grid-cols-2">
          <form
            onSubmit={(e) => e.preventDefault()}
            className="space-y-6"
          >
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  이름
                </label>
                <input
                  id="name"
                  type="text"
                  className="w-full border-b border-border bg-transparent py-3 text-sm text-foreground outline-none transition-colors focus:border-foreground placeholder:text-muted-foreground/50"
                  placeholder="홍길동"
                />
              </div>
              <div>
                <label htmlFor="email" className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  이메일
                </label>
                <input
                  id="email"
                  type="email"
                  className="w-full border-b border-border bg-transparent py-3 text-sm text-foreground outline-none transition-colors focus:border-foreground placeholder:text-muted-foreground/50"
                  placeholder="example@email.com"
                />
              </div>
            </div>
            <div>
              <label htmlFor="subject" className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                문의 유형
              </label>
              <select
                id="subject"
                className="w-full border-b border-border bg-transparent py-3 text-sm text-foreground outline-none transition-colors focus:border-foreground"
              >
                <option value="">선택해주세요</option>
                <option value="education">교육 프로그램 문의</option>
                <option value="research">연구 협력 문의</option>
                <option value="event">행사 기획 문의</option>
                <option value="other">기타 문의</option>
              </select>
            </div>
            <div>
              <label htmlFor="message" className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                메시지
              </label>
              <textarea
                id="message"
                rows={4}
                className="w-full resize-none border-b border-border bg-transparent py-3 text-sm text-foreground outline-none transition-colors focus:border-foreground placeholder:text-muted-foreground/50"
                placeholder="문의 내용을 입력해주세요."
              />
            </div>
            <button
              type="submit"
              className="rounded-sm bg-primary px-8 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              보내기
            </button>
          </form>

          <div className="flex flex-col justify-center gap-8">
            <div className="flex items-start gap-4">
              <MapPin className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">주소</p>
                <p className="mt-1 text-sm text-foreground">서울특별시 강남구 테헤란로 123, 루카빌딩 5층</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <Phone className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">전화</p>
                <p className="mt-1 text-sm text-foreground">02-1234-5678</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <Mail className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">이메일</p>
                <p className="mt-1 text-sm text-foreground">contact@lucabaduk.com</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
