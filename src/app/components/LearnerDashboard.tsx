import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock3,
  MessageSquare,
  Music,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { DashboardShell } from "@/app/components/DashboardShell";
import { useAuth } from "@/context/AuthContext";
import { useLearnerStatus } from "@/hooks/useLearnerStatus";
import { buildLoginPath, persistPostLoginRedirect } from "@/lib/authRedirect";

function formatStatus(status?: string | null) {
  const normalized = String(status || "").trim().toLowerCase();
  if (!normalized) return "Pending";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function statusClassName(status?: string | null) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "admitted") {
    return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  }
  return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
}

export function LearnerDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { appUser, isLoading: authLoading } = useAuth();
  const {
    enrollments,
    pendingEnrollments,
    admittedEnrollments,
    latestEnrollment,
    hasLearnerAccess,
    isLoading,
    error,
  } = useLearnerStatus();

  useEffect(() => {
    if (!authLoading && !appUser) {
      const currentPath = `${location.pathname}${location.search}${location.hash}`;
      persistPostLoginRedirect(currentPath);
      navigate(buildLoginPath({ nextPath: currentPath }), { replace: true });
    }
  }, [
    appUser,
    authLoading,
    location.hash,
    location.pathname,
    location.search,
    navigate,
  ]);

  const nextStepLabel = admittedEnrollments.length
    ? "Stay connected with your class, chat in the community, and keep your practice momentum moving."
    : pendingEnrollments.length
      ? "Your enrollment is waiting for review. Keep an eye on updates and reach support if you need help."
      : "Start your learner journey by enrolling in a class, then use this dashboard to track every step.";

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-950/20 via-background to-background text-foreground">
      <DashboardShell
        title="Learner Dashboard"
        description="A focused space for enrolled students to track class status, practice flow, and stay connected with the Murekefu community."
        navItems={[
          { id: "overview", label: "Overview", path: "#learner-overview", icon: Sparkles },
          { id: "classes", label: "My Classes", path: "#learner-classes", icon: BookOpen },
          { id: "community", label: "Community", path: "#learner-community", icon: Users },
          { id: "toolbox", label: "Toolbox", path: "#learner-toolbox", icon: ShieldCheck },
        ]}
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/messenger?tab=community")}
            >
              <Users className="mr-2 size-4" />
              Community
            </Button>
            <Button type="button" onClick={() => navigate("/enroll")}>
              <BookOpen className="mr-2 size-4" />
              Enroll More
            </Button>
          </>
        }
      >
        <section
          id="learner-overview"
          className="grid gap-4 lg:grid-cols-[1.3fr_minmax(0,0.7fr)]"
        >
          <div className="rounded-[1.75rem] border border-border/70 bg-card/90 p-5 shadow-sm">
            <span className="soft-kicker">
              <Music className="size-4 text-primary" />
              Learner Flow
            </span>
            <h2 className="mt-3 text-xl font-semibold">Welcome to your study rhythm</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {nextStepLabel}
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Enrollments
                </p>
                <p className="mt-3 text-2xl font-semibold">{enrollments.length}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Class applications tracked in one place.
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Active
                </p>
                <p className="mt-3 text-2xl font-semibold">{admittedEnrollments.length}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Admitted classes ready for practice.
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Pending
                </p>
                <p className="mt-3 text-2xl font-semibold">{pendingEnrollments.length}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Requests still under review.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-border/70 bg-card/90 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Next Step
            </p>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <p className="text-sm font-semibold">
                  {latestEnrollment?.music_class || "Choose your next class"}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {latestEnrollment?.notes ||
                    "Use the learner dashboard to follow admissions, then move into community discussions and guided practice."}
                </p>
              </div>
              <Button
                type="button"
                className="w-full justify-between"
                onClick={() => navigate("/messenger?tab=support")}
              >
                Talk to support
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        </section>

        {error ? (
          <section className="rounded-[1.6rem] border border-destructive/30 bg-destructive/10 p-4 text-sm text-foreground">
            {error}
          </section>
        ) : null}

        <section id="learner-classes" className="rounded-[1.75rem] border border-border/70 bg-card/90 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                My Classes
              </p>
              <h2 className="mt-2 text-lg font-semibold">Enrollment timeline</h2>
            </div>
            <Button type="button" variant="outline" onClick={() => navigate("/enroll")}>
              <Calendar className="mr-2 size-4" />
              Add another class
            </Button>
          </div>

          <div className="mt-5 space-y-3">
            {isLoading ? (
              <div className="rounded-2xl border border-border/70 bg-background/70 p-4 text-sm text-muted-foreground">
                Loading your learner workspace...
              </div>
            ) : !hasLearnerAccess ? (
              <div className="rounded-2xl border border-border/70 bg-background/70 p-5">
                <p className="text-base font-semibold">No learner applications yet</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Once you enroll in a class, this dashboard will track your review status, admitted classes, and learner shortcuts.
                </p>
                <Button className="mt-4" onClick={() => navigate("/enroll")}>
                  Start enrollment
                </Button>
              </div>
            ) : (
              enrollments.map((enrollment) => (
                <div
                  key={enrollment.id}
                  className="grid gap-4 rounded-2xl border border-border/70 bg-background/70 p-4 lg:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">
                        {enrollment.music_class || "Music class"}
                      </p>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${statusClassName(enrollment.status)}`}
                      >
                        {formatStatus(enrollment.status)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Skill level: {enrollment.skill_level || "Not specified"}
                    </p>
                    {enrollment.notes ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {enrollment.notes}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex min-w-[180px] flex-col gap-2">
                    <div className="rounded-2xl border border-border/70 bg-card/90 px-3 py-2 text-xs text-muted-foreground">
                      {String(enrollment.status || "").toLowerCase() === "admitted" ? (
                        <span className="inline-flex items-center gap-2">
                          <CheckCircle2 className="size-4 text-emerald-500" />
                          Admission cleared
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          <Clock3 className="size-4 text-amber-500" />
                          Awaiting admin review
                        </span>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate("/messenger?tab=support")}
                    >
                      <MessageSquare className="mr-2 size-4" />
                      Ask support
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section
          id="learner-community"
          className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]"
        >
          <div className="rounded-[1.75rem] border border-border/70 bg-card/90 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Community
            </p>
            <h2 className="mt-2 text-lg font-semibold">Stay close to other learners</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Jump into the Murekefu community lounge to share progress, ask questions, celebrate wins, and keep the learning energy alive between lessons.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={() => navigate("/messenger?tab=community")}>
                <Users className="mr-2 size-4" />
                Open community
              </Button>
              <Button variant="outline" onClick={() => navigate("/marketplace")}>
                <Music className="mr-2 size-4" />
                Explore music hub
              </Button>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-border/70 bg-card/90 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Focus Tips
            </p>
            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                Use community to ask for help when a section feels difficult.
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                Save support chat for account, payment, or class approval issues.
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                Keep your profile updated so classmates and admins recognize you quickly.
              </div>
            </div>
          </div>
        </section>

        <section
          id="learner-toolbox"
          className="grid gap-4 md:grid-cols-3"
        >
          <div className="rounded-[1.5rem] border border-border/70 bg-card/90 p-4 shadow-sm">
            <BookOpen className="size-5 text-primary" />
            <h3 className="mt-3 text-base font-semibold">Practice Resources</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Browse the music hub, collect pieces into your library, and keep your practice material in one simple flow.
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-border/70 bg-card/90 p-4 shadow-sm">
            <ShieldCheck className="size-5 text-primary" />
            <h3 className="mt-3 text-base font-semibold">Account Control</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Update your identity, theme, and photo so your learner profile feels polished everywhere in the platform.
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-border/70 bg-card/90 p-4 shadow-sm">
            <Sparkles className="size-5 text-primary" />
            <h3 className="mt-3 text-base font-semibold">Momentum</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Keep the dashboard lean: only the next class actions, current learner state, and the best routes forward stay visible.
            </p>
          </div>
        </section>
      </DashboardShell>
    </main>
  );
}

export default LearnerDashboard;
