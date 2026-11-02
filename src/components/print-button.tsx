"use client";
import { Printer } from "lucide-react";
export default function PrintButton() {
  return (
    <button className="primary" onClick={() => window.print()}>
      <Printer size={16} />
      Print / Save PDF
    </button>
  );
}
