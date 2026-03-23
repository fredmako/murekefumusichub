import { Link } from "react-router-dom";
import {
  BookOpen,
  CirclePlay,
  Compass,
  FileText,
  GraduationCap,
  LayoutDashboard,
  MessageSquare,
  Music,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";

const navigationMenus = [
  {
    title: "Home",
    description: "Use this menu for public information and guidance pages.",
    icon: Compass,
    items: ["Home", "About Us", "Testimonials", "Help", "Contact Us"],
  },
  {
    title: "Services",
    description: "Use this menu to enter the platform's main offerings.",
    icon: Sparkles,
    items: ["Learn Music", "Music Hub"],
  },
  {
    title: "Dashboards",
    description: "Signed-in users get a centralized menu for role-based workspaces.",
    icon: LayoutDashboard,
    items: ["Learner Dashboard", "My Library", "My Arrangements", "My Compositions", "Admin Panel"],
  },
  {
    title: "Profile Menu",
    description: "Open your avatar menu for personal account and sign-out actions.",
    icon: Settings2,
    items: ["Manage Account", "Appearance", "Profile photo", "Sign out"],
  },
];

const quickLinks = [
  {
    title: "Music Hub",
    description: "Open it from Services to browse arrangements and compositions, preview music, and head straight to checkout.",
    path: "/marketplace",
    icon: Music,
  },
  {
    title: "My Library",
    description: "Find it under Dashboards to open your purchases, change view style, and download approved files.",
    path: "/buyer",
    icon: ShoppingBag,
  },
  {
    title: "Learner Dashboard",
    description: "Find it under Dashboards for learning progress, enrollment activity, and a calmer student-focused workspace.",
    path: "/learner",
    icon: GraduationCap,
  },
  {
    title: "Manage Account",
    description: "Open it from the profile menu to update your profile, switch themes, and control design preferences.",
    path: "/manage-account",
    icon: Settings2,
  },
  {
    title: "Messenger",
    description: "Move between direct support chat and the public Murekefu community lounge.",
    path: "/messenger",
    icon: MessageSquare,
  },
  {
    title: "Admin Panel",
    description: "Moderate users, review enrollments, export reports, and manage platform activity.",
    path: "/admin",
    icon: ShieldCheck,
  },
];

const roleGuides = [
  {
    title: "Visitors",
    icon: Sparkles,
    points: [
      "Start on the landing page and use the Home menu to explore public platform information.",
      "Open Services when you want to move into Learn Music or Music Hub.",
      "Use the login page to create an account or sign in with Google.",
      "Open Music Hub from Services to preview what is available before you commit to a purchase.",
    ],
  },
  {
    title: "Learners",
    icon: GraduationCap,
    points: [
      "Use the Learner Dashboard for a student-friendly workspace focused on progress and learning flow.",
      "Submit or track enrollment activity from the learning journey pages.",
      "Use Dashboards as your main shortcut after signing in.",
      "Use Messenger and Community to ask questions, connect with others, and stay supported.",
    ],
  },
  {
    title: "Buyers",
    icon: ShoppingBag,
    points: [
      "Browse Music Hub, preview compositions, and use filters, sorting, and list/card view to find music quickly.",
      "When you click purchase, the system takes you directly to checkout.",
      "Use Dashboards to jump into My Library after approval.",
      "After approval, open My Library to download and manage purchased files.",
    ],
  },
  {
    title: "Composers",
    icon: Music,
    points: [
      "Use My Arrangements and My Compositions separately so each workflow stays focused.",
      "Open both workspaces from the Dashboards menu instead of searching through the top bar.",
      "Upload new work, edit listings, review performance data, and delete old items when needed.",
      "Monitor pricing, visibility, and sales from the composer workspace.",
    ],
  },
  {
    title: "Admins",
    icon: LayoutDashboard,
    points: [
      "Open the Admin Panel to manage users, enrollments, support conversations, reports, and system activity.",
      "Use Dashboards to reach the admin workspace quickly after login.",
      "Use state-aware actions such as promote, demote, suspend, activate, verify, and delete only where appropriate.",
      "Export branded PDF reports with selected fields for users, transactions, requests, enrollments, and compositions.",
    ],
  },
];

const actionManuals = [
  {
    title: "Preview and Buy Music",
    icon: CirclePlay,
    steps: [
      "Open Music Hub and use search, filters, sort, and view toggles to narrow the list.",
      "Tap a composition card or row to open the preview panel.",
      "Play the MIDI sample if available, review the details, then select Purchase and Checkout.",
      "Complete checkout and wait for approval before downloading from My Library.",
    ],
  },
  {
    title: "Upload an Arrangement or Composition",
    icon: FileText,
    steps: [
      "Open My Arrangements or My Compositions depending on the type of work you are adding.",
      "Choose Upload New and complete the form with title, pricing, category, and file details.",
      "Save or publish the work, then return to your listing area to review performance and visibility.",
      "Use Edit or Delete later if you need to revise or remove the item.",
    ],
  },
  {
    title: "Join the Community",
    icon: Users,
    steps: [
      "Open Messenger and switch to the Community workspace.",
      "Read recent discussion, upload attachments, send messages, and open member previews by tapping profile photos in the lounge.",
      "If you need direct help instead, switch back to Support.",
      "Use refresh only when you suspect your connection has changed.",
    ],
  },
  {
    title: "Personalize the System",
    icon: Settings2,
    steps: [
      "Go to Manage Account and open the Appearance section.",
      "Choose your preferred theme preset, light or dark mode, icon size, view scale, layout density, and surface style.",
      "The system saves the design to your account automatically.",
      "Use Take Selfie if you want a faster profile photo flow with front-camera support.",
    ],
  },
];

export function HelpCenterPage() {
  return (
    <main className="texture-linen min-h-screen">
      <section className="section-shell">
        <div className="route-backdrop-panel texture-speckle overflow-hidden rounded-[2rem] border border-border/70 bg-card/70 p-6 shadow-[0_28px_60px_-38px_rgba(15,23,42,0.72)] sm:p-8">
          <span className="soft-kicker">System Docs & User Manuals</span>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Learn the system without guessing your way through it
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
            This help center gives users a practical guide to navigating Murekefu
            Music Hub, using the new grouped navigation, switching between
            dashboards, carrying out common actions, and understanding what each
            role can do.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/marketplace">
              <Button size="lg">Open Music Hub</Button>
            </Link>
            <Link to="/manage-account">
              <Button size="lg" variant="outline">
                Open Manage Account
              </Button>
            </Link>
            <Link to="/messenger">
              <Button size="lg" variant="outline">
                Open Messenger
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="section-shell pt-4">
        <div className="mb-8">
          <span className="soft-kicker">Navigation Update</span>
          <h2 className="section-title">How the new menus are organized</h2>
          <p className="section-copy">
            The latest navigation keeps public pages, platform services, role dashboards,
            and personal account actions in separate groups so the top bar stays cleaner.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {navigationMenus.map((menu) => {
            const Icon = menu.icon;
            return (
              <Card key={menu.title} className="lift-card texture-speckle border-border/70 bg-card/90">
                <CardHeader className="space-y-3">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle>{menu.title}</CardTitle>
                    <CardDescription className="mt-2 leading-6">
                      {menu.description}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {menu.items.map((item) => (
                    <div
                      key={item}
                      className="rounded-xl border border-border/60 bg-muted/35 px-3 py-2 text-sm text-muted-foreground"
                    >
                      {item}
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="section-shell pt-4">
        <div className="mb-8">
          <span className="soft-kicker">Quick Links</span>
          <h2 className="section-title">Open the right workspace quickly</h2>
          <p className="section-copy">
            These links are the fastest way to explain the system to new users
            after they understand where each menu group now belongs.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Card key={link.title} className="lift-card texture-speckle border-border/70 bg-card/90">
                <CardHeader className="space-y-3">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle>{link.title}</CardTitle>
                    <CardDescription className="mt-2 leading-6">
                      {link.description}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <Link to={link.path}>
                    <Button variant="outline" className="w-full">
                      Open {link.title}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="section-shell pt-4">
        <div className="mb-8">
          <span className="soft-kicker">Role Guide</span>
          <h2 className="section-title">What each type of user should focus on</h2>
          <p className="section-copy">
            Each role has its own flow, so the quickest way to reduce confusion is
            to show people where they belong first.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {roleGuides.map((guide) => {
            const Icon = guide.icon;
            return (
              <Card key={guide.title} className="lift-card texture-speckle border-border/70 bg-card/90">
                <CardHeader>
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="mt-3">{guide.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {guide.points.map((point) => (
                    <div
                      key={point}
                      className="rounded-xl border border-border/60 bg-muted/35 px-4 py-3 text-sm leading-6 text-muted-foreground"
                    >
                      {point}
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="section-shell pt-4">
        <div className="mb-8">
          <span className="soft-kicker">Action Manuals</span>
          <h2 className="section-title">Step-by-step help for common tasks</h2>
          <p className="section-copy">
            These action guides are written to help a user complete a task
            quickly, even if they are not technical.
          </p>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {actionManuals.map((manual) => {
            const Icon = manual.icon;
            return (
              <Card key={manual.title} className="lift-card texture-speckle border-border/70 bg-card/90">
                <CardHeader>
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="mt-3">{manual.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {manual.steps.map((step, index) => (
                    <div
                      key={step}
                      className="flex gap-3 rounded-xl border border-border/60 bg-muted/35 px-4 py-3"
                    >
                      <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {index + 1}
                      </div>
                      <p className="text-sm leading-6 text-muted-foreground">
                        {step}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="section-shell pt-4">
        <Card className="texture-speckle border-0 bg-gradient-to-r from-[#0b3f45] to-primary text-white">
          <CardContent className="p-8 sm:p-10">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/14 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white/90">
                <BookOpen className="h-4 w-4" />
                Need more help?
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight">
                Use support chat when the manual is not enough
              </h2>
              <p className="mt-3 text-sm leading-7 text-white/85 sm:text-base">
                If a user still gets stuck, they can move from the manual into
                Messenger and continue the conversation with support or the
                Murekefu community.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/messenger">
                  <Button size="lg" variant="secondary">
                    Open Messenger
                  </Button>
                </Link>
                <Link to="/contact">
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-white/35 bg-transparent text-white hover:bg-white/10 hover:text-white"
                  >
                    Contact Us
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

export default HelpCenterPage;
