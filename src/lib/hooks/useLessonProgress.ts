/**
 * useLessonProgress — client hook for tracking lesson completion state.
 *
 * Authenticated users: reads from Supabase, writes via API route.
 * Guests: reads/writes from localStorage only.
 *
 * Namespaced localStorage keys: adroit-blog:lesson:<slug>
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { notifyProgressChanged } from "@/lib/progress";

const STORAGE_KEY_PREFIX = "adroit-blog:lesson:";

interface UseLessonProgressReturn {
  isCompleted: boolean;
  markComplete: () => void;
  isLoading: boolean;
}

function getCompletedFromStorage(slug: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(`${STORAGE_KEY_PREFIX}${slug}`) === "true";
  } catch {
    return false;
  }
}

function setCompletedInStorage(slug: string, completed: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${slug}`, String(completed));
  } catch {
    // silent fail
  }
}

async function fetchCompletionState(
  client: ReturnType<typeof getSupabaseClient>,
  lessonSlug: string,
): Promise<boolean> {
  try {
    const { data, error } = await client
      .from("lesson_completion")
      .select("completed_at")
      .eq("lesson_slug", lessonSlug)
      .maybeSingle();

    if (error) return false;
    return data !== null && "completed_at" in data;
  } catch {
    return false;
  }
}

async function markCompleteAPI(lessonSlug: string): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await fetch("/api/progress/lesson", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonSlug }),
    });
  } catch {
    // fire-and-forget
  }
}

export function useLessonProgress(lessonSlug: string): UseLessonProgressReturn {
  const [isCompleted, setIsCompleted] = useState(getCompletedFromStorage(lessonSlug));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkSupabase = async () => {
      try {
        const { data: { user } } = await getSupabaseClient().auth.getUser();
        if (user) {
          const completedState = await fetchCompletionState(getSupabaseClient(), lessonSlug);
          setIsCompleted(completedState);
          if (completedState) setCompletedInStorage(lessonSlug, true);
        }
      } catch {
        // no auth or error
      } finally {
        setIsLoading(false);
      }
    };

    checkSupabase();
  }, [lessonSlug]);

  const markComplete = useCallback(() => {
    const newState = !isCompleted;
    setIsCompleted(newState);
    setCompletedInStorage(lessonSlug, newState);
    notifyProgressChanged();

    if (newState) {
      markCompleteAPI(lessonSlug);
    }
  }, [isCompleted, lessonSlug]);

  return { isCompleted, markComplete, isLoading };
}
