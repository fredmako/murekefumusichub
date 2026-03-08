import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Award,
  BookOpen,
  Guitar,
  Headphones,
  Keyboard,
  Mic,
  Music,
  Quote,
  Users,
  Wind,
} from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
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

interface MusicClass {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  level: string;
}

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
];

const musicClasses: MusicClass[] = [
  {
    id: "piano",
    name: "Piano",
    description: "Build confident technique from foundations to performance.",
    icon: <Keyboard className="size-9" />,
    level: "Beginner to Advanced",
  },
  {
    id: "guitar",
    name: "Guitar",
    description: "Master rhythm, harmony, and expressive accompaniment.",
    icon: <Guitar className="size-9" />,
    level: "Beginner to Advanced",
  },
  {
    id: "vocal",
    name: "Vocal",
    description: "Improve breath support, diction, blend, and projection.",
    icon: <Mic className="size-9" />,
    level: "All Levels",
  },
  {
    id: "trumpet",
    name: "Trumpet",
    description: "Train embouchure and tone control with guided practice.",
    icon: <Wind className="size-9" />,
    level: "Beginner to Advanced",
  },
  {
    id: "theory",
    name: "Music Theory",
    description: "Understand composition, harmony, and score reading clearly.",
    icon: <BookOpen className="size-9" />,
    level: "All Levels",
  },
  {
    id: "ensemble",
    name: "Ensemble",
    description: "Rehearse and perform with disciplined group musicianship.",
    icon: <Users className="size-9" />,
    level: "Intermediate to Advanced",
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
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
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
            isDarkMode ? "opacity-[0.26]" : "opacity-[0.16]"
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

      <section className="section-shell texture-fabric texture-speckle motion-reveal relative overflow-hidden rounded-3xl border border-border/60 bg-card/60">
        {pickImageUrl(1) ? (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: `${
                isDarkMode
                  ? "linear-gradient(to right, rgba(6,18,34,0.74), rgba(10,31,54,0.54))"
                  : "linear-gradient(to right, rgba(255,255,255,0.74), rgba(255,255,255,0.44))"
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
              Murekefu Music Hub combines elite training, choir development,
              and a modern marketplace for composers and music teams.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/enroll">
                <Button size="lg">Start Learning</Button>
              </Link>
              <Link to="/marketplace">
                <Button size="lg" variant="outline">
                  Explore Music Hub
                </Button>
              </Link>
            </div>
            <div className="mt-8 grid max-w-md grid-cols-3 gap-3 text-sm">
              <div className="rounded-xl border border-border/70 bg-card p-3">
                <p className="text-2xl font-bold">6+</p>
                <p className="text-muted-foreground">Class Tracks</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-card p-3">
                <p className="text-2xl font-bold">100+</p>
                <p className="text-muted-foreground">Learners</p>
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
                Built for choirs, conductors, and composers
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
          <span className="soft-kicker">Programs</span>
          <h2 className="section-title">Choose your class track</h2>
          <p className="section-copy">
            Select a focused learning path and progress with guided milestones.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {musicClasses.map((musicClass, index) => (
            <Card
              key={musicClass.id}
              className={`lift-card motion-reveal texture-speckle cursor-pointer ${
                selectedClass === musicClass.id
                  ? "ring-2 ring-primary/40"
                  : "ring-1 ring-border/60"
              }`}
              style={
                {
                  ...(pickImageUrl(index + 7)
                    ? {
                        backgroundImage: `${
                          isDarkMode
                            ? "linear-gradient(to bottom, rgba(8,24,42,0.84), rgba(12,34,58,0.72))"
                            : "linear-gradient(to bottom, rgba(255,255,255,0.8), rgba(255,255,255,0.6))"
                        }, url(${pickImageUrl(index + 7)})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }
                    : {}),
                  animationDelay: `${index * 80}ms`,
                }
              }
              onClick={() => setSelectedClass(musicClass.id)}
            >
              <CardContent className="p-6">
                <div className="mb-4 inline-flex rounded-full bg-secondary p-3 text-primary">
                  {musicClass.icon}
                </div>
                <h3 className="text-2xl font-semibold">{musicClass.name}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {musicClass.description}
                </p>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-primary/80">
                  {musicClass.level}
                </p>
                <div className="mt-5">
                  <Link to="/enroll">
                    <Button variant="outline" className="w-full">
                      Learn More
                    </Button>
                  </Link>
                </div>
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
                Professional training for choirs, composers, and music students.
                Learn, perform, and grow with structured coaching and a modern
                music marketplace.
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
            <p>Built for choirs, composers, and students.</p>
          </div>
        </div>
      </footer>
    </main>
  );
};

export default LandingPage;







