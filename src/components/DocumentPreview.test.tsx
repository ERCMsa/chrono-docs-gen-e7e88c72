import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import DocumentPreview from "@/components/DocumentPreview";
import type { Worker } from "@/lib/supabase-helpers";

const worker = {
  id: "w1",
  full_name: "Test Worker",
  matricule: "001",
  position: "Agent",
  department: "PRODUCTION",
} as unknown as Worker;

describe("DocumentPreview autorisation_absence", () => {
  it("renders the absence template", () => {
    const { container } = render(
      <DocumentPreview
        type="autorisation_absence"
        worker={worker}
        data={{
          reference: "AA-001/2026",
          absence_mode: "single",
          absence_date: "2026-10-26",
          absence_end_date: "",
          reason: "Raisons familiales",
        }}
      />,
    );
    expect(screen.getByText("AUTORISATION D'ABSENCE")).toBeTruthy();
    expect(screen.getByText("Test Worker")).toBeTruthy();
    expect(container.innerHTML.length).toBeGreaterThan(500);
  });

  it("renders a range", () => {
    render(
      <DocumentPreview
        type="autorisation_absence"
        worker={worker}
        data={{
          reference: "AA-002/2026",
          absence_mode: "range",
          absence_date: "2026-10-26",
          absence_end_date: "2026-11-02",
          reason: "Congé",
        }}
      />,
    );
    expect(screen.getByText(/26\/10\/2026 → 02\/11\/2026/)).toBeTruthy();
  });
});
