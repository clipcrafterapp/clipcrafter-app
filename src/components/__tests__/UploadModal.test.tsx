import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Feature, Scenario, Given, When, Then, And } from "@/test/bdd";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import UploadModal from "../UploadModal";

const onClose = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
});

Feature("UploadModal", () => {
  Scenario("modal renders with two tabs", () => {
    Given("the modal is open", () => {
      render(<UploadModal open onClose={onClose} />);
      Then("the Upload File tab is visible", () => {
        expect(screen.getByRole("tab", { name: /upload file/i })).toBeInTheDocument();
      });
      And("the YouTube URL tab is visible", () => {
        expect(screen.getByRole("tab", { name: /youtube url/i })).toBeInTheDocument();
      });
    });
  });

  Scenario("tab switching", () => {
    Given("the modal is open", () => {
      render(<UploadModal open onClose={onClose} />);
    });

    When("user clicks the YouTube URL tab", () => {
      fireEvent.click(screen.getByRole("tab", { name: /youtube url/i }));
    });

    Then("the YouTube URL input is shown", () => {
      expect(screen.getByPlaceholderText(/youtube\.com/i)).toBeInTheDocument();
    });

    When("user clicks the Upload File tab again", () => {
      fireEvent.click(screen.getByRole("tab", { name: /upload file/i }));
    });

    Then("the drag and drop zone is shown", () => {
      expect(screen.getByText(/drag.*drop|click to select/i)).toBeInTheDocument();
    });
  });

  Scenario("close button", () => {
    Given("the modal is open", () => {
      render(<UploadModal open onClose={onClose} />);
    });

    When("user clicks the close button", () => {
      fireEvent.click(screen.getByRole("button", { name: /close/i }));
    });

    Then("onClose is called", () => {
      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  Scenario("modal is hidden when open=false", () => {
    Then("the modal content is not visible", () => {
      render(<UploadModal open={false} onClose={onClose} />);
      expect(screen.queryByRole("tab", { name: /upload file/i })).not.toBeInTheDocument();
    });
  });

  Scenario("file selection shows filename and size", () => {
    Given("the modal is open on the Upload File tab", () => {
      render(<UploadModal open onClose={onClose} />);
    });

    When("user selects a video file", () => {
      const file = new File(["video"], "myvideo.mp4", { type: "video/mp4" });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [file] } });
    });

    Then("the filename is displayed", () => {
      expect(screen.getByText("myvideo.mp4")).toBeInTheDocument();
    });
  });

  Scenario("YouTube URL validation", () => {
    Given("the modal is open on the YouTube URL tab", () => {
      render(<UploadModal open onClose={onClose} />);
      fireEvent.click(screen.getByRole("tab", { name: /youtube url/i }));
    });

    When("user enters a non-YouTube URL", () => {
      const input = screen.getByPlaceholderText(/youtube\.com/i);
      fireEvent.change(input, { target: { value: "https://example.com/video" } });
      fireEvent.click(screen.getByRole("button", { name: /process video/i }));
    });

    Then("a validation error is shown", () => {
      expect(screen.getByText(/valid youtube url/i)).toBeInTheDocument();
    });
  });

  Scenario("YouTube flow: valid URL triggers API calls", () => {
    Given("the modal is open on the YouTube URL tab", () => {
      render(<UploadModal open onClose={onClose} />);
      fireEvent.click(screen.getByRole("tab", { name: /youtube url/i }));
    });

    When("user enters a valid YouTube URL and submits", async () => {
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: "proj-abc", title: "Test", status: "pending" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        });

      const input = screen.getByPlaceholderText(/youtube\.com/i);
      fireEvent.change(input, {
        target: { value: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
      });
      fireEvent.click(screen.getByRole("button", { name: /process video/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/projects/create",
          expect.objectContaining({ method: "POST" })
        );
      });
    });

    Then("the process endpoint is called", async () => {
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/projects/proj-abc/process",
          expect.objectContaining({ method: "POST" })
        );
      });
    });
  });

  Scenario("Upload file flow shows progress messages", () => {
    Given("the modal is open on the Upload File tab", () => {
      render(<UploadModal open onClose={onClose} />);
    });

    When("user selects a file and clicks Upload & Process", async () => {
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: "proj-xyz", title: "myvideo.mp4", status: "pending" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ uploadUrl: "https://r2.example.com/upload", key: "some-key" }),
        })
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      const file = new File(["video"], "myvideo.mp4", { type: "video/mp4" });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [file] } });

      fireEvent.click(screen.getByRole("button", { name: /upload.*process/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/projects/create",
          expect.objectContaining({ method: "POST" })
        );
      });
    });

    Then("the upload endpoint is called with the filename", async () => {
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/projects/proj-xyz/upload",
          expect.objectContaining({ method: "POST" })
        );
      });
    });
  });
});
