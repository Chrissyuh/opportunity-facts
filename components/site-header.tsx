"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/compare", label: "Compare" },
  { href: "/opportunities", label: "Examples" },
  { href: "/methodology", label: "How it works" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link className="wordmark" href="/" aria-label="Opportunity Facts home">
          <span className="wordmark-mark" aria-hidden="true">
            OF
          </span>
          <span>Opportunity Facts</span>
        </Link>
        <button
          className="menu-button"
          type="button"
          aria-controls="main-navigation"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Close" : "Menu"}
        </button>
        <nav
          id="main-navigation"
          className="main-nav"
          aria-label="Main navigation"
          data-open={open}
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              aria-current={
                pathname === link.href || pathname.startsWith(`${link.href}/`)
                  ? "page"
                  : undefined
              }
            >
              {link.label}
            </Link>
          ))}
          <Link className="nav-cta" href="/analyze" onClick={() => setOpen(false)}>
            Analyze an opportunity
          </Link>
        </nav>
      </div>
    </header>
  );
}
