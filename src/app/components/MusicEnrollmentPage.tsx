import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { enrollmentService, registrationService } from "@/services/api";
import { toast } from "sonner";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "./ui/select";
import {
  BookOpen,
  Building2,
  CheckCircle2,
  Clock3,
  CreditCard,
  Loader2,
  Mail,
  Music,
  ShieldAlert,
  User,
} from "lucide-react";
import { buildLoginPath, persistPostLoginRedirect } from "@/lib/authRedirect";

const musicClasses = [
  "Piano",
  "Guitar",
  "Vocal Training",
  "Music Theory",
  "Trumpet",
  "Ensemble Performance",
];

const skillLevels = ["beginner", "intermediate", "advanced"];

type RegistrationPaymentState = "none" | "pending" | "approved" | "rejected";

export const MusicEnrollmentPage: React.FC = () => {
  const navigate = useNavigate();
  const { appUser } = useAuth();

  const [loading, setLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentStateLoading, setPaymentStateLoading] = useState(false);
  const [paymentRef, setPaymentRef] = useState("");
  const [registrationRegulations, setRegistrationRegulations] = useState<{
    enrollmentFee: number;
    bankName: string;
    bankAccountNumber: string;
    accountName: string;
  } | null>(null);
  const [paymentStatus, setPaymentStatus] =
    useState<RegistrationPaymentState>("none");
  const [paymentRecord, setPaymentRecord] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    music_class: "",
    skill_level: "",
    notes: "",
  });

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      full_name: prev.full_name || appUser?.display_name || "",
      email: prev.email || appUser?.email || "",
    }));
  }, [appUser?.display_name, appUser?.email]);

  useEffect(() => {
    if (!appUser) {
      setRegistrationRegulations(null);
      setPaymentStatus("none");
      setPaymentRecord(null);
      return;
    }

    let mounted = true;

    const loadRegistrationState = async () => {
      setPaymentStateLoading(true);
      try {
        const [regulations, submissions] = await Promise.all([
          registrationService.getRegulations(),
          registrationService.getMyPayments("enrollment"),
        ]);

        if (!mounted) return;

        setRegistrationRegulations({
          enrollmentFee: Number(regulations?.enrollmentFee || 0),
          bankName: regulations?.bankName || "I&M Bank",
          bankAccountNumber:
            regulations?.bankAccountNumber || "0030 7335 5161 50",
          accountName: regulations?.accountName || "Murekefu Music Hub",
        });

        const latestSubmission = Array.isArray(submissions)
          ? submissions[0] || null
          : null;

        setPaymentRecord(latestSubmission);

        if (latestSubmission?.status === "pending") {
          setPaymentStatus("pending");
        } else if (
          latestSubmission?.status === "approved" &&
          !latestSubmission?.is_consumed
        ) {
          setPaymentStatus("approved");
        } else if (latestSubmission?.status === "rejected") {
          setPaymentStatus("rejected");
        } else {
          setPaymentStatus("none");
        }
      } catch (error) {
        console.warn("[enrollment-registration-state] error:", error);
        if (!mounted) return;
        setPaymentStatus("none");
      } finally {
        if (mounted) setPaymentStateLoading(false);
      }
    };

    void loadRegistrationState();
    const timer = setInterval(() => {
      void loadRegistrationState();
    }, 15000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [appUser]);

  const setField = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const enrollmentFee = Number(registrationRegulations?.enrollmentFee || 0);
  const enrollmentPaymentRequired = enrollmentFee > 0;
  const canSubmitEnrollment =
    !loading &&
    !!formData.full_name.trim() &&
    !!formData.email.trim() &&
    !!formData.music_class &&
    !!formData.skill_level &&
    (!enrollmentPaymentRequired || paymentStatus === "approved");

  const paymentStatusMeta = useMemo(() => {
    switch (paymentStatus) {
      case "approved":
        return {
          label: "Payment approved",
          tone:
            "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200",
          Icon: CheckCircle2,
        };
      case "pending":
        return {
          label: "Payment pending review",
          tone:
            "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200",
          Icon: Clock3,
        };
      case "rejected":
        return {
          label: "Payment needs resubmission",
          tone:
            "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200",
          Icon: ShieldAlert,
        };
      default:
        return {
          label: "Payment not submitted",
          tone:
            "border-border/70 bg-muted/40 text-muted-foreground",
          Icon: CreditCard,
        };
    }
  }, [paymentStatus]);

  const handleRegistrationPaymentSubmit = async () => {
    if (!appUser) {
      persistPostLoginRedirect("/enroll");
      toast.info("Sign in first to submit your enrollment payment.");
      navigate(buildLoginPath({ nextPath: "/enroll" }));
      return;
    }

    const normalizedRef = paymentRef.trim().toUpperCase().replace(/\s+/g, "");
    if (!normalizedRef) {
      toast.error("Enter the registration payment reference first.");
      return;
    }

    setPaymentLoading(true);
    try {
      await registrationService.submitPayment({
        registrationType: "enrollment",
        paymentRef: normalizedRef,
      });

      setPaymentRef("");
      toast.success(
        "Enrollment payment submitted. Wait for admin approval before enrolling.",
      );

      const submissions = await registrationService.getMyPayments("enrollment");
      const latestSubmission = Array.isArray(submissions)
        ? submissions[0] || null
        : null;
      setPaymentRecord(latestSubmission);
      setPaymentStatus(latestSubmission?.status === "pending" ? "pending" : "none");
    } catch (error: any) {
      console.error("[enrollment-payment-submit] error:", error);
      toast.error(
        error?.message || "Failed to submit enrollment payment reference.",
      );
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!appUser) {
      persistPostLoginRedirect("/enroll");
      toast.info("Please sign in before submitting an enrollment request.");
      navigate(buildLoginPath({ nextPath: "/enroll" }));
      return;
    }

    if (enrollmentPaymentRequired && paymentStatus !== "approved") {
      toast.error(
        "Complete and get approval for the enrollment registration payment first.",
      );
      return;
    }

    setLoading(true);

    try {
      await enrollmentService.submit({
        full_name: formData.full_name.trim(),
        email: formData.email.trim(),
        music_class: formData.music_class,
        skill_level: formData.skill_level,
        notes: formData.notes.trim(),
      });

      toast.success("Enrollment submitted successfully.");
      setFormData((prev) => ({
        ...prev,
        music_class: "",
        skill_level: "",
        notes: "",
      }));
      setPaymentStatus("none");
      setPaymentRecord(null);
      navigate("/manage-account", { replace: false });
    } catch (error: any) {
      console.error("[enrollment-submit] error:", error);
      if (Number(error?.status || 0) === 402) {
        toast.error(
          error?.message ||
            "Enrollment payment approval is required before submitting.",
        );
      } else {
        toast.error(error?.message || "Failed to submit enrollment");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 py-12 dark:from-[#071121] dark:to-[#0d1c31]">
      <div className="container mx-auto max-w-4xl space-y-6">
        <div className="text-center">
          <div className="mb-4 flex justify-center text-primary">
            <Music className="h-12 w-12" />
          </div>
          <h1 className="mb-2 text-4xl font-bold text-gray-900 dark:text-white">
            Music Class Enrollment
          </h1>
          <p className="text-gray-600 dark:text-slate-300">
            Enroll in professional music classes and complete any required
            registration payment from the same workflow.
          </p>
        </div>

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="size-5 text-primary" />
              Registration Payment
            </CardTitle>
            <CardDescription>
              The backend can require an approved registration payment before an
              enrollment is accepted.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {paymentStateLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading enrollment payment requirements...
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-xl border border-border/70 bg-card/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Required Fee
                    </p>
                    <p className="mt-2 text-2xl font-semibold">
                      {enrollmentPaymentRequired
                        ? `$${enrollmentFee.toFixed(2)}`
                        : "No fee"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-card/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Bank
                    </p>
                    <p className="mt-2 text-base font-semibold">
                      {registrationRegulations?.bankName || "I&M Bank"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {registrationRegulations?.accountName || "Murekefu Music Hub"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-card/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Account Number
                    </p>
                    <p className="mt-2 break-all text-base font-semibold">
                      {registrationRegulations?.bankAccountNumber ||
                        "0030 7335 5161 50"}
                    </p>
                  </div>
                </div>

                <div
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${paymentStatusMeta.tone}`}
                >
                  <paymentStatusMeta.Icon className="size-4 shrink-0" />
                  <div>
                    <p className="font-medium">{paymentStatusMeta.label}</p>
                    {paymentRecord?.payment_ref ? (
                      <p className="text-xs opacity-80">
                        Latest reference: {paymentRecord.payment_ref}
                      </p>
                    ) : null}
                    {paymentRecord?.admin_notes ? (
                      <p className="text-xs opacity-80">
                        Admin notes: {paymentRecord.admin_notes}
                      </p>
                    ) : null}
                  </div>
                </div>

                {enrollmentPaymentRequired ? (
                  <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Building2 className="size-4 text-primary" />
                      <p className="text-sm font-medium">
                        Submit the payment reference used for the enrollment fee
                      </p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                      <Input
                        value={paymentRef}
                        onChange={(e) => setPaymentRef(e.target.value)}
                        placeholder="Enter bank or M-Pesa transaction reference"
                        disabled={
                          paymentLoading ||
                          paymentStatus === "pending" ||
                          paymentStatus === "approved"
                        }
                      />
                      <Button
                        type="button"
                        onClick={handleRegistrationPaymentSubmit}
                        disabled={
                          paymentLoading ||
                          !paymentRef.trim() ||
                          paymentStatus === "pending" ||
                          paymentStatus === "approved"
                        }
                      >
                        {paymentLoading ? (
                          <>
                            <Loader2 className="mr-2 size-4 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          "Submit Payment Ref"
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Enrollment can be submitted immediately because no fee is
                    currently configured.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle>Student Information</CardTitle>
            <CardDescription>
              Complete the enrollment request after payment approval if a fee is
              required.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    required
                    placeholder="Your full name"
                    className="pl-9"
                    value={formData.full_name}
                    onChange={(e) => setField("full_name", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    type="email"
                    required
                    placeholder="you@example.com"
                    className="pl-9"
                    value={formData.email}
                    onChange={(e) => setField("email", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Select Music Class</Label>
                <Select
                  value={formData.music_class}
                  onValueChange={(value) => setField("music_class", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a class" />
                  </SelectTrigger>
                  <SelectContent>
                    {musicClasses.map((cls) => (
                      <SelectItem key={cls} value={cls}>
                        {cls}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Skill Level</Label>
                <Select
                  value={formData.skill_level}
                  onValueChange={(value) => setField("skill_level", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    {skillLevels.map((level) => (
                      <SelectItem key={level} value={level}>
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Additional Notes (Optional)</Label>
                <Textarea
                  rows={4}
                  placeholder="Any special requests or goals?"
                  value={formData.notes}
                  onChange={(e) => setField("notes", e.target.value)}
                />
              </div>

              {enrollmentPaymentRequired && paymentStatus !== "approved" ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200">
                  Approval of the enrollment registration payment is required
                  before this form can be submitted.
                </div>
              ) : null}

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={!canSubmitEnrollment}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <BookOpen className="mr-2 h-5 w-5" />
                    Enroll Now
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MusicEnrollmentPage;
