import { notFound } from "next/navigation";
import { ForgotForm } from "@/components/actions/AuthForms";
import { env } from "@/lib/env";

export default function Forgot() {
  if (!env.mailEnabled) notFound();
  return <div className="max-w-[400px] mx-auto card p-6 mt-6"><h1 className="page-title mb-4">Reset your password</h1><ForgotForm /></div>;
}
