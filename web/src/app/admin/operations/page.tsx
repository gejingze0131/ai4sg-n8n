import type { Metadata } from "next";
import { OperationForms } from "@/components/actions/AdminActions";

export const metadata: Metadata = { title: "Re-screen and organise" };

export default function Operations() {
  return <OperationForms />;
}
