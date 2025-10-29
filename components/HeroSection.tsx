import Link from "next/link";

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8 isolate">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-emerald-50/80 via-white to-white pointer-events-none" />

      <div className="mb-10 sm:mb-12 flex flex-wrap justify-center gap-4 sm:gap-6">
        {["🤞", "🫰", "🤏", "🙌", "🤙"].map((i) => (
          <div key={i} className="group transition-transform duration-300 hover:scale-110">
            <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 bg-white rounded-2xl shadow-lg border border-teal-100 flex items-center justify-center group-hover:shadow-xl group-hover:shadow-teal-500/20">
              <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl grid place-items-center">
                <span className="text-white text-xl sm:text-2xl md:text-3xl font-bold">{i}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="relative z-10 mx-auto max-w-7xl text-center">
        <h1 className="mx-auto mb-6 sm:mb-8 max-w-5xl text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-tight text-slate-900">
          Communicate With Deaf And Hard Of Hearing People
          <span className="ml-2 inline-block">🤟</span>
        </h1>

        <p className="mx-auto mb-8 sm:mb-12 max-w-3xl sm:max-w-4xl text-base sm:text-lg md:text-xl leading-relaxed text-slate-600">
          Project to recognize sign language and promote greater awareness and sensitivity toward the Deaf and Hard of Hearing community, Mix
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4">
          <Link
            href="/predict"
            className="w-full sm:w-auto border-2 border-emerald-600 text-emerald-700 px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-semibold text-base sm:text-lg hover:bg-emerald-600 hover:text-white transition-all duration-300 text-center"
          >
            Try it now
          </Link>
          <Link
            href="/record"
            className="w-full sm:w-auto border-2 border-emerald-600 text-emerald-700 px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-semibold text-base sm:text-lg hover:bg-emerald-600 hover:text-white transition-all duration-300 text-center"
          >
            Record it now
          </Link>
        </div>
      </div>
    </section>
  );
}
