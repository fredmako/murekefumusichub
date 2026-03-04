import { useNavigate } from "react-router-dom";
import { ShieldCheck, ShieldX } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";

export function PrivacyPolicy() {
  const navigate = useNavigate();
  const effectiveDate = "March 4, 2026";

  const handleAccept = () => {
    localStorage.setItem("privacyAccepted", "true");
    navigate("/", { replace: true });
  };

  const handleReject = () => {
    localStorage.setItem("privacyAccepted", "false");
    navigate("/", { replace: true });
  };

  return (
    <main className="texture-linen min-h-screen overflow-hidden pb-20">
      <section className="section-shell">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="texture-fabric texture-speckle motion-reveal overflow-hidden rounded-3xl border border-border/70 bg-card/80 shadow-[0_24px_44px_-30px_rgba(15,23,42,0.85)]">
            <div className="p-6 sm:p-8">
              <span className="soft-kicker">Privacy & Data Use</span>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                Privacy Policy
              </h1>
              <p className="mt-3 max-w-3xl text-sm text-muted-foreground sm:text-base">
                This policy explains what we collect, why we collect it, and
                how your information is protected while using Murekefu Music Hub.
              </p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Effective Date: {effectiveDate}
              </p>
            </div>
          </div>

          <Card className="lift-card texture-speckle border-border/70 bg-card/95">
            <CardHeader>
              <CardTitle>1. Information We Collect</CardTitle>
              <CardDescription>
                We collect only the information needed to provide the platform.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm leading-6 text-muted-foreground">
              <p>- Account details such as name, email, and role.</p>
              <p>- Authentication metadata from Supabase sign-in sessions.</p>
              <p>- Marketplace activity including purchases and downloads.</p>
              <p>- Uploaded media and profile images you choose to submit.</p>
              <p>- Support messages and issue reports you send to us.</p>
            </CardContent>
          </Card>

          <Card className="lift-card texture-speckle border-border/70 bg-card/95">
            <CardHeader>
              <CardTitle>2. How We Use Your Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm leading-6 text-muted-foreground">
              <p>- To create and secure your account.</p>
              <p>- To process transactions and deliver purchased content.</p>
              <p>- To operate admin, composer, and buyer workflows.</p>
              <p>- To resolve support requests and monitor platform abuse.</p>
              <p>- To improve reliability, user experience, and platform safety.</p>
            </CardContent>
          </Card>

          <Card className="lift-card texture-speckle border-border/70 bg-card/95">
            <CardHeader>
              <CardTitle>3. Data Sharing and Storage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm leading-6 text-muted-foreground">
              <p>
                We do not sell your personal data. We use trusted providers
                (for example Supabase and hosting infrastructure) to operate
                the service.
              </p>
              <p>
                Access to data is limited to authorized workflows and role-based
                platform controls.
              </p>
              <p>
                Data may be disclosed only when required by law or to protect
                the platform and its users.
              </p>
            </CardContent>
          </Card>

          <Card className="lift-card texture-speckle border-border/70 bg-card/95">
            <CardHeader>
              <CardTitle>4. Your Choices and Rights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm leading-6 text-muted-foreground">
              <p>
                You may request updates or deletion of account information by
                contacting support.
              </p>
              <p>
                You can choose whether to accept this privacy policy for normal
                site usage.
              </p>
              <p>
                If this policy is updated, the effective date will be changed
                and the latest version will remain available on this page.
              </p>
            </CardContent>
          </Card>

          <Card className="lift-card texture-speckle border-border/70 bg-card/95">
            <CardHeader>
              <CardTitle>5. Contact</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-6 text-muted-foreground">
              For privacy questions, contact: support@murekefumusic.com
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-border/70 bg-card/95">
            <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Choose one option to continue.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" onClick={handleReject}>
                  <ShieldX className="mr-2 size-4" />
                  Reject
                </Button>
                <Button onClick={handleAccept}>
                  <ShieldCheck className="mr-2 size-4" />
                  Accept
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}

