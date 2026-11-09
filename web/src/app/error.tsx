"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return <div className="card p-10 text-center"><h1 className="page-title">Something went wrong</h1><p className="sub mt-1">The page could not be loaded. If the database or pipeline was restarting, it should be back in a minute.</p><button className="btn mt-3" onClick={reset}>Try again</button></div>;
}
