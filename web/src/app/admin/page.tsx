import type { Metadata } from "next";
import { JobsTable } from "@/components/actions/AdminActions";

export const metadata: Metadata = { title: "Administration" };

export default function AdminHome() {
  return <section><h2 className="text-[17px] font-semibold mb-2">Pipeline jobs</h2><JobsTable /></section>;
}
