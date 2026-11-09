import Link from "next/link";

export default function NotFound() {
  return <div className="card p-10 text-center"><h1 className="page-title">Not found</h1><p className="sub mt-1">This page does not exist, or your account cannot see it. <Link href="/login">Sign in</Link> with an expert account to see sources that have not been analysed.</p></div>;
}
