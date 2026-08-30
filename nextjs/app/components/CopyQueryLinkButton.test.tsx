import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FeatureCollection, LineString } from "geojson";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { QueryDefinitionV1 } from "@/app/lib/query-definition";

import CopyQueryLinkButton from "./CopyQueryLinkButton";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

const radiusQuery: QueryDefinitionV1 = {
  version: 1,
  tool: "radius",
  dateRange: { from: "2025-01-01", to: "2025-12-31" },
  center: { lat: 39.7392, lng: -104.9903 },
  radiusFeet: 500,
};

const renderButton = (query: QueryDefinitionV1 | null) =>
  render(
    <MantineProvider>
      <CopyQueryLinkButton query={query} />
    </MantineProvider>,
  );

describe("CopyQueryLinkButton", () => {
  const writeText = vi.fn();

  beforeEach(() => {
    writeText.mockReset().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
  });

  it("copies the canonical current URL after a successful query", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    renderButton(radiusQuery);

    await user.click(screen.getByRole("button", { name: "Copy query link" }));

    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(screen.getByRole("button", { name: "Link copied" })).toBeEnabled();
  });

  it("remains enabled for a successful query independent of result count", () => {
    renderButton(radiusQuery);
    expect(
      screen.getByRole("button", { name: "Copy query link" }),
    ).toBeEnabled();
  });

  it("is disabled before a supported query succeeds", () => {
    renderButton(null);
    expect(
      screen.getByRole("button", { name: "Copy query link" }),
    ).toBeDisabled();
  });

  it("explains why an oversized drawn route cannot be copied", () => {
    const route: FeatureCollection<LineString> = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: Array.from({ length: 1001 }, (_, index) => [
              -104.99 + index / 1_000_000,
              39.74,
            ]),
          },
        },
      ],
    };
    renderButton({
      version: 1,
      tool: "draw",
      dateRange: { from: "2025-01-01", to: "2025-12-31" },
      route,
      bufferFeet: 100,
    });

    expect(
      screen.getByRole("button", { name: "Copy query link" }),
    ).toBeDisabled();
    expect(
      screen.getByTitle(
        "This route has too many points to fit safely in a link.",
      ),
    ).toBeInTheDocument();
  });
});
