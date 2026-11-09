import { notFound } from "next/navigation";
import { ResetForm } from "@/components/actions/AuthForms";
import { env } from "@/lib/env";

export default function Reset() {
  if (!env.mailEnabled) notFound();
  return <div className="max-w-[400px] mx-auto card p-6 mt-6"><h1 className="page-title mb-4">Choose a new password</h1><ResetForm /></div>;
}
