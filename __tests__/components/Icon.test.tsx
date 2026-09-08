import { render } from "@testing-library/react";
import { Icon } from "@/components/Icon";

describe("Icon", () => {
  it("renders an inline svg with currentColor fill", () => {
    const { container } = render(<Icon name="dashboard" />);
    const svg = container.querySelector("svg")!;
    expect(svg).toBeTruthy();
    expect(svg.querySelector("path")).toHaveAttribute("fill", "currentColor");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("uses currentColor as default color (dark variant)", () => {
    const { container } = render(<Icon name="dashboard" />);
    const svg = container.querySelector("svg")!;
    expect(svg.style.color).toBe("");
  });

  it("applies a cream color for light variant", () => {
    const { container } = render(<Icon name="dashboard" variant="light" />);
    const svg = container.querySelector("svg")!;
    expect(svg.style.color).toBe("rgb(250, 248, 242)");
  });

  it("uses default size 20", () => {
    const { container } = render(<Icon name="dashboard" />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("width", "20");
    expect(svg).toHaveAttribute("height", "20");
  });

  it("respects custom size", () => {
    const { container } = render(<Icon name="dashboard" size={32} />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("width", "32");
    expect(svg).toHaveAttribute("height", "32");
  });

  it("is not draggable", () => {
    const { container } = render(<Icon name="dashboard" />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("focusable", "false");
  });

  it("applies className when provided", () => {
    const { container } = render(<Icon name="dashboard" className="custom-icon" />);
    const svg = container.querySelector("svg")!;
    expect(svg.className.baseVal).toContain("custom-icon");
  });

  it("supports overriding color via prop", () => {
    const { container } = render(<Icon name="dashboard" color="#ff0000" />);
    const svg = container.querySelector("svg")!;
    expect(svg.style.color).toBe("rgb(255, 0, 0)");
  });

  it("renders nothing for an unknown icon name", () => {
    const { container } = render(<Icon name={"does-not-exist" as never} />);
    expect(container.querySelector("svg")).toBeNull();
  });
});
