import React from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, Compass, Music2, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent } from "@/app/components/ui/card";

const pillars = [
  {
    title: "Access",
    description:
      "We remove barriers to quality choral and instrumental music resources for schools, churches, and community groups.",
    icon: <Compass className="size-5 text-primary" />,
  },
  {
    title: "Growth",
    description:
      "We equip singers, conductors, and composers with practical systems for measurable artistic progress.",
    icon: <BadgeCheck className="size-5 text-primary" />,
  },
  {
    title: "Trust",
    description:
      "We maintain clear licensing, transparent marketplace workflows, and protected collaboration between creators and buyers.",
    icon: <ShieldCheck className="size-5 text-primary" />,
  },
];

const team = [
  { name: "Samuel Murekefu", role: "CEO and Founder" },
  { name: "Eng. Alphonce O.", role: "Technical Lead" },
  { name: "John Thompson", role: "DJ Classes Teacher" },
];

export const AboutPage: React.FC = () => {
  return (
    <main className="texture-linen relative min-h-screen overflow-hidden pb-20">
      <section className="section-shell texture-fabric texture-speckle motion-reveal relative overflow-hidden rounded-3xl border border-border/60 bg-card/70">
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            background:
              "radial-gradient(circle at 18% 22%, rgba(15,118,110,0.18), transparent 42%), radial-gradient(circle at 84% 12%, rgba(249,115,22,0.16), transparent 48%)",
          }}
          aria-hidden="true"
        />
        <div className="relative z-10 grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <span className="soft-kicker">About Murekefu Music Hub</span>
            <h1 className="mt-5 text-5xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-6xl">
              Building East Africa's practical hub for choirs and composers
            </h1>
            <p className="mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
              Murekefu Music Hub began to solve a simple problem: serious choirs
              and trainers needed better access to quality music, coaching, and
              structured growth pathways.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/marketplace">
                <Button size="lg">Explore Marketplace</Button>
              </Link>
              <Link to="/contact">
                <Button size="lg" variant="outline">
                  Contact Team
                </Button>
              </Link>
            </div>
          </div>

          <Card className="lift-card motion-float border-0 bg-gradient-to-br from-[#0b3f45] to-primary text-white">
            <CardContent className="p-8 sm:p-10">
              <div className="inline-flex items-center rounded-full bg-white/20 px-3 py-1 text-xs font-semibold tracking-wide">
                Since 2018
              </div>
              <h2 className="mt-5 text-3xl font-semibold leading-tight">
                From festival insights to a full music ecosystem
              </h2>
              <p className="mt-4 text-sm text-white/90 sm:text-base">
                Founded during the Kenya Music Festival season finale in Nyeri,
                the hub was shaped by direct trainer feedback on score access,
                arrangement quality, and skills gaps.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-white/90">
                <li>Marketplace for licensed compositions</li>
                <li>Trainer-led classes and choir development</li>
                <li>Role-based workflows for composers and buyers</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="section-shell motion-reveal pt-10">
        <div className="mb-8">
          <span className="soft-kicker">Our Story</span>
          <h2 className="section-title">Why Murekefu Music Hub exists</h2>
        </div>
        <Card className="texture-speckle border-border/70 bg-card/90">
          <CardContent className="space-y-4 p-6 text-sm leading-7 text-muted-foreground sm:text-base">
            <p>
              During research with choir trainers from across Kenya, we found a
              recurring challenge: many teams struggled to access high-quality
              scores for the exact repertoire they wanted to perform.
            </p>
            <p>
              The result was avoidable compromise. Choirs often settled for
              whatever was easy to find, instead of performing pieces aligned to
              their real artistic goals.
            </p>
            <p>
              Murekefu Music Hub was formed to close that gap by improving access
              to compositions, expanding trainer support, and building a reliable
              digital platform where creators and performers can thrive together.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="section-shell">
        <div className="mb-10">
          <span className="soft-kicker">Core Pillars</span>
          <h2 className="section-title">What guides every feature we build</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {pillars.map((pillar, index) => (
            <Card
              key={pillar.title}
              className="lift-card motion-reveal texture-speckle border-border/70"
              style={{ animationDelay: `${index * 110}ms` }}
            >
              <CardContent className="p-6">
                <div className="mb-4 inline-flex rounded-full bg-primary/10 p-2">
                  {pillar.icon}
                </div>
                <h3 className="text-xl font-semibold">{pillar.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {pillar.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="section-shell">
        <div className="mb-10">
          <span className="soft-kicker">Leadership</span>
          <h2 className="section-title">Team behind the platform</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {team.map((member, index) => (
            <Card
              key={member.name}
              className="lift-card motion-reveal texture-speckle border-border/70 bg-card/95"
              style={{ animationDelay: `${index * 120}ms` }}
            >
              <CardContent className="p-6 text-center">
                <div className="mx-auto mb-4 inline-flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
                  <Users className="size-5" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">
                  {member.name}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {member.role}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="section-shell">
        <Card className="motion-float-delayed texture-speckle overflow-hidden border-0 bg-gradient-to-r from-[#0b3f45] to-primary text-white">
          <CardContent className="p-8 text-center sm:p-12">
            <div className="mx-auto mb-4 inline-flex rounded-full bg-white/20 p-3">
              <Music2 className="size-6" />
            </div>
            <h2 className="text-4xl font-semibold tracking-tight">
              Ready to grow with Murekefu?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm text-white/85 sm:text-base">
              Join learners, choirs, and composers building strong musical
              outcomes through focused training and better composition access.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/enroll">
                <Button size="lg" variant="secondary">
                  Start Learning
                </Button>
              </Link>
              <Link to="/marketplace">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/35 bg-transparent text-white hover:bg-white/10 hover:text-white"
                >
                  Open Music Hub
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
};

export default AboutPage;
