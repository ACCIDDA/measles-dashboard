import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { csvFormat } from "d3-dsv";
import { columnNames } from "../../data/schema.js";
import DownloadButton from "./DownloadButton.jsx";

const SCHOOL_COLUMNS = columnNames("data/states/{state}/schools.csv");
const schoolsCsv = (rows) => csvFormat(rows, SCHOOL_COLUMNS);

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("DownloadButton", () => {
  it("fetches every registered API for a national download", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            nc: { base_url: "https://example.test/nc/" },
            ca: { base_url: "https://example.test/ca/" },
          }),
        })
        .mockResolvedValue({
          ok: true,
          text: async () => schoolsCsv([{ school_id: "1", school_name: "School", county: "Wake County" }]),
        }),
    );
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<DownloadButton zoomLevel="national" />);
    await user.click(
      screen.getByRole("button", { name: "Download all schools (CSV)" }),
    );
    expect(fetch).toHaveBeenCalledWith("/data/stateRegistry.json");
    expect(fetch).toHaveBeenCalledWith(
      new URL("data/schools.csv", "https://example.test/ca/"),
    );
    expect(fetch).toHaveBeenCalledWith(
      new URL("data/schools.csv", "https://example.test/nc/"),
    );
  });

  it("fetches the selected state API for a state download", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ca: { base_url: "https://example.test/ca/" },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => schoolsCsv([{
            school_id: "1",
            school_name: "=1+1",
            county: "Los Angeles County",
            enrollment: "-3",
          }]),
        }),
    );
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:test");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<DownloadButton zoomLevel="state" stateCode="ca" />);
    await user.click(
      screen.getByRole("button", { name: "Download CA schools (CSV)" }),
    );
    expect(fetch).toHaveBeenCalledWith(
      new URL("data/schools.csv", "https://example.test/ca/"),
    );
    const exportedCsv = await createObjectURL.mock.calls[0][0].text();
    expect(exportedCsv).toContain("'=1+1");
    expect(exportedCsv).toContain(",-3");
  });

  it("accepts CSV without a text MIME type when its schema is valid", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ca: { base_url: "https://example.test/ca/" } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          headers: { get: () => "application/octet-stream" },
          text: async () => schoolsCsv([{ school_id: "1", school_name: "School", county: "County" }]),
        }),
    );
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<DownloadButton zoomLevel="state" stateCode="ca" />);
    await user.click(screen.getByRole("button", { name: "Download CA schools (CSV)" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows and announces an error when the response is not a schools CSV", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ca: { base_url: "https://example.test/ca/" } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          headers: { get: () => "text/html" },
          text: async () => "<html><body>Unavailable</body></html>",
        }),
    );

    render(<DownloadButton zoomLevel="state" stateCode="ca" />);
    await user.click(screen.getByRole("button", { name: "Download CA schools (CSV)" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The state API did not return a schools CSV.",
    );
  });

  it.each([
    ["an extra formula-like header", `${SCHOOL_COLUMNS.join(",")},=1+1\n`],
    ["a missing coverage column", `${SCHOOL_COLUMNS.slice(0, -1).join(",")}\n`],
  ])("rejects a schools CSV with %s", async (_reason, csv) => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ca: { base_url: "https://example.test/ca/" } }),
        })
        .mockResolvedValueOnce({ ok: true, text: async () => csv }),
    );
    const createObjectURL = vi.spyOn(URL, "createObjectURL");

    render(<DownloadButton zoomLevel="state" stateCode="ca" />);
    await user.click(screen.getByRole("button", { name: "Download CA schools (CSV)" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The state API did not return a schools CSV.",
    );
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("exports only the selected county's schools without the county column", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ca: { base_url: "https://example.test/ca/" } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () =>
            schoolsCsv([
              { school_id: "1", school_name: "LA School", county: "Los Angeles County", enrollment: "100" },
              { school_id: "2", school_name: "Other School", county: "Orange County", enrollment: "200" },
            ]),
        }),
    );
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:test");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(
      <DownloadButton
        zoomLevel="county"
        stateCode="ca"
        countySlug="los-angeles"
        countyName="Los Angeles County"
      />,
    );
    expect(
      screen.getByRole("button", {
        name: "Download Los Angeles County schools (CSV)",
      }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", {
        name: "Download Los Angeles County schools (CSV)",
      }),
    );
    const exportedCsv = await createObjectURL.mock.calls[0][0].text();
    const countyColumns = SCHOOL_COLUMNS.filter((column) => column !== "county");
    expect(exportedCsv).toBe(
      `${csvFormat(
        [{ school_id: "1", school_name: "LA School", enrollment: "100" }],
        countyColumns,
      )}\n`,
    );
  });

  it("renders nothing when the resolution lacks the data it needs", () => {
    const { container: stateContainer } = render(
      <DownloadButton zoomLevel="state" />,
    );
    expect(stateContainer.firstChild).toBeNull();

    const { container: countyContainer } = render(
      <DownloadButton zoomLevel="county" stateCode="ca" />,
    );
    expect(countyContainer.firstChild).toBeNull();
  });
});
