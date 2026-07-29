import { render, screen } from "@testing-library/react";
import { Icon } from "@/components/Icon";

describe("Icon", () => {
  it("renders an img with correct src for dark variant", () => {
    render(<Icon name="dashboard" />);
    const img = document.querySelector("img")!;
    expect(img).toHaveAttribute("src", "/icons/dark/dashboard.png");
  });

  it("renders light variant", () => {
    render(<Icon name="dashboard" variant="light" />);
    const img = document.querySelector("img")!;
    expect(img).toHaveAttribute("src", "/icons/light/dashboard.png");
  });

  it("uses default size 20", () => {
    render(<Icon name="dashboard" />);
    const img = document.querySelector("img")!;
    expect(img).toHaveAttribute("width", "20");
    expect(img).toHaveAttribute("height", "20");
  });

  it("respects custom size", () => {
    render(<Icon name="dashboard" size={32} />);
    const img = document.querySelector("img")!;
    expect(img).toHaveAttribute("width", "32");
    expect(img).toHaveAttribute("height", "32");
  });

  it("is not draggable", () => {
    render(<Icon name="dashboard" />);
    const img = document.querySelector("img")!;
    expect(img).toHaveAttribute("draggable", "false");
  });

  it("applies className when provided", () => {
    render(<Icon name="dashboard" className="custom-icon" />);
    const img = document.querySelector("img")!;
    expect(img.className).toContain("custom-icon");
  });
});
