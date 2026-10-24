"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import "./print.css";

/** Content that only appears when the page is printed (window.print), outside the editor shell. Client-only editors. */
export function PrintPortal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(<div data-print-sheet="">{children}</div>, document.body);
}
