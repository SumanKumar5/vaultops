import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SecretsList } from "../components/SecretsList";
import { secretsApi } from "../api/secrets";

vi.mock("../api/secrets", () => ({
  secretsApi: {
    list: vi.fn(),
  },
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const mockSecrets = [
  {
    id: "1",
    project_id: "proj-1",
    environment: "production",
    key_name: "DB_PASSWORD",
    version: 1,
    is_current: true,
    created_by: "user-1",
    created_at: new Date().toISOString(),
    rotated_at: null,
    expires_at: null,
    tags: ["database"],
  },
  {
    id: "2",
    project_id: "proj-1",
    environment: "production",
    key_name: "API_KEY",
    version: 2,
    is_current: true,
    created_by: "user-1",
    created_at: new Date().toISOString(),
    rotated_at: null,
    expires_at: null,
    tags: [],
  },
];

describe("SecretsList", () => {
  beforeEach(() => {
    vi.mocked(secretsApi.list).mockResolvedValue(mockSecrets);
  });

  it("renders secrets after loading", async () => {
    render(
      <SecretsList
        projectId="proj-1"
        environment="production"
        onSelect={vi.fn()}
        onNew={vi.fn()}
        onExport={vi.fn()}
      />,
      { wrapper },
    );

    await waitFor(() => {
      expect(screen.getByText("DB_PASSWORD")).toBeInTheDocument();
      expect(screen.getByText("API_KEY")).toBeInTheDocument();
    });
  });

  it("shows secret count", async () => {
    render(
      <SecretsList
        projectId="proj-1"
        environment="production"
        onSelect={vi.fn()}
        onNew={vi.fn()}
        onExport={vi.fn()}
      />,
      { wrapper },
    );

    await waitFor(() => {
      expect(screen.getByText("2 keys in production")).toBeInTheDocument();
    });
  });

  it("shows empty state when no secrets", async () => {
    vi.mocked(secretsApi.list).mockResolvedValue([]);

    render(
      <SecretsList
        projectId="proj-1"
        environment="production"
        onSelect={vi.fn()}
        onNew={vi.fn()}
        onExport={vi.fn()}
      />,
      { wrapper },
    );

    await waitFor(() => {
      expect(screen.getByText("No secrets found")).toBeInTheDocument();
    });
  });

  it("highlights selected secret", async () => {
    render(
      <SecretsList
        projectId="proj-1"
        environment="production"
        onSelect={vi.fn()}
        onNew={vi.fn()}
        onExport={vi.fn()}
        selectedKey="DB_PASSWORD"
      />,
      { wrapper },
    );

    await waitFor(() => {
      const el = screen.getByText("DB_PASSWORD");
      expect(el.className).toContain("text-accent");
    });
  });
});
