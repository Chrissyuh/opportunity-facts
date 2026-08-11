"use client";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main className="narrow-shell section stack">
          <h1>Opportunity Facts hit an unexpected error.</h1>
          <p>No submitted source data was saved.</p>
          <button className="button" type="button" onClick={reset}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
