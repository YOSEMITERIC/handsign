// app/components/Header.tsx
"use client";
import { useState } from "react";
import Link from "next/link";

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-teal-100 shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Top row */}
        <div className="flex items-center justify-between py-4 md:py-6">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-teal-600 to-emerald-600">
              <span className="text-xl font-bold text-white">M</span>
            </div>
            <span className="bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-2xl font-bold text-transparent">
              Mix
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:block">
            <ul className="flex items-center gap-8 text-gray-700 font-medium">
              <li><Link className="hover:text-gray-900" href="/settings">Settings</Link></li>
              <li><Link className="hover:text-gray-900" href="/customize">Customize</Link></li>
              <li><Link className="hover:text-gray-900" href="/about">About</Link></li>
            </ul>
          </nav>

          {/* Mobile menu button */}
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={open}
            className="md:hidden inline-flex items-center justify-center rounded-lg p-2 text-gray-700 hover:bg-gray-100"
          >
            {/* Hamburger / X */}
            <svg
              className={`h-6 w-6 transition-transform ${open ? "rotate-90" : ""}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              {open ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile nav (collapsible) */}
        <div
          className={`md:hidden overflow-hidden transition-[max-height,opacity] duration-200 ${
            open ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <nav className="pb-4">
            <ul className="grid gap-2 text-gray-700 font-medium">
              <li>
                <Link
                  href="/settings"
                  className="block rounded-lg px-3 py-2 hover:bg-gray-100"
                  onClick={() => setOpen(false)}
                >
                  Settings
                </Link>
              </li>
              <li>
                <Link
                  href="/customize"
                  className="block rounded-lg px-3 py-2 hover:bg-gray-100"
                  onClick={() => setOpen(false)}
                >
                  Customize
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="block rounded-lg px-3 py-2 hover:bg-gray-100"
                  onClick={() => setOpen(false)}
                >
                  About
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </header>
  );
}
