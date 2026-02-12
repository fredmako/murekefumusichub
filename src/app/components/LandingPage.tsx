import React, { useState } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import {
  Music,
  Keyboard,
  Guitar,
  Mic,
  Wind,
  Users,
  BookOpen,
  Award,
  Quote,
  Headphones,
  Radio,
} from "lucide-react"
import ShowBanner  from "../utils/privacyBanner";
import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import { CardContent } from "./ui/card";
interface MusicClass {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  level: string;
}

  const testimonials = [
    {
      message: `We came together as Parents in Kianda school to sing together in support of our daughters. Most of us were passionate about singing without experience or training!
On the first day, I could read Sam’s mind wondering what he had gotten himself into! He started from identifying who fit into which voice group and patiently training us as individuals and groups. With his determination and great teaching/coaching skills, we were able to perform during Easter and Christmas cantatas.
The joy in our girls’ faces said it all. They were really proud of our beautiful singing. Memories were created that will last a life time.

Thank Sam!`,
      author: "Ann, Kianda School Parents Choir 2023 & 2024",
    },
    {
      message: `My passion for choral music was ignited when I had the privilege of being trained by the incredible Murekefu Sam. It all began at The Nairobi School, where I discovered a singer within me I never knew existed. With him at the helm, participation at the national level wasn't just a possibility – it was a guarantee. Murekefu is someone I truly look up to in the world of music, crafting melodies that leave you wanting more. Five years under his tutelage was a transformative experience I'd highly recommend to any aspiring choral artist.`,
      author:
        "Oduor Benedict, Nairobi School 2020 - 2023 & JKUAT Choir 2025",
    },
    {
      message: `Working with Sam Murekefu has been one of the best pleasures I have enjoyed in my adult life. He has been such an amazing music trainer, director, composer and friend. Before I met Sam, I was the "singing in the shower kinda girl" because I didn't know how to balance, warm, and sing from the stomach and he helped me with that.

The negative for me was that I never really got the chance to work with him longer but I get to call him a friend and that's good enough. Also, if you don't learn him well you might think he's always angry when he isn't, he's just concentrating on the music.`,
      author: "Naserian, MKU Main Campus Choir 2022 & 2023",
    },
    {
      message: `Mr. Sam Murekefu elevated our school choir to new heights with his expertise and passion for music. He demands excellence and pushes you to be your best - it's tough, but it works. It was his first time working with the JKUAT choir and his commitment to our growth and perfection pushed us to doing and being more. Literally took us out of our comfort zone. Though I didn't get to work with him one-on-one, I've seen how he brings out the best in our choir. He placed us on the map, musically speaking! Would love to learn from him more in the future.`,
      author: "Miriam Seka, JKUAT Choir 2025",
    },
    {
      message: `Murekefu Sam, thank you for your incredible dedication to Maziwa Methodist Choir in the year 2018 all through covid season. You took a group of passionate but untrained singers and, through individual voice coaching, discipline, and strict time keeping, turned us into a confident and effective choir.

You helped Maziwa Methodist Choir grow from raw passion into a structured and confident choir through individual coaching and strong emphasis on time keeping.

All the best!`,
      author: "Lilian, Maziwa Methodist Church 2018-2019",
    },
  ];


export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  const [selectedClass, setSelectedClass] = useState<string | null>(null);

  // ✅ Privacy Modal (Shows only once)
  // Initialize in an effect to avoid reading localStorage during SSR
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem("privacyAccepted");
    setIsPrivacyOpen(accepted !== "true");
  }, []);

  const handleAcceptPrivacy = () => {
    localStorage.setItem("privacyAccepted", "true");
    setIsPrivacyOpen(false);
  };

  const musicClasses: MusicClass[] = [
    {
      id: "piano",
      name: "Piano",
      description: "Learn piano at your pace.",
      icon: <Keyboard className="w-12 h-12" />,
      level: "Beginner to Advanced",
    },
    {
      id: "guitar",
      name: "Guitar",
      description: "Play the world's favorite instrument.",
      icon: <Guitar className="w-12 h-12" />,
      level: "Beginner to Advanced",
    },
    {
      id: "vocal",
      name: "Vocal",
      description: "Improve your singing skills.",
      icon: <Mic className="w-12 h-12" />,
      level: "All Levels",
    },
    {
      id: "trumpet",
      name: "Trumpet",
      description: "Master the trumpet with us.",
      icon: <Wind className="w-12 h-12" />,
      level: "Beginner to Advanced",
    },
    {
      id: "music-theory",
      name: "Music Theory",
      description: "Understand music composition.",
      icon: <BookOpen className="w-12 h-12" />,
      level: "All Levels",
    },
    {
      id: "ensemble",
      name: "Ensemble",
      description: "Perform with fellow musicians.",
      icon: <Users className="w-12 h-12" />,
      level: "Intermediate to Advanced",
    },
  ];

  const features = [
    {
      title: "Expert Instructors",
      description: "Learn from experienced professionals.",
      icon: <Award className="w-8 h-8" />,
    },
    {
      title: "Flexible Scheduling",
      description: "Classes at times that suit you.",
      icon: <Music className="w-8 h-8" />,
    },
    {
      title: "All Skill Levels",
      description: "From beginners to advanced.",
      icon: <BookOpen className="w-8 h-8" />,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <Dialog open={isPrivacyOpen} onOpenChange={setIsPrivacyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Privacy Policy Notice</DialogTitle>
            <DialogDescription>
              We respect your privacy. By continuing to use this website,
              you agree to our privacy and data usage practices.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => navigate("/privacy-policy")}
            >
              View Privacy Policy
            </Button>
            <Button onClick={handleAcceptPrivacy}>
              Accept & Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================= Hero Section ================= */}
      <section className="relative bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-20 px-4">
        <div className="container mx-auto max-w-6xl text-center space-y-6">
          <h1 className="text-5xl md:text-6xl font-bold">
            Music <span className="italic">for</span> Everyone
          </h1>
          <p className="text-xl md:text-2xl text-purple-100">
            Discover your talents and pick your instrument
          </p>
          <Link to="/login">
            <Button size="lg" variant="secondary" className="text-lg">
              Join Us Today
            </Button>
          </Link>
        </div>
      </section>

      {/* Render the bottom privacy banner (also respects localStorage) */}
      <ShowBanner onAccept={handleAcceptPrivacy} />

      {/* ================= Features Section ================= */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="container mx-auto max-w-6xl text-center">
          <h2 className="text-3xl font-bold mb-12 text-gray-900">
            Why Choose Us?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, idx) => (
              <Card key={idx} className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex justify-center mb-4 text-purple-600">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold mb-2 text-gray-900">
                  {feature.title}
                </h3>
                <p className="text-gray-600">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ================= Music Classes ================= */}
      <section className="py-16 px-4 bg-white">
        <div className="container mx-auto max-w-6xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-gray-900">
            Music Classes
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {musicClasses.map((musicClass) => (
              <Card
                key={musicClass.id}
                className={`p-8 cursor-pointer transition-all hover:shadow-lg hover:border-purple-400 ${
                  selectedClass === musicClass.id
                    ? "border-2 border-purple-600 bg-purple-50"
                    : ""
                }`}
                onClick={() => setSelectedClass(musicClass.id)}
              >
                <div className="flex justify-center mb-4 text-purple-600">
                  {musicClass.icon}
                </div>
                <h3 className="text-2xl font-bold mb-2 text-gray-900 text-center">
                  {musicClass.name}
                </h3>
                <p className="text-gray-600 mb-4 text-center">
                  {musicClass.description}
                </p>
                <span className="inline-block px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium mb-4">
                  {musicClass.level}
                </span>
                <Link to="/classes">
                  <Button variant="outline" className="w-full">
                    Learn More
                  </Button>
                </Link>
              </Card>
            ))}
          </div>
        </div>
      </section>
       {/* ================= HERO SECTION ================= */}
      <section className="relative bg-gradient-to-r from-purple-700 to-indigo-800 text-white py-24 px-6">
        <div className="container mx-auto text-center max-w-4xl">
          <Music className="w-14 h-14 mx-auto mb-6 text-yellow-300" />
          <h1 className="text-5xl font-bold mb-6">
            Elevating Choral & Music Excellence
          </h1>
          <p className="text-lg text-purple-100 mb-8">
            Discover professional music training, choral compositions,
            performance opportunities, and a growing creative community.
          </p>

          <div className="flex justify-center gap-4 flex-wrap">
            <Link to="/marketplace">
              <Button size="lg" variant="secondary">
                Explore Music Hub
              </Button>
            </Link>

            <Link to="/about">
              <Button size="lg" variant="outline">
                Learn More
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ================= ABOUT PREVIEW ================= */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="container mx-auto max-w-5xl text-center">
          <h2 className="text-4xl font-bold mb-6">About Us</h2>

          <p className="text-gray-600 text-lg mb-6 leading-relaxed">
            We are a dynamic music platform committed to nurturing talent,
            promoting choral excellence, and creating opportunities for
            musicians to grow professionally and creatively.
          </p>

          <p className="text-gray-600 text-lg mb-8 leading-relaxed">
            Through structured training programs, digital music distribution,
            live performance preparation, and professional mentorship, we help
            individuals and choirs reach their highest artistic potential.
          </p>

          <Link to="/about">
            <Button size="lg">Read More</Button>
          </Link>
        </div>
      </section>

      {/* ================= SERVICES SECTION ================= */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-4xl font-bold text-center mb-14">
            Our Services
          </h2>

          <div className="grid md:grid-cols-3 gap-8">

            <Card className="text-center p-6 shadow-lg hover:shadow-xl transition">
              <CardContent>
                <Mic className="w-10 h-10 mx-auto text-purple-600 mb-4" />
                <h3 className="text-xl font-semibold mb-3">
                  Vocal Training
                </h3>
                <p className="text-gray-600">
                  Professional vocal coaching designed to improve technique,
                  breathing, tone quality, and performance confidence.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center p-6 shadow-lg hover:shadow-xl transition">
              <CardContent>
                <Users className="w-10 h-10 mx-auto text-purple-600 mb-4" />
                <h3 className="text-xl font-semibold mb-3">
                  Choral Development
                </h3>
                <p className="text-gray-600">
                  Structured programs for choirs to enhance harmony,
                  coordination, stage presence, and musical interpretation.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center p-6 shadow-lg hover:shadow-xl transition">
              <CardContent>
                <BookOpen className="w-10 h-10 mx-auto text-purple-600 mb-4" />
                <h3 className="text-xl font-semibold mb-3">
                  Music Education
                </h3>
                <p className="text-gray-600">
                  Comprehensive music theory, instrumental training, and
                  performance preparation for all levels.
                </p>
              </CardContent>
            </Card>

          </div>
          <div className="mt-8 flex justify-center gap-4">
            <Link to="/enroll">
              <Button size="lg" variant="secondary">
                Enroll Now
              </Button>
            </Link>

            <Link to="/contact">
              <Button size="lg" variant="outline">
                Contact Us
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ================= WHY CHOOSE US ================= */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-4xl font-bold text-center mb-14">
            Why Choose Us
          </h2>

          <div className="grid md:grid-cols-3 gap-8 text-center">

            <div>
              <Headphones className="w-10 h-10 mx-auto text-indigo-600 mb-4" />
              <h3 className="text-xl font-semibold mb-2">
                Professional Mentorship
              </h3>
              <p className="text-gray-600">
                Learn from experienced musicians and composers dedicated to
                developing your musical journey.
              </p>
            </div>

            <div>
              <Radio className="w-10 h-10 mx-auto text-indigo-600 mb-4" />
              <h3 className="text-xl font-semibold mb-2">
                Modern Digital Access
              </h3>
              <p className="text-gray-600">
                Access online resources, compositions, and digital training
                materials anytime, anywhere.
              </p>
            </div>

            <div>
              <Music className="w-10 h-10 mx-auto text-indigo-600 mb-4" />
              <h3 className="text-xl font-semibold mb-2">
                Performance Opportunities
              </h3>
              <p className="text-gray-600">
                Participate in concerts, recordings, and live events that
                showcase your musical growth.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ================= CALL TO ACTION ================= */}
      <section className="py-24 px-6 bg-gradient-to-r from-indigo-800 to-purple-700 text-white text-center">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-4xl font-bold mb-6">
            Join Our Growing Music Community
          </h2>

          <p className="text-lg text-purple-100 mb-8">
            Whether you're a beginner, a choir director, or a professional
            composer, there's a place for you here.
          </p>

          <div className="flex justify-center gap-4 flex-wrap">
            <Link to="/enroll">
              <Button size="lg" variant="secondary">
                Join Us
              </Button>
            </Link>

            <Link to="/marketplace">
              <Button size="lg" variant="outline">
                Explore Music Hub
              </Button>
            </Link>
          </div>
        </div>
      </section>

   

          
            {/* ================= Testimonials ================= */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-14">Testimonials</h2>

          <div className="grid md:grid-cols-2 gap-10">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="p-8 shadow-lg text-left">
                <Quote className="text-purple-600 mb-4" />
                <p className="text-gray-700 whitespace-pre-line leading-relaxed mb-6">
                  {testimonial.message}
                </p>
                <p className="font-semibold text-purple-700">
                  ~ {testimonial.author}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ================= Footer ================= */}
      <footer className="bg-gray-900 text-gray-300 py-8 text-center">
        <p>© {new Date().getFullYear()} Music Academy. All rights reserved.</p>
        <div className="mt-4 flex justify-center gap-6 text-sm">
          <Link to="/privacy-policy" className="hover:text-white">
            Privacy Policy
          </Link>
          <Link to="/terms" className="hover:text-white">
            Terms of Service
          </Link>
        </div>
      </footer>

      {/* ================= Bottom Privacy Banner ================= */}
      {ShowBanner && (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-900 text-white p-4 z-50">
          <div className="max-w-6xl mx-auto flex justify-between items-center gap-4">
            <p className="text-sm">
              We use cookies to improve your experience. Read our{" "}
              <span
                onClick={() => navigate("/privacy-policy")}
                className="underline cursor-pointer"
              >
                Privacy Policy
              </span>.
            </p>
            <Button size="sm" onClick={handleAcceptPrivacy}>
              Accept
            </Button>
          </div>
        </div>
      
      )}
</div>); };
  