import Link from "next/link";

export default function HeroSection() {
  return (
    <section className="relative py-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-teal-600/5 to-emerald-600/5"></div>

      <div className="flex justify-center items-center space-x-6 mb-12">
        {["🤞", "🫰", "🤏", "🙌", "🤙"].map((i) => (
          <div key={i} className="group">
            <div className="w-20 h-20 bg-white rounded-2xl shadow-lg flex items-center justify-center border border-teal-100 group-hover:shadow-xl group-hover:shadow-teal-500/20 transition-all duration-300 transform group-hover:scale-110">
              <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-2xl font-bold">{i}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-8 leading-tight max-w-5xl mx-auto">
            Communicate With Deaf And Hard Of Hearing People
            <span className="inline-block ml-4">🤟</span>
          </h1>

          <p className="text-xl text-gray-600 max-w-4xl mx-auto mb-12 leading-relaxed">
            Project to recognize sign language and promote greater awareness and sensitivity toward the Deaf and Hard of Hearing community, Mix
          </p>

        <div className="flex  justify-center items-center gap-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              className="border-2 border-teal-600 text-teal-600 px-8 py-4 rounded-xl font-semibold text-lg hover:bg-teal-600 hover:text-white transition-all duration-300"
                href={{
                  pathname: '/predict',
                }}
              >
                Try it now
            </Link>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              className="border-2 border-teal-600 text-teal-600 px-8 py-4 rounded-xl font-semibold text-lg hover:bg-teal-600 hover:text-white transition-all duration-300"
                href={{
                  pathname: '/record',
                }}
              >
               Record it now
            </Link>
          </div>
        </div>

        </div>
      </div>
    </section>
  )
}