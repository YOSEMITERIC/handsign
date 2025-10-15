export default function Header() {
  return (
    <header className="bg-white/80 backdrop-blur-xl border-b border-teal-100 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-teal-600 to-emerald-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-xl">M</span>
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">Mix</span>
          </div>
          <button className="bg-gradient-to-r from-teal-600 to-emerald-600 text-white px-6 py-3 rounded-xl font-medium hover:shadow-lg hover:shadow-teal-500/25 transition-all duration-300 transform hover:-translate-y-0.5">
            Get Started
          </button>
        </div>
      </div>
    </header>
  )
}