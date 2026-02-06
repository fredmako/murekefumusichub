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
} from "lucide-react";
import { Link } from "react-router-dom";

interface MusicClass {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  level: string;
}

export const LandingPage: React.FC = () => {
  const [selectedClass, setSelectedClass] = useState<string | null>(null);

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

  const testimonials = [
    {
      quote:
        "We came together as Parents in Kianda school to sing together in support of our daughters. Most of us were passionate about singing without experience or training On the first day, I could read Sams mind wondering what he had gotten himself into! He started from identifying who fit into which voice group and patiently training us as individuals and groups. With his determination and great teaching/coaching skills, we were able to perform during Easter and Christmas cantatas.The joy in our girls faces said it all. They were really proud of our beautiful singing. Memories were created that will last a life time. Thank Sam!!",
      author: "Ann, Kianda School Parents Choir",
    },
    {
      quote:
        "My passion for choral music was ignited when I had the privilege of being trained by the incredible Murekefu Sam. It all began at The Nairobi School, where I discovered a singer within me I never knew existed. With him at the helm, participation at the national level wasn't just a possibility – it was a guarantee. Murekefu is someone I truly look up to in the world of music, crafting melodies that leave you wanting more. Five years under his tutelage was a transformative experience I'd highly recommend to any aspiring choral artist.",
      author: "~Oduor Benedict, Nairobi school 2020 - 2023 & Jkuat Choir 2025",
    },
    {
      quote:
        "Working with Sam Murekefu has been one of the best pleasures I have enjoyed in my adult life. He has been such an amazing music trainer, director, composer and friend. Before I met Sam, I was singing in the shower kinda girl because I didnt know how to balance, warm, and sing from the stomach and he helped me with that. The negative for me was that I never really got the chance to work with him longer but I get to call him a friend and that's good enough. Also, if you don't learn him well you might think he's always angry when he isn't, he's just concentrating on the music.",
      author: "Naserian, MKU Choir",
    },
    {
      quote: "Murekefu Sam, thank you for your incredible dedication to Maziwa Methodist Choir in the year 2018 all through covid season. You took a group of passionate but untrained singers and, through individual voice coaching, discipline, and strict time keeping, turned us into a confident and effective choir.You helped Maziwa Methodist Choir grow from raw passion into a structured and confident choir through individual coaching and strong emphasis on time keeping. All the best! ", author: "Miriam Seka, JKUAT Choir",
    },
    {
      quote:
        "Murekefu Sam, thank you for your incredible dedication to Maziwa Methodist Choir in the year 2018 all through covid season. You took a group of passionate but untrained singers and, through individual voice coaching, discipline, and strict time keeping, turned us into a confident and effective choir. You helped Maziwa Methodist Choir grow from raw passion into a structured and confident choir through individual coaching and strong emphasis on time keeping. All the best", author: "Lilian, Maziwa Methodist Choir",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero Section */}
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
      {/* Marketplace Hero Section */}
      <section className="py-20 px-4 bg-white">
        <div className="container mx-auto max-w-6xl grid md:grid-cols-2 gap-12 items-center">
          {/* Text */}
          <div className="space-y-6">
            <h2 className="text-4xl font-bold text-gray-900">
              Explore the Marketplace
            </h2>
            <p className="text-gray-600 leading-relaxed">
              Discover a growing library of choral compositions from talented
              composers. Browse by style, difficulty, voice type, or festival
              category and find music that perfectly matches your choir’s needs.
            </p>
            <p className="text-gray-600 leading-relaxed">
              Whether you’re a choir director, student, or performer, the
              marketplace helps you explore compositions tailored to your
              musical preferences.
            </p>

            {/* ✅ Marketplace CTA */}
            <Link to="/marketplace">
              <Button size="lg">Explore the Marketplace</Button>
            </Link>
          </div>

          {/* Visual */}
          <div className="relative h-72 md:h-96 bg-gradient-to-br from-indigo-200 to-purple-200 rounded-lg overflow-hidden shadow-lg flex items-center justify-center">
            <Music className="w-32 h-32 text-purple-500 opacity-20" />
          </div>
        </div>
      </section>
      {/* About Section */}
      <section className="py-16 px-4 bg-white">
        <div className="container mx-auto max-w-6xl grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
              Welcome to  m      Music Media!
            </h2>
            <p className="text-gray-600 leading-relaxed">
              We make music accessible to anyone, anywhere. We connect
              composers, arrangers, and music trainers with learners and choirs
              worldwide.
            </p>
            <p className="text-gray-600 leading-relaxed">
              Classical pieces and popular compositions that were previously
              hard to find are now available through our platform.
            </p>
            <Link to="/about">
              <Button variant="default" size="lg">
                Read More
              </Button>
            </Link>
          </div>
          <div className="relative h-72 md:h-96 bg-gradient-to-br from-purple-200 to-indigo-200 rounded-lg overflow-hidden shadow-lg flex items-center justify-center">
            <Music className="w-32 h-32 text-purple-400 opacity-20" />
          </div>
        </div>
      </section>

      {/* Features Section */}
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

      {/* Music Classes Section */}
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

      {/* Testimonials */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="container mx-auto max-w-6xl text-center">
          <h2 className="text-3xl font-bold mb-12 text-gray-900">
            Testimonials
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {testimonials.map((t, idx) => (
              <Card key={idx} className="p-6 hover:shadow-lg transition-shadow">
                <p className="text-gray-600 mb-4">"{t.quote}"</p>
                <p className="font-semibold text-gray-900">~ {t.author}</p>
              </Card>
            ))}
          </div>
          <div className="mt-8">
            <Link to="/testimonials">
              <Button size="lg">Read More</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          Ready to Start Your Musical Journey?
        </h2>
        <p className="text-lg text-purple-100 mb-6">
          Join thousands of students learning music with Murekefu Music Hub
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
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
      </section>
    </div>
  );
};
