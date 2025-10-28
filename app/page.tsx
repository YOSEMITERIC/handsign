'use client';

import { Header, HeroSection } from "../components/";
import Footer from "../components/Footer";

export default function HomePage() {

  return (
    <div className="min-h-screen">
      <Header/>
      <HeroSection/>
      <Footer/>
    </div>
  )
}