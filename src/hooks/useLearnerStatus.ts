import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { enrollmentService } from "@/services/api";

export interface LearnerEnrollment {
  id: string;
  full_name?: string | null;
  email?: string | null;
  music_class?: string | null;
  skill_level?: string | null;
  notes?: string | null;
  status?: string | null;
  admitted_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export function useLearnerStatus(limit: number = 24) {
  const { appUser } = useAuth();
  const [enrollments, setEnrollments] = useState<LearnerEnrollment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadEnrollments() {
      if (!appUser?.id) {
        if (!mounted) return;
        setEnrollments([]);
        setError(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const payload = await enrollmentService.getMine(limit);
        if (!mounted) return;
        setEnrollments(Array.isArray(payload) ? payload : []);
        setError(null);
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.message || "Failed to load learner enrollments.");
        setEnrollments([]);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    void loadEnrollments();

    return () => {
      mounted = false;
    };
  }, [appUser?.id, limit]);

  const pendingEnrollments = useMemo(
    () =>
      enrollments.filter(
        (item) => String(item?.status || "").toLowerCase() === "pending",
      ),
    [enrollments],
  );

  const admittedEnrollments = useMemo(
    () =>
      enrollments.filter(
        (item) => String(item?.status || "").toLowerCase() === "admitted",
      ),
    [enrollments],
  );

  const hasLearnerAccess = enrollments.some((item) => {
    const status = String(item?.status || "").toLowerCase();
    return status === "pending" || status === "admitted";
  });

  const latestEnrollment = enrollments[0] || null;

  return {
    enrollments,
    pendingEnrollments,
    admittedEnrollments,
    hasLearnerAccess,
    latestEnrollment,
    isLoading,
    error,
  };
}

export default useLearnerStatus;
