import { useState } from "react";
import { LifeBuoy, Loader } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/app/components/ui/dialog";
import { toast } from "sonner";
import { supportService } from "@/services/supportService";

interface SupportIssueButtonProps {
  context: string;
  className?: string;
}

export function SupportIssueButton({ context, className }: SupportIssueButtonProps) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const normalizedSubject = subject.trim();
    const normalizedMessage = message.trim();

    if (!normalizedMessage) {
      toast.error("Please enter your issue details.");
      return;
    }

    setSubmitting(true);
    try {
      await supportService.submitIssue({
        subject: normalizedSubject || "Support Request",
        message: normalizedMessage,
        context,
      });

      toast.success("Support request sent. We will follow up shortly.");
      setOpen(false);
      setSubject("");
      setMessage("");
    } catch (error: any) {
      console.error("[support] submit issue failed:", error);
      toast.error(error?.message || "Failed to send support request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className={className}>
          <LifeBuoy className="size-4 mr-2" />
          Contact Support
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Contact Support</DialogTitle>
          <DialogDescription>
            Tell us what issue you are facing and we will assist.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="support-subject">Subject</Label>
            <Input
              id="support-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Short issue title"
              disabled={submitting}
              maxLength={160}
            />
          </div>
          <div>
            <Label htmlFor="support-message">Issue Details</Label>
            <Textarea
              id="support-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe the issue in detail..."
              rows={6}
              disabled={submitting}
              maxLength={4000}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting ? (
              <>
                <Loader className="size-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              "Send Issue"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SupportIssueButton;
