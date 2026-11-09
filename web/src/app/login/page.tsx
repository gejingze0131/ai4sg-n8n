import type { Metadata } from "next";
import { LoginForm } from "@/components/actions/AuthForms";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Sign in" };

export default function Login() {
  return <div className="max-w-[400px] mx-auto card p-6 mt-6"><h1 className="page-title mb-4">Sign in</h1><LoginForm mailEnabled={env.mailEnabled} /></div>;
}
