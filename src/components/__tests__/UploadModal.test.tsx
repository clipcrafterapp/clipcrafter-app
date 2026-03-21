import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import UploadModal from "../UploadModal";

const onClose = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
});

describe("UploadModal", () => {
  describe("renders with two tabs", () => {
    it("shows Upload File and YouTube URL tabs", () => {
      render(<UploadModal open onClose={onClose} />);
      expect(screen.getByRole("tab", { name: /upload file/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /youtube url/i })).toBeInTheDocument();
    });
  });

  describe("tab switching", () => {
    it("switches to YouTube tab and shows URL input", () => {
      render(<UploadModal open onClose={onClose} />);
      fireEvent.click(screen.getByRole("tab", { name: /youtube url/i }));
      expect(screen.getByPlaceholderText(/youtube\.com/i)).toBeInTheDocument();
    });

    it("switches back to upload tab and shows drop zone", () => {
      render(<UploadModal open onClose={onClose} />);
      fireEvent.click(screen.getByRole("tab", { name: /youtube url/i }));
      fireEvent.click(screen.getByRole("tab", { name: /upload file/i }));
      expect(screen.getByText(/drag.*drop|click to select/i)).toBeInTheDocument();
    });
  });

  describe("close button", () => {
    it("calls onClose when the close button is clicked", () => {
      render(<UploadModal open onClose={onClose} />);
      fireEvent.click(screen.getByRole("button", { name: /close/i }));
      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  describe("visibility", () => {
    it("does not render content when open=false", () => {
      render(<UploadModal open={false} onClose={onClose} />);
      expect(screen.queryByRole("tab", { name: /upload file/i })).not.toBeInTheDocument();
    });
  });

  describe("file selection", () => {
    it("shows the filename after a file is selected", () => {
      render(<UploadModal open onClose={onClose} />);
      const file = new File(["video"], "myvideo.mp4", { type: "video/mp4" });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [file] } });
      expect(screen.getByText("myvideo.mp4")).toBeInTheDocument();
    });
  });

  describe("YouTube URL validation", () => {
    it("shows an error when a non-YouTube URL is submitted", () => {
      render(<UploadModal open onClose={onClose} />);
      fireEvent.click(screen.getByRole("tab", { name: /youtube url/i }));
      const input = screen.getByPlaceholderText(/youtube\.com/i);
      fireEvent.change(input, { target: { value: "https://example.com/video" } });
      fireEvent.click(screen.getByRole("button", { name: /process video/i }));
      expect(screen.getByText(/valid youtube url/i)).toBeInTheDocument();
    });

    it("does not show error for a valid YouTube URL", () => {
      render(<UploadModal open onClose={onClose} />);
      fireEvent.click(screen.getByRole("tab", { name: /youtube url/i }));
      const input = screen.getByPlaceholderText(/youtube\.com/i);
      fireEvent.change(input, {
        target: { value: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
      });
      fireEvent.click(screen.getByRole("button", { name: /process video/i }));
      expect(screen.queryByText(/valid youtube url/i)).not.toBeInTheDocument();
    });
  });

  describe("YouTube flow", () => {
    it("calls create and process endpoints for a valid YouTube URL", async () => {
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: "proj-abc", title: "Test", status: "pending" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        });

      render(<UploadModal open onClose={onClose} />);
      fireEvent.click(screen.getByRole("tab", { name: /youtube url/i }));
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

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/projects/proj-abc/process",
          expect.objectContaining({ method: "POST" })
        );
      });
    });
  });

  describe("Upload file flow", () => {
    it("calls create, upload, R2 PUT, and process endpoints", async () => {
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

      render(<UploadModal open onClose={onClose} />);
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

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/projects/proj-xyz/upload",
          expect.objectContaining({ method: "POST" })
        );
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "https://r2.example.com/upload",
          expect.objectContaining({ method: "PUT" })
        );
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/projects/proj-xyz/process",
          expect.objectContaining({ method: "POST" })
        );
      });
    });
  });
});
