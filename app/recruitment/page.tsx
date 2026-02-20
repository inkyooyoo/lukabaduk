import Link from "next/link"
import Header from "@/components/header"
import Footer from "@/components/footer"
import { ArrowLeft } from "lucide-react"

export const metadata = {
  title: "채용정보 | 루카바둑",
  description: "루카바둑 채용 정보 및 MD(마케팅 디렉터) 자격요건 안내",
}

export default function RecruitmentPage() {
  return (
    <>
      <Header />
      <main className="pt-24 pb-16">
        <div className="mx-auto max-w-3xl px-6 lg:px-8">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            메인으로 돌아가기
          </Link>

          <h1 className="font-serif text-3xl font-bold text-foreground md:text-4xl">
            채용정보
          </h1>
          <p className="mt-4 text-base text-muted-foreground">
            루카바둑과 함께 성장할 인재를 찾고 있습니다.
          </p>

          <div className="mt-12 border-t border-border pt-12">
            <h2 className="font-serif text-xl font-bold text-foreground">
              MD (마케팅 디렉터) 모집
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              루카바둑 브랜드 및 사업 확장을 이끌 마케팅 디렉터를 모집합니다.
            </p>

            <div className="mt-8 space-y-6">
              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                  자격요건
                </h3>
                <ul className="mt-4 space-y-2 text-sm leading-relaxed text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground" />
                    대학(4년제) 졸업 이상 또는 동등한 학력
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground" />
                    마케팅 또는 경영 관련 직무 5년 이상 경력
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground" />
                    교육·문화 사업 또는 스포츠/게임 산업 경험 우대
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground" />
                    브랜드 전략 수립 및 실행 경험 보유
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground" />
                    팀 리딩 및 프로젝트 관리 능력
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground" />
                    디지털 마케팅 및 SNS 활용 역량
                  </li>
                </ul>
              </section>

              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                  우대사항
                </h3>
                <ul className="mt-4 space-y-2 text-sm leading-relaxed text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground" />
                    바둑 또는 보드게임에 대한 이해 및 관심
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground" />
                    콘텐츠 기획·제작 경험
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground" />
                    해외 시장 진출 또는 글로벌 마케팅 경험
                  </li>
                </ul>
              </section>

              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                  담당 업무
                </h3>
                <ul className="mt-4 space-y-2 text-sm leading-relaxed text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground" />
                    루카바둑 브랜드 전략 수립 및 실행
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground" />
                    마케팅 팀 운영 및 예산 관리
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground" />
                    온·오프라인 마케팅 캠페인 기획 및 실행
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground" />
                    사업 파트너십 및 협력 네트워크 구축
                  </li>
                </ul>
              </section>

              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                  지원 방법
                </h3>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  이력서 및 자기소개서를 contact@lucabaduk.com으로 보내 주시거나,{" "}
                  <Link href="/#contact" className="underline hover:text-foreground">
                    문의하기
                  </Link>
                  에서 채용 문의를 남겨 주세요.
                </p>
              </section>
            </div>
          </div>

          <div className="mt-16 flex justify-center">
            <Link
              href="/#contact"
              className="rounded-sm bg-primary px-8 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              지원 문의하기
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
