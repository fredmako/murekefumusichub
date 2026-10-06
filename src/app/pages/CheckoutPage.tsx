import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Loader2,
  Smartphone,
  XCircle,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { payheroService } from "@/services/api";
import { Button } from "@/app/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Separator } from "@/app/components/ui/separator";
import { CartItem } from "../types";
import { buildLoginPath, persistPostLoginRedirect } from "@/lib/authRedirect";
import { formatKesAmount } from "@/lib/currency";

interface CheckoutPageProps {
  cart: CartItem[];
  onClearCart: () => void;
  onRemoveFromCart: (compositionId: string) => void;
}

type PaymentPhase =
  | "idle"
  | "initiating"
  | "waiting"
  | "checking"
  | "success"
  | "failed";

export function CheckoutPage({
  cart,
  onClearCart,
  onRemoveFromCart,
}: CheckoutPageProps) {
  const navigate = useNavigate();
  const { appUser, isLoading } = useAuth();
  const [phone, setPhone] = useState("");
  const [phase, setPhase] = useState<PaymentPhase>("idle");
  const [payheroReference, setPayheroReference] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [pollInterval, setPollInterval] = useState<ReturnType<typeof setInterval> | null>(null);

  const totalAmount = useMemo(
    () =>
      cart.reduce(
        (sum, item) => sum + Number(item.composition.price || 0) * item.quantity,
        0,
      ),
    [cart],
  );

  useEffect(() => {
    if (isLoading || appUser) return;
    persistPostLoginRedirect("/checkout");
    navigate(buildLoginPath({ nextPath: "/checkout", intent: "purchase" }), {
      replace: true,
    });
  }, [appUser, isLoading, navigate]);

  // Cleanup poll on unmount
  useEffect(() => {
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [pollInterval]);

  const stopPolling = () => {
    if (pollInterval) {
      clearInterval(pollInterval);
      setPollInterval(null);
    }
  };

  const startPolling = useCallback((reference: string) => {
    stopPolling();
    const interval = setInterval(async () => {
      try {
        const status = await payheroService.checkStatus(reference);
        const state = String(status?.status || status?.Status || "").toLowerCase();

        if (state === "success" || state === "completed" || state === "paid") {
          stopPolling();
          setPhase("success");
          setStatusMessage("Payment successful! Your arrangements are now available.");
          onClearCart();
        } else if (state === "failed" || state === "cancelled" || state === "declined") {
          stopPolling();
          setPhase("failed");
          setStatusMessage("Payment failed or was cancelled. Please try again.");
        }
        // else still waiting — keep polling
      } catch {
        // Network error — keep polling, don't break the flow
      }
    }, 5000);
    setPollInterval(interval);
  }, [onClearCart]);

  const handlePay = async () => {
    if (!appUser) {
      toast.error("Please sign in to continue");
      persistPostLoginRedirect("/checkout");
      navigate(buildLoginPath({ nextPath: "/checkout", intent: "purchase" }));
      return;
    }

    const normalizedPhone = phone.replace(/[\s-]/g, "");
    if (!/^0[17]\d{8}$/.test(normalizedPhone)) {
      toast.error("Enter a valid Kenyan phone number (07XX XXX XXX or 01XX XXX XXX)");
      return;
    }

    if (cart.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    setPhase("initiating");
    setStatusMessage("Initiating payment...");

    try {
      const result = await payheroService.initiatePayment({
        phone: normalizedPhone,
        items: cart.map((item) => ({
          composition_id: item.composition.id,
        })),
      });

      if (!result.success) {
        setPhase("failed");
        setStatusMessage(result?.error || "Payment initiation failed.");
        return;
      }

      const ref = result.payheroReference || result.checkoutBatchId;
      if (ref) {
        setPayheroReference(ref);
      }

      const submittedCount = result.submitted?.length || 0;
      if (submittedCount === 0) {
        setPhase("failed");
        setStatusMessage("No new items to purchase. They may already be owned or pending.");
        return;
      }

      setPhase("waiting");
      setStatusMessage(
        `Check your phone — a payment prompt has been sent to ${result.phone}. Enter your M-Pesa PIN to complete.`,
      );

      // Start polling for status
      if (ref) {
        startPolling(ref);
      }
    } catch (err: any) {
      console.error("[checkout] payhero error:", err);
      setPhase("failed");
      setStatusMessage(err?.message || "Payment failed. Please try again.");
    }
  };

  const handleRetry = () => {
    setPhase("idle");
    setStatusMessage("");
    setPayheroReference(null);
    stopPolling();
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <span>Preparing checkout...</span>
        </div>
      </div>
    );
  }

  const statusTone = (status: string) => {
    const normalized = String(status || "").toLowerCase();
    if (normalized === "approved" || normalized === "completed") {
      return {
        className:
          "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200",
        Icon: CheckCircle2,
      };
    }
    if (normalized === "rejected" || normalized === "failed") {
      return {
        className:
          "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200",
        Icon: XCircle,
      };
    }
    return {
      className:
        "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200",
      Icon: Clock3,
    };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f6fbff] via-white to-[#f5f1ff] p-4 dark:from-[#060f1f] dark:via-[#0a1830] dark:to-[#1b1232] sm:p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 size-4" />
          Back
        </Button>

        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Checkout</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pay securely with PayHero — M-Pesa STK push to your phone.
          </p>
        </div>

        {/* Payment Status Banner */}
        {phase !== "idle" && (
          <Card
            className={
              phase === "success"
                ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
                : phase === "failed"
                  ? "border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30"
                  : "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30"
            }
          >
            <CardContent className="flex items-start gap-3 p-4">
              {phase === "initiating" || phase === "checking" ? (
                <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-blue-600" />
              ) : phase === "waiting" ? (
                <Smartphone className="mt-0.5 size-5 shrink-0 text-blue-600" />
              ) : phase === "success" ? (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
              ) : (
                <XCircle className="mt-0.5 size-5 shrink-0 text-rose-600" />
              )}
              <div>
                <p className="font-medium">
                  {phase === "initiating" && "Initiating payment..."}
                  {phase === "waiting" && "Waiting for payment..."}
                  {phase === "checking" && "Checking payment status..."}
                  {phase === "success" && "Payment successful!"}
                  {phase === "failed" && "Payment failed"}
                </p>
                {statusMessage && (
                  <p className="mt-1 text-sm opacity-80">{statusMessage}</p>
                )}
                {phase === "waiting" && payheroReference && (
                  <p className="mt-1 text-xs opacity-60">
                    Reference: {payheroReference}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Phone Input + Pay Button */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="size-5 text-emerald-600" />
              Pay with PayHero
            </CardTitle>
            <CardDescription>
              Enter your M-Pesa phone number. You'll receive a payment prompt on your phone.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border/70 bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="size-4 text-emerald-600" />
                <span>Secure payment powered by PayHero</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">M-Pesa Phone Number</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07XX XXX XXX or 01XX XXX XXX"
                disabled={phase === "initiating" || phase === "waiting"}
                inputMode="tel"
                className="text-lg"
              />
              <p className="text-xs text-muted-foreground">
                You'll receive an STK push prompt on this number. Enter your M-Pesa PIN to authorize.
              </p>
            </div>

            {phase === "success" ? (
              <div className="space-y-3">
                <Button
                  className="w-full"
                  onClick={() => navigate("/buyer", { replace: true })}
                >
                  Go to My Library
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate("/marketplace")}
                >
                  Browse More
                </Button>
              </div>
            ) : phase === "failed" ? (
              <Button className="w-full" onClick={handleRetry}>
                Try Again
              </Button>
            ) : (
              <Button
                onClick={handlePay}
                disabled={
                  phase === "initiating" ||
                  phase === "waiting" ||
                  cart.length === 0
                }
                className="w-full"
                size="lg"
              >
                {phase === "initiating" ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Initiating...
                  </>
                ) : phase === "waiting" ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Waiting for payment...
                  </>
                ) : (
                  <>
                    <Smartphone className="mr-2 size-4" />
                    Pay {formatKesAmount(totalAmount)}
                  </>
                )}
              </Button>
            )}

            {phase === "waiting" && (
              <Button
                variant="ghost"
                className="w-full text-sm"
                onClick={() => {
                  stopPolling();
                  setPhase("idle");
                  setStatusMessage("");
                }}
              >
                Cancel Payment
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Order Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Order Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {cart.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Your cart is empty.</p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate("/marketplace")}
                >
                  Browse Music Hub
                </Button>
              </div>
            ) : (
              <>
                {cart.map((item) => (
                  <div
                    key={item.composition.id}
                    className="flex items-start justify-between gap-3 border-b pb-2"
                  >
                    <div>
                      <p className="font-medium text-sm">
                        {item.composition.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.composition.composerName}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {formatKesAmount(item.composition.price * item.quantity)}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1 text-xs text-destructive"
                        onClick={() => onRemoveFromCart(item.composition.id)}
                        disabled={phase === "initiating" || phase === "waiting"}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="text-lg font-bold">
                    {formatKesAmount(totalAmount)}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default CheckoutPage;
