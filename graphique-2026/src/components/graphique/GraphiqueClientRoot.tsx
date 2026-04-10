"use client";
// Client component wrapper — allows dynamic() with ssr: false
import dynamic from "next/dynamic";
import { GraphiqueProvider } from "@/store/graphique-store";

const GraphiqueApp = dynamic(() => import("./GraphiqueApp"), { ssr: false });

export default function GraphiqueClientRoot() {
  return (
    <GraphiqueProvider>
      <GraphiqueApp />
    </GraphiqueProvider>
  );
}