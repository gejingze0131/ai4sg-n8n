import type { Metadata } from "next";
import { RegisterForm } from "@/components/actions/AuthForms";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Register" };

export default function Register() {
  return <div className="max-w-[440px] mx-auto card p-6 mt-6"><h1 className="page-title mb-4">Create an account</h1><RegisterForm approval={env.expertSignup === "approval"} /></div>;
}
