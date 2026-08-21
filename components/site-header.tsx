"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [{ href: "/how-it-works", label: "How it works" }];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link className="wordmark" href="/" aria-label="Opportunity Facts home">
          <span>Opportunity Facts</span>
        </Link>
        <nav
          id="main-navigation"
          className="main-nav main-nav-single"
          aria-label="Main navigation"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={
                pathname === link.href || (link.href !== "/" && pathname.startsWith(`${link.href}/`))
                  ? "page"
                  : undefined
              }
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
