import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { checkoutService } from "@/services/api";
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

const MPESA_BUSINESS_NUMBER = "400200";
const MPESA_ACCOUNT_NUMBER = "11317282";
const MPESA_BUSINESS_NAME = "Murekefu Music Hub";
const MPESA_PAYMENT_URL = "https://paynecta.co.ke/pay/music-hub";

interface CheckoutPageProps {
  cart: CartItem[];
  onClearCart: () => void;
  onRemoveFromCart: (compositionId: string) => void;
}

export function CheckoutPage({
  cart,
  onClearCart,
  onRemoveFromCart,
}: CheckoutPageProps) {
  const navigate = useNavigate();
  const { appUser, isLoading } = useAuth();
  const [mpesaCode, setMpesaCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  const handleSubmit = async () => {
    if (!appUser) {
      toast.error("Please sign in to continue");
      persistPostLoginRedirect("/checkout");
      navigate(buildLoginPath({ nextPath: "/checkout", intent: "purchase" }));
      return;
    }

    const normalizedCode = mpesaCode.trim().toUpperCase().replace(/\s+/g, "");
    if (!normalizedCode) {
      toast.error("Enter your M-Pesa transaction code");
      return;
    }
    if (cart.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        mpesaCode: normalizedCode,
        items: cart.map((item) => ({
          composition_id: item.composition.id,
        })),
      };

      const result = await checkoutService.submitManualPayment(payload);
      const submittedCount = result?.submitted?.length || 0;

      if (submittedCount === 0) {
        toast.info(
          "No new checkout items were submitted. They may already be purchased or pending approval.",
        );
      } else {
        toast.success(
          `Payment code submitted for ${submittedCount} item(s). Waiting for admin approval.`,
        );
      }

      onClearCart();
      navigate("/buyer", { replace: true });
    } catch (err: any) {
      console.error("[checkout] submit error:", err);
      if (err?.status === 401) {
        // Global session-expired handler in App.tsx shows toast + redirects to login.
        return;
      }
      toast.error(err?.message || "Failed to submit payment code");
    } finally {
      setSubmitting(false);
    }
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f6fbff] via-white to-[#f5f1ff] p-6 dark:from-[#060f1f] dark:via-[#0a1830] dark:to-[#1b1232]">
      <div className="mx-auto max-w-5xl space-y-6">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 size-4" />
          Back
        </Button>

        <div>
          <h1 className="text-3xl font-bold">Manual M-Pesa Checkout</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete payment on M-Pesa, then submit the transaction code for
            admin approval.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="size-5 text-emerald-600" />
                Payment Instructions
              </CardTitle>
              <CardDescription>
                Use the details below in your M-Pesa app.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-lg border border-border/70 bg-emerald-50/80 p-4 dark:bg-[#12253f]/92">
                <p className="text-sm text-muted-foreground">Business Name</p>
                <p className="text-lg font-semibold">{MPESA_BUSINESS_NAME}</p>
                <p className="mt-3 text-sm text-muted-foreground">Business Number</p>
                <p className="text-2xl font-bold tracking-wide">
                  {MPESA_BUSINESS_NUMBER}
                </p>
                <p className="mt-3 text-sm text-muted-foreground">Account Number</p>
                <p className="text-xl font-bold tracking-wide">
                  {MPESA_ACCOUNT_NUMBER}
                </p>
                <p className="mt-3 text-sm text-muted-foreground">Paynecta Link</p>
                <a
                  href={MPESA_PAYMENT_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-primary underline break-all"
                >
                  {MPESA_PAYMENT_URL}
                </a>
              </div>

              <ol className="list-decimal pl-5 space-y-2 text-sm text-muted-foreground">
                <li>Open the Paynecta payment link shown above.</li>
                <li>
                  Complete the payment to business number {MPESA_BUSINESS_NUMBER} for
                  your cart total.
                </li>
                <li>Use account number {MPESA_ACCOUNT_NUMBER} when prompted.</li>
                <li>
                  Copy the transaction code from the M-Pesa confirmation SMS.
                </li>
                <li>Paste it below and submit for admin confirmation.</li>
              </ol>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="mpesa-code">M-Pesa Transaction Code</Label>
                <Input
                  id="mpesa-code"
                  value={mpesaCode}
                  onChange={(e) => setMpesaCode(e.target.value)}
                  placeholder="e.g. QGH7XK9P2L"
                  disabled={submitting}
                />
              </div>

              <Button
                onClick={handleSubmit}
                disabled={submitting || cart.length === 0}
                className="w-full"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit For Admin Approval"
                )}
              </Button>
            </CardContent>
          </Card>

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
                          ${(item.composition.price * item.quantity).toFixed(2)}
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1 text-xs text-destructive"
                          onClick={() => onRemoveFromCart(item.composition.id)}
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
                      ${totalAmount.toFixed(2)}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default CheckoutPage;
