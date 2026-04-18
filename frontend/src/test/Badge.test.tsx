import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "../components/ui/Badge";

describe("Badge", () => {
  it("renders children", () => {
    render(<Badge>active</Badge>);
    expect(screen.getByText("active")).toBeInTheDocument();
  });

  it("applies success variant class", () => {
    render(<Badge variant="success">ok</Badge>);
    const el = screen.getByText("ok");
    expect(el.className).toContain("text-success");
  });

  it("applies danger variant class", () => {
    render(<Badge variant="danger">error</Badge>);
    const el = screen.getByText("error");
    expect(el.className).toContain("text-danger");
  });

  it("applies warning variant class", () => {
    render(<Badge variant="warning">warn</Badge>);
    const el = screen.getByText("warn");
    expect(el.className).toContain("text-warning");
  });

  it("applies default variant by default", () => {
    render(<Badge>default</Badge>);
    const el = screen.getByText("default");
    expect(el.className).toContain("text-text-secondary");
  });

  it("merges custom className", () => {
    render(<Badge className="custom-class">x</Badge>);
    const el = screen.getByText("x");
    expect(el.className).toContain("custom-class");
  });
});
