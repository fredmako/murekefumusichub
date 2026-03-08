import { useState } from "react";
import { Mail, MessageSquareText, Phone, Send } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Textarea } from "@/app/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";

const contactChannels = [
  {
    title: "General Inquiries",
    detail: "Ask about classes, choir support, or platform access.",
    icon: MessageSquareText,
  },
  {
    title: "Email Response",
    detail: "Replies are sent to the email address you provide.",
    icon: Mail,
  },
  {
    title: "Follow-up Support",
    detail: "Add a phone number in your account if you want direct follow-up.",
    icon: Phone,
  },
];

export function ContactUs() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);

    // TODO: connect this form to the live contact or support workflow.
    console.log("Contact form submitted:", formData);

    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
      setFormData({ name: "", email: "", message: "" });
    }, 1000);
  };

  return (
    <main className="texture-linen min-h-screen overflow-hidden py-12">
      <section className="section-shell py-0">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="route-backdrop-panel texture-speckle motion-reveal overflow-hidden rounded-3xl border border-white/45 bg-card/35 p-6 shadow-[0_28px_60px_-38px_rgba(15,23,42,0.75)] dark:border-white/10 dark:bg-card/30 sm:p-8">
            <span className="soft-kicker">Contact the Hub</span>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Reach the team behind Murekefu Music Hub
            </h1>
            <p className="mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
              Share a question, request support, or send feedback about training,
              publishing, or marketplace use.
            </p>

            <div className="mt-8 space-y-3">
              {contactChannels.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-white/40 bg-white/40 p-4 backdrop-blur-sm dark:border-white/10 dark:bg-white/5"
                  >
                    <div className="flex items-start gap-3">
                      <div className="inline-flex size-10 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                        <Icon className="size-5" />
                      </div>
                      <div>
                        <h2 className="text-base font-semibold text-foreground">
                          {item.title}
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {item.detail}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <Card className="route-backdrop-panel texture-speckle motion-reveal overflow-hidden rounded-3xl border border-white/45 bg-card/35 shadow-[0_28px_60px_-38px_rgba(15,23,42,0.75)] dark:border-white/10 dark:bg-card/30">
            <CardHeader className="border-b border-border/60 bg-white/20 backdrop-blur-sm dark:bg-white/5">
              <CardTitle className="text-2xl font-semibold text-foreground">
                Send a Message
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Tell us what you need and we will follow up through email.
              </p>
            </CardHeader>

            <CardContent className="p-6 sm:p-8">
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  name="name"
                  placeholder="Your name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />

                <Input
                  name="email"
                  type="email"
                  placeholder="Your email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />

                <Textarea
                  name="message"
                  placeholder="Write your message"
                  value={formData.message}
                  onChange={handleChange}
                  rows={6}
                  required
                />

                <Button type="submit" className="w-full gap-2" disabled={loading}>
                  <Send className="size-4" />
                  {loading ? "Sending..." : "Send Message"}
                </Button>

                {success ? (
                  <p className="text-sm text-emerald-600 dark:text-emerald-400">
                    Message sent successfully. We will get back to you shortly.
                  </p>
                ) : null}
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
