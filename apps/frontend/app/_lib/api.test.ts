import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { apiFetch, listWorkoutSessions, submitWorkoutFeedback } from "./api";

describe("api helpers", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("parses successful JSON responses", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    await expect(apiFetch("/auth/me")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/auth/me", {
      cache: "no-store",
      credentials: "include",
      headers: expect.any(Headers),
    });
  });

  test("returns null for 204 responses", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(
      apiFetch("/auth/logout", { method: "POST" }),
    ).resolves.toBeNull();
  });

  test("maps error payloads into ApiError", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: "NOPE",
          error: "Request failed badly.",
        }),
        { status: 400 },
      ),
    );

    await expect(apiFetch("/broken")).rejects.toEqual(
      expect.objectContaining({
        code: "NOPE",
        message: "Request failed badly.",
        statusCode: 400,
      }),
    );
  });

  test("serializes JSON bodies and query strings", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [],
          limit: 5,
          offset: 10,
          total: 0,
        }),
        { status: 200 },
      ),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          difficultyRating: 7,
          energyRating: 4,
          freeText: "Steady",
          id: "feedback_1",
          mood: "good",
          painFlag: false,
          painNotes: null,
          submittedAt: "2026-04-20T09:45:00.000Z",
          workoutSessionId: "session_1",
        }),
        { status: 200 },
      ),
    );

    await listWorkoutSessions({
      limit: 5,
      offset: 10,
      status: "in_progress",
    });
    await submitWorkoutFeedback("session_1", {
      freeText: "Steady",
      painFlag: false,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/v1/me/workout-sessions?limit=5&offset=10&status=in_progress",
      {
        cache: "no-store",
        credentials: "include",
        headers: expect.any(Headers),
      },
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/v1/me/workout-sessions/session_1/feedback",
      expect.objectContaining({
        body: JSON.stringify({
          freeText: "Steady",
          painFlag: false,
        }),
        bodyJson: {
          freeText: "Steady",
          painFlag: false,
        },
        cache: "no-store",
        credentials: "include",
        method: "POST",
      }),
    );

    const headers = fetchMock.mock.calls[1]?.[1]?.headers as Headers;
    expect(headers.get("content-type")).toBe("application/json");
  });
});
