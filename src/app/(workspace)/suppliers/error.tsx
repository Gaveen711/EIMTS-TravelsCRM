"use client";
import { Button } from "@/components/ui/button";
export default function Error({reset}:{reset:()=>void}){return <div role="alert" className="rounded-xl border p-6"><h2 className="font-semibold">The catalog could not be loaded</h2><p className="my-3">Try again in a moment.</p><Button onClick={reset}>Try again</Button></div>;}
