import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Award,
  CirclePlay,
  FileText,
  GraduationCap,
  Headphones,
  LayoutDashboard,
  MessageSquare,
  Music,
  Quote,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent } from "@/app/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import ShowBanner from "../utils/privacyBanner";
import { useTheme } from "@/context/ThemeContext";
import bg1 from "@/app/components/images/bg_1.jpg";
import bg2 from "@/app/components/images/bg_2.jpg";
import bg3 from "@/app/components/images/bg_3.jpg";
import bg4 from "@/app/components/images/bg_4.jpg";
import bg5 from "@/app/components/images/bg_5.jpg";
import bg6 from "@/app/components/images/bg_6.jpg";
import bg7 from "@/app/components/images/bg_7.jpg";
import bg9 from "@/app/components/images/bg_9.jpg";
import bg10 from "@/app/components/images/bg_10.jpg";
import bg11 from "@/app/components/images/bg_11.jpg";

interface LandingImage {
  id: string;
  url: string;
  alt: string;
}

const testimonials = [
  {
    id: "ann-kianda",
    message:
      "We came together as Parents in Kianda school to sing together in support of our daughters. Most of us were passionate about singing without experience or training!\n\nOn the first day, I could read Sam's mind wondering what he had gotten himself into! He started from identifying who fit into which voice group and patiently training us as individuals and groups. With his determination and great teaching/coaching skills, we were able to perform during Easter and Christmas cantatas.\n\nThe joy in our girls' faces said it all. They were really proud of our beautiful singing. Memories were created that will last a life time.\n\nThank Sam!",
    author: "Ann, Kianda Sch Parents Choir (2023 & 2024)",
  },
  {
    id: "oduor-nairobi",
    message:
      "My passion for choral music was ignited when I had the privilege of being trained by the incredible Murekefu Sam. It all began at The Nairobi School, where I discovered a singer within me I never knew existed. With him at the helm, participation at the national level wasn't just a possibility - it was a guarantee. Murekefu is someone I truly look up to in the world of music, crafting melodies that leave you wanting more. Five years under his tutelage was a transformative experience I'd highly recommend to any aspiring choral artist.",
    author: "Oduor Benedict, Nairobi School (2020 - 2023) & JKUAT Choir (2025)",
  },
  {
    id: "naserian-mku",
    message:
      "Working with Sam Murekefu has been one of the best pleasures I have enjoyed in my adult life. He has been such an amazing music trainer, director, composer and friend. Before I met Sam, I was the 'singing in the shower kinda girl' because I didn't know how to balance, warm, and sing from the stomach and he helped me with that.\n\nThe negative for me was that I never really got the chance to work with him longer but I get to call him a friend and that's good enough. Also, if you don't learn him well you might think he's always angry when he isn't, he's just concentrating on the music.",
    author: "Naserian, MKU Main Campus Choir (2022 & 2023)",
  },
  {
    id: "miriam-jkuat",
    message:
      "Mr. Sam Murekefu elevated our school choir to new heights with his expertise and passion for music. He demands excellence and pushes you to be your best - it's tough, but it works. It was his first time working with the JKUAT choir and his commitment to our growth and perfection pushed us to doing and being more. Literally took us out of our comfort zone. Though I didn't get to work with him one-on-one, I've seen how he brings out the best in our choir. He placed us on the map, musically speaking! Would love to learn from him more in the future.",
    author: "Miriam Seka, JKUAT Choir (2025)",
  },
  {
    id: "lilian-maziwa",
    message:
      "Murekefu Sam, thank you for your incredible dedication to Maziwa Methodist Choir in the year 2018 all through covid season. You took a group of passionate but untrained singers and, through individual voice coaching, discipline, and strict time keeping, turned us into a confident and effective choir.\n\nYou helped Maziwa Methodist Choir grow from raw passion into a structured and confident choir through individual coaching and strong emphasis on time keeping.\n\nAll the best!",
    author: "Lilian, Maziwa Methodist Church (2018 - 2019)",
  },
  {
    id: "carol-kengen",
    message:
      "Murekefu Sam served as a vital part of the KenGen musical program between 2018 and 2020. As our music director, he demonstrated a rare combination of artistic brilliance and disciplined leadership that significantly elevated our corporate identity.\n\nDuring his tenure, Sam's contributions were twofold:\nVocal Excellence & Instruction: As our Music Instructor and Voice Coach, Sam transformed the KenGen Choir. Through his technical guidance, he refined the choir's vocal range and performance quality, leading them to successful presentations at various high-profile corporate functions. His ability to inspire a group of employees to perform at a professional level was exceptional.\n\nThe KenGen Anthem: Sam was the lead composer for the proposed KenGen Company Anthem. He worked diligently on this project, crafting a musical identity that reflected our corporate values. While the anthem is currently under review for formal adoption following the interruption caused by the COVID-19 pandemic in 2020, the foundation he built remains a testament to his skill as a composer.\n\nSam is a dedicated professional who can bridge the gap between creative artistry and corporate requirements. He is a disciplined director and a gifted mentor who we highly recommend for any large-scale musical or branding project.",
    author: "Carol Sirali, KenGen Choir",
  },
];

const highlights = [
  {
    title: "Professional Mentorship",
    description:
      "Work with experienced trainers focused on measurable musical growth.",
    icon: <Award className="size-6 text-primary" />,
  },
  {
    title: "Structured Programs",
    description:
      "Clear progression paths from beginner foundations to stage-ready performance.",
    icon: <Music className="size-6 text-primary" />,
  },
  {
    title: "Digital + Live Delivery",
    description:
      "Learn through in-person rehearsals and digital resources you can revisit anytime.",
    icon: <Headphones className="size-6 text-primary" />,
  },
];

const platformRoles = [
  {
    title: "Learner Workspace",
    description:
      "Focused learning paths, enrollment progress, and a calmer dashboard for students.",
    icon: <GraduationCap className="size-5 text-primary" />,
  },
  {
    title: "Buyer Library",
    description:
      "Discover music, manage purchases, and keep approved downloads in one place.",
    icon: <Headphones className="size-5 text-primary" />,
  },
  {
    title: "Composer Studio",
    description:
      "Separate arrangements from compositions and manage uploads with cleaner workflows.",
    icon: <Music className="size-5 text-primary" />,
  },
  {
    title: "Admin Control Center",
    description:
      "Review users, enrollments, support, reports, and moderation from one operations hub.",
    icon: <LayoutDashboard className="size-5 text-primary" />,
  },
];

const platformFeatures = [
  {
    title: "MIDI Preview Marketplace",
    description:
      "Let buyers hear a short composition sample before moving into checkout and purchase.",
    icon: <CirclePlay className="size-5 text-primary" />,
    badge: "Preview-first",
  },
  {
    title: "Public Community Chat",
    description:
      "Give learners, buyers, composers, and admins a shared lounge alongside direct support chat.",
    icon: <MessageSquare className="size-5 text-primary" />,
    badge: "Community",
  },
  {
    title: "State-Aware Admin Actions",
    description:
      "Promote, demote, suspend, activate, verify, and moderate content with clearer system logic.",
    icon: <ShieldCheck className="size-5 text-primary" />,
    badge: "Operations",
  },
  {
    title: "Branded PDF Reports",
    description:
      "Export users, requests, transactions, compositions, and enrollments with selectable fields.",
    icon: <FileText className="size-5 text-primary" />,
    badge: "Reporting",
  },
  {
    title: "Adaptive Layout Controls",
    description:
      "Let every user personalize the whole system with theme, icon size, density, and surface styles.",
    icon: <SlidersHorizontal className="size-5 text-primary" />,
    badge: "Personalization",
  },
  {
    title: "Role-Based Experiences",
    description:
      "Support learners, buyers, composers, and admins through dedicated journeys instead of one generic dashboard.",
    icon: <Users className="size-5 text-primary" />,
    badge: "Multi-role",
  },
];

const LANDING_LIGHT_IMAGES: LandingImage[] = [
  { id: "light-hero", url: bg1, alt: "Grand piano keys and rehearsal lighting" },
  { id: "light-stage", url: bg3, alt: "Music studio instruments prepared for performance" },
  { id: "light-card", url: bg4, alt: "Sheet music and keyboard practice surface" },
  { id: "light-highlight-1", url: bg2, alt: "Conductor-led choir training session" },
  { id: "light-highlight-2", url: bg6, alt: "Strings and notation for ensemble practice" },
  { id: "light-highlight-3", url: bg7, alt: "Instrument detail for performance preparation" },
  { id: "light-program-1", url: bg11, alt: "Keyboard lesson background" },
  { id: "light-program-2", url: bg4, alt: "Guitar and rhythm practice background" },
  { id: "light-program-3", url: bg6, alt: "Vocal rehearsal score background" },
  { id: "light-program-4", url: bg3, alt: "Brass and ensemble coordination background" },
  { id: "light-program-5", url: bg1, alt: "Composition and notation study background" },
  { id: "light-program-6", url: bg2, alt: "Choir collaboration background" },
];

const LANDING_DARK_IMAGES: LandingImage[] = [
  { id: "dark-hero", url: bg9, alt: "Stage-lit piano keys in blue night tones" },
  { id: "dark-stage", url: bg10, alt: "Night rehearsal hall with instrument lighting" },
  { id: "dark-card", url: bg5, alt: "Dark studio score and instrument composition" },
  { id: "dark-highlight-1", url: bg9, alt: "Blue-hour choir direction scene" },
  { id: "dark-highlight-2", url: bg10, alt: "Moody strings and notation study" },
  { id: "dark-highlight-3", url: bg5, alt: "Performance stage instrument detail" },
  { id: "dark-program-1", url: bg10, alt: "Keyboard lesson at night" },
  { id: "dark-program-2", url: bg5, alt: "Guitar and rhythm studio lighting" },
  { id: "dark-program-3", url: bg9, alt: "Vocal rehearsal in low light" },
  { id: "dark-program-4", url: bg10, alt: "Brass rehearsal night session" },
  { id: "dark-program-5", url: bg5, alt: "Composition desk in dark theme" },
  { id: "dark-program-6", url: bg9, alt: "Choir collaboration in blue lighting" },
];

export const LandingPage = () => {
  const navigate = useNavigate();
  const { mode } = useTheme();
  const isDarkMode = mode === "dark";
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [expandedTestimonials, setExpandedTestimonials] = useState<
    Record<string, boolean>
  >({});
  const landingImages = isDarkMode ? LANDING_DARK_IMAGES : LANDING_LIGHT_IMAGES;

  useEffect(() => {
    const accepted = localStorage.getItem("privacyAccepted");
    setIsPrivacyOpen(accepted !== "true");
  }, []);

  const pickImage = (index: number): LandingImage | null =>
    landingImages.length > 0
      ? landingImages[index % landingImages.length]
      : null;
  const pickImageUrl = (index: number) => pickImage(index)?.url || null;

  const handleAcceptPrivacy = () => {
    localStorage.setItem("privacyAccepted", "true");
    setIsPrivacyOpen(false);
  };

  return (
    <main className="texture-linen relative flex min-h-screen flex-col overflow-hidden">
      {pickImageUrl(0) ? (
        <div
          className={`pointer-events-none fixed inset-0 -z-20 ${
            isDarkMode ? "opacity-[0.36]" : "opacity-[0.24]"
          }`}
          style={{
            backgroundImage: `url(${pickImageUrl(0)})`,
            backgroundRepeat: "repeat",
            backgroundSize: "620px auto",
            backgroundPosition: "center",
          }}
          aria-hidden="true"
        />
      ) : null}
      <Dialog open={isPrivacyOpen} onOpenChange={setIsPrivacyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Privacy Policy Notice</DialogTitle>
            <DialogDescription>
              We respect your privacy. By continuing to use this website, you
              agree to our privacy and data usage practices.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => navigate("/privacy-policy")}>
              View Privacy Policy
            </Button>
            <Button onClick={handleAcceptPrivacy}>Accept & Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <section className="section-shell route-backdrop-panel texture-speckle motion-reveal relative overflow-hidden rounded-3xl border border-white/45 bg-card/35 shadow-[0_28px_60px_-38px_rgba(15,23,42,0.72)] dark:border-white/10 dark:bg-card/30">
        {pickImageUrl(1) ? (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: `${
                isDarkMode
                  ? "linear-gradient(to right, rgba(6,18,34,0.66), rgba(10,31,54,0.34))"
                  : "linear-gradient(to right, rgba(255,255,255,0.62), rgba(255,255,255,0.18))"
              }, url(${pickImageUrl(1)})`,
              backgroundPosition: "center",
              backgroundSize: "cover",
            }}
            aria-hidden="true"
          />
        ) : null}
        <div className="relative z-10 grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <span className="soft-kicker">Choral Studio Platform</span>
            <h1 className="mt-5 text-5xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-6xl">
              Train Better. Perform Better. Publish Better.
            </h1>
            <p className="mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
              Murekefu Music Hub brings together composition publishing,
              arrangements, discovery, learner journeys, and admin operations
              in one connected music platform.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/marketplace">
                <Button size="lg">
                  Explore Music Hub
                </Button>
              </Link>
              <Link to="/enroll">
                <Button size="lg" variant="outline">
                  Learn Music
                </Button>
              </Link>
              <Link to="/help">
                <Button size="lg" variant="outline">
                  User Manuals
                </Button>
              </Link>
            </div>
            <div className="mt-8 grid max-w-md grid-cols-3 gap-3 text-sm">
              <div className="rounded-xl border border-border/70 bg-card p-3">
                <p className="text-2xl font-bold">4</p>
                <p className="text-muted-foreground">Role Journeys</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-card p-3">
                <p className="text-2xl font-bold">PDF + MIDI</p>
                <p className="text-muted-foreground">Publishing Flow</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-card p-3">
                <p className="text-2xl font-bold">24/7</p>
                <p className="text-muted-foreground">Access</p>
              </div>
            </div>
          </div>

          <Card
            className="lift-card motion-float texture-speckle overflow-hidden border-0 text-white"
            style={{
              backgroundImage: `${
                isDarkMode
                  ? "linear-gradient(to bottom right, rgba(6,23,43,0.84), rgba(13,45,78,0.7))"
                  : "linear-gradient(to bottom right, rgba(11,63,69,0.78), rgba(15,118,110,0.62))"
              }, ${pickImageUrl(2) ? `url(${pickImageUrl(2)})` : "none"}`,
              backgroundPosition: "center",
              backgroundSize: "cover",
            }}
          >
            <CardContent className="p-8 sm:p-10">
              <div className="inline-flex items-center rounded-full bg-white/20 px-3 py-1 text-xs font-semibold tracking-wide">
                Featured
              </div>
              <h2 className="mt-5 text-3xl font-semibold leading-tight">
                Built for compositions and arrangements by Murekefu Sam
              </h2>
              <p className="mt-4 text-sm text-white/85 sm:text-base">
                From first rehearsal to final upload, manage growth and
                distribution in one streamlined environment.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-white/90">
                <li>Performance-ready vocal training</li>
                <li>Composition publishing and monetization</li>
                <li>Role-based dashboards for team workflows</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <ShowBanner onAccept={handleAcceptPrivacy} />

      <section className="section-shell motion-reveal pt-10">
        <div className="mb-10">
          <span className="soft-kicker">Platform Updates</span>
          <h2 className="section-title">More than a landing page, this is a working music system</h2>
          <p className="section-copy">
            The platform now supports structured learning, music publishing,
            buyer workflows, community chat, admin control, reporting, and
            personalized layouts across devices.
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <Card
            className="lift-card motion-reveal texture-speckle overflow-hidden border-border/70"
            style={{
              backgroundImage: `${
                isDarkMode
                  ? "linear-gradient(145deg, rgba(7,23,44,0.86), rgba(15,45,79,0.72))"
                  : "linear-gradient(145deg, rgba(255,255,255,0.82), rgba(240,250,247,0.74))"
              }, ${pickImageUrl(4) ? `url(${pickImageUrl(4)})` : "none"}`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <CardContent className="p-6 sm:p-8">
              <span className="soft-kicker bg-card/70">Role-Based Product Design</span>
              <h3 className="mt-5 text-3xl font-semibold tracking-tight text-foreground">
                One connected platform for learning, creating, buying, and managing
              </h3>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                Murekefu Music Hub now goes beyond discovery. It supports learners
                who are enrolling and studying, composers publishing music,
                buyers previewing and purchasing, and admins keeping the whole
                system organized.
              </p>

              <div className="mt-6 flex flex-wrap gap-2 text-xs font-medium text-muted-foreground">
                <span className="rounded-full border border-border/70 bg-card/75 px-3 py-1">
                  Learner dashboard
                </span>
                <span className="rounded-full border border-border/70 bg-card/75 px-3 py-1">
                  Community messenger
                </span>
                <span className="rounded-full border border-border/70 bg-card/75 px-3 py-1">
                  MIDI preview
                </span>
                <span className="rounded-full border border-border/70 bg-card/75 px-3 py-1">
                  Admin reporting
                </span>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {platformRoles.map((role, index) => (
                  <div
                    key={role.title}
                    className="rounded-2xl border border-border/70 bg-card/70 p-4 backdrop-blur-sm"
                    style={{ animationDelay: `${index * 90}ms` }}
                  >
                    <div className="mb-3 inline-flex rounded-full bg-primary/10 p-2">
                      {role.icon}
                    </div>
                    <p className="text-sm font-semibold text-foreground">{role.title}</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {role.description}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            {platformFeatures.map((feature, index) => (
              <Card
                key={feature.title}
                className="lift-card motion-reveal texture-speckle overflow-hidden border-border/70"
                style={{
                  backgroundImage: `${
                    isDarkMode
                      ? "linear-gradient(150deg, rgba(9,23,40,0.9), rgba(13,34,58,0.74))"
                      : "linear-gradient(150deg, rgba(255,255,255,0.88), rgba(244,249,255,0.68))"
                  }, ${pickImageUrl(index + 8) ? `url(${pickImageUrl(index + 8)})` : "none"}`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  animationDelay: `${index * 80}ms`,
                }}
              >
                <CardContent className="p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="inline-flex rounded-full bg-primary/10 p-2">
                      {feature.icon}
                    </div>
                    <span className="rounded-full border border-border/70 bg-card/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {feature.badge}
                    </span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-foreground">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="section-shell motion-reveal pt-2">
        <div className="mb-8">
          <span className="soft-kicker">Instrument Focus</span>
          <h2 className="section-title">Visuals centered on instruments</h2>
          <p className="section-copy">
            We prioritize instrument-rich imagery so the page reflects practice,
            composition, and performance craft.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { title: "Keys & Harmony", idx: 9 },
            { title: "Strings & Texture", idx: 10 },
            { title: "Rhythm & Brass", idx: 11 },
          ].map((item, index) => {
            const image = pickImage(item.idx);
            return (
              <Card
                key={item.title}
                className="lift-card motion-reveal texture-speckle overflow-hidden border-border/70"
                style={{ animationDelay: `${index * 120}ms` }}
              >
                <div className="aspect-[4/3] w-full bg-muted">
                  {image ? (
                    <img
                      src={image.url}
                      alt={image.alt || "Musical instrument"}
                      className={`h-full w-full object-cover ${
                        isDarkMode
                          ? "brightness-[0.72] contrast-[1.08] saturate-90"
                          : ""
                      }`}
                      loading={index === 0 ? "eager" : "lazy"}
                      decoding="async"
                      sizes="(min-width: 768px) 33vw, 100vw"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      Curated music visual
                    </div>
                  )}
                </div>
                <CardContent className="p-4">
                  <p className="text-sm font-semibold">{item.title}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="section-shell texture-fabric motion-reveal relative">
        {pickImageUrl(5) ? (
          <div
            className={`pointer-events-none absolute right-8 top-10 hidden h-40 w-40 rounded-full bg-cover bg-center blur-[1px] md:block ${
              isDarkMode ? "opacity-45" : "opacity-35"
            }`}
            style={{ backgroundImage: `url(${pickImageUrl(5)})` }}
            aria-hidden="true"
          />
        ) : null}
        <div className="mb-10">
          <span className="soft-kicker">Why Us</span>
          <h2 className="section-title">A structured path to musical excellence</h2>
          <p className="section-copy">
            Clear curriculum, strong coaching, and practical outcomes for both
            individuals and ensembles.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {highlights.map((highlight, index) => (
            <Card
              key={highlight.title}
              className="lift-card motion-reveal texture-speckle"
              style={
                {
                  ...(pickImageUrl(index + 3)
                    ? {
                        backgroundImage: `${
                          isDarkMode
                            ? "linear-gradient(to bottom right, rgba(8,24,42,0.84), rgba(12,34,58,0.72))"
                            : "linear-gradient(to bottom right, rgba(255,255,255,0.78), rgba(255,255,255,0.58))"
                        }, url(${pickImageUrl(index + 3)})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }
                    : {}),
                  animationDelay: `${index * 100}ms`,
                }
              }
            >
              <CardContent className="p-6">
                <div className="mb-4 inline-flex rounded-full bg-primary/10 p-2">
                  {highlight.icon}
                </div>
                <h3 className="text-xl font-semibold">{highlight.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {highlight.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="section-shell">
        <div className="mb-10">
          <span className="soft-kicker">Success Stories</span>
          <h2 className="section-title">What choirs say</h2>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
                    {testimonials.map((testimonial, index) => {
            const isExpanded = Boolean(expandedTestimonials[testimonial.id]);
            const maxPreviewLength = 260;
            const canExpand = testimonial.message.length > maxPreviewLength;
            const messageToShow =
              canExpand && !isExpanded
                ? `${testimonial.message.slice(0, maxPreviewLength).trimEnd()}...`
                : testimonial.message;

            return (
              <Card
                key={testimonial.id}
                className="lift-card motion-reveal texture-speckle"
                style={{ animationDelay: `${index * 120}ms` }}
              >
                <CardContent className="p-6">
                  <Quote className="size-5 text-primary" />
                  <p className="mt-4 whitespace-pre-line text-sm leading-6 text-muted-foreground">
                    {messageToShow}
                  </p>
                  {canExpand ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-3 h-auto p-0 text-primary hover:bg-transparent hover:text-primary/80"
                      onClick={() =>
                        setExpandedTestimonials((prev) => ({
                          ...prev,
                          [testimonial.id]: !isExpanded,
                        }))
                      }
                    >
                      {isExpanded ? "Show less" : "Read more"}
                    </Button>
                  ) : null}
                  <p className="mt-5 text-sm font-semibold text-foreground">
                    {testimonial.author}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="section-shell">
        <Card className="motion-float-delayed texture-speckle overflow-hidden border-0 bg-gradient-to-r from-[#0b3f45] to-primary text-white">
          <CardContent className="p-8 text-center sm:p-12">
            <h2 className="text-4xl font-semibold tracking-tight">
              Join our growing music community
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm text-white/85 sm:text-base">
              Whether you are starting out, leading a choir, or publishing
              compositions, there is a place for you here.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/login">
                <Button size="lg" variant="secondary">
                  Join Us
                </Button>
              </Link>
              <Link to="/contact">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/35 bg-transparent text-white hover:bg-white/10 hover:text-white"
                >
                  Talk to Us
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>

      <footer className="relative mt-auto overflow-hidden border-t border-border/80 bg-gradient-to-br from-[#f5faf8] via-white to-[#edf6f2] dark:border-[#2b4a6b] dark:from-[#081d35]/98 dark:via-[#0a233f]/98 dark:to-[#0d2b4a]/98">
        <div
          className="pointer-events-none absolute -left-10 top-10 h-48 w-48 rounded-full bg-primary/10 blur-2xl dark:bg-[#60a5fa]/20"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-14 bottom-0 h-52 w-52 rounded-full bg-[#0f766e]/10 blur-2xl dark:bg-[#38bdf8]/18"
          aria-hidden="true"
        />

        <div className="app-shell py-14">
          <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.5fr_repeat(3,minmax(0,1fr))]">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-3 rounded-full border border-border/80 bg-white/85 px-4 py-2 shadow-sm dark:border-[#355784]/60 dark:bg-[#0a1f36]/95">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[#0b4a52] text-white">
                  <Music className="size-4" />
                </span>
                <span className="text-sm font-semibold tracking-tight text-foreground">
                  Murekefu Music Hub
                </span>
              </div>
              <p className="max-w-md text-sm leading-6 text-muted-foreground">
                A connected home for music discovery, learning, composition,
                arrangements, and community workflows.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link to="/enroll">
                  <Button size="sm">Start Learning</Button>
                </Link>
                <Link to="/marketplace">
                  <Button size="sm" variant="outline">
                    Browse Music Hub
                  </Button>
                </Link>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Explore
              </p>
              <div className="mt-4 space-y-2 text-sm">
                <Link to="/about" className="block text-muted-foreground hover:text-foreground">
                  About Us
                </Link>
                <Link to="/contact" className="block text-muted-foreground hover:text-foreground">
                  Contact
                </Link>
                <Link to="/help" className="block text-muted-foreground hover:text-foreground">
                  Help &amp; Manuals
                </Link>
                <Link to="/privacy-policy" className="block text-muted-foreground hover:text-foreground">
                  Privacy Policy
                </Link>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Services
              </p>
              <div className="mt-4 space-y-2 text-sm">
                <Link to="/enroll" className="block text-muted-foreground hover:text-foreground">
                  Music Classes
                </Link>
                <Link to="/marketplace" className="block text-muted-foreground hover:text-foreground">
                  Music Hub Store
                </Link>
                <Link to="/manage-account" className="block text-muted-foreground hover:text-foreground">
                  Manage Account
                </Link>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Visual Direction
              </p>
              <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                <p>
                  Curated built-in music imagery matched to training,
                  composition, and performance workflows.
                </p>
                <p className="font-medium text-foreground">
                  Visuals switch instantly with the active theme.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-border/70 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
            <p>(c) {new Date().getFullYear()} Murekefu Music Hub. All rights reserved.</p>
            <p>Built for compositions and arrangements by Murekefu Sam.</p>
          </div>
        </div>
      </footer>
    </main>
  );
};

export default LandingPage;







