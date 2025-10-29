'use client';

import { Header, HeroSection } from "../components/";
import Footer from "../components/Footer";

export default function HomePage() {

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white text-slate-900">
      <Header/>
      <HeroSection/>
      <Footer/>
    </div>
  )
}