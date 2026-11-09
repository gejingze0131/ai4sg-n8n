"use client";

import dynamic from "next/dynamic";

export const ProjectMapLazy = dynamic(() => import("./ProjectMap"), { ssr: false, loading: () => <div className="h-[520px] grid place-items-center text-muted">Loading map…</div> });
