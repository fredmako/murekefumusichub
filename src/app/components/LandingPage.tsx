import React, { useState } from "react";
import { Button } from './ui/button';
import { Card } from './ui/card';
import {
  Music,
  Keyboard,
  Guitar,
  Mic,
  Wind,
  Users,
  BookOpen,
  Award,
  Star,
} from "lucide-react";

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
    { id: "piano", name: "Piano", description: "Want to learn to play piano? Our Piano Lessons are open to everyone.", icon: <Keyboard className="w-12 h-12" />, level: "Beginner to Advanced" },
    { id: "guitar", name: "Guitar", description: "Learn to play the world's popular instrument with our guitar classes.", icon: <Guitar className="w-12 h-12" />, level: "Beginner to Advanced" },
    { id: "vocal", name: "Vocal", description: "Wide variety of vocal classes for all ages and skills.", icon: <Mic className="w-12 h-12" />, level: "All Levels" },
    { id: "trumpet", name: "Trumpet", description: "Extensive trumpet learning program for all skill levels.", icon: <Wind className="w-12 h-12" />, level: "Beginner to Advanced" },
    { id: "music-theory", name: "Music Theory", description: "Master the fundamentals of music theory and composition.", icon: <BookOpen className="w-12 h-12" />, level: "All Levels" },
    { id: "ensemble", name: "Ensemble", description: "Join our ensemble classes and perform with fellow musicians.", icon: <Users className="w-12 h-12" />, level: "Intermediate to Advanced" },
  ];

  const features = [
    { title: "Expert Instructors", description: "Learn from experienced music professionals", icon: <Award className="w-8 h-8" /> },
    { title: "Flexible Scheduling", description: "Classes available at times that work for you", icon: <Music className="w-8 h-8" /> },
    { title: "All Skill Levels", description: "From complete beginners to advanced musicians", icon: <BookOpen className="w-8 h-8" /> },
    { title: "Certified Courses", description: "Get recognized certifications after completing courses", icon: <Star className="w-8 h-8" /> },
    { title: "Music Library", description: "Access to classical, modern, and customized compositions", icon: <BookOpen className="w-8 h-8" /> },
    { title: "Online & Offline Classes", description: "Learn music in-person or from the comfort of your home", icon: <Users className="w-8 h-8" /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Navbar */}
      <nav className="bg-white shadow-md sticky top-0 z-50">
        <div className="container mx-auto flex justify-between items-center py-4 px-4 max-w-6xl">
          <div className="text-2xl font-bold text-purple-600">Prime Music Media</div>
          <div className="space-x-6 hidden md:flex">
            <a href="#home" className="text-gray-700 hover:text-purple-600">Home</a>
            <a href="#classes" className="text-gray-700 hover:text-purple-600">Music Classes</a>
            <a href="#features" className="text-gray-700 hover:text-purple-600">Features</a>
            <a href="#testimonials" className="text-gray-700 hover:text-purple-600">Testimonials</a>
            <a href="/login" className="text-gray-700 hover:text-purple-600">Login</a>
            <a href="#contact" className="text-gray-700 hover:text-purple-600">Contact</a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="home" className="relative bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-20 px-4">
        <div className="container mx-auto max-w-6xl text-center space-y-6">
          <h1 className="text-5xl md:text-6xl font-bold">
            Music <span className="italic">for</span> Everyone
          </h1>
          <p className="text-xl md:text-2xl text-purple-100">
            Discover your talents, choose your instrument, and start your journey today
          </p>
          <Button size="lg" variant="secondary" className="text-lg" onClick={() => window.location.href="/login"}>
            Join Us Today
          </Button>
        </div>
      </section>

      {/* About Section */}
      <section className="py-16 px-4 bg-white">
        <div className="container mx-auto max-w-6xl grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
              Welcome to Prime Music Media!
            </h2>
            <p className="text-gray-600 leading-relaxed">
              We make music accessible to everyone, anywhere. Register as a composer, arranger, or trainer and share your works with enthusiasts and learners worldwide.
            </p>
            <p className="text-gray-600 leading-relaxed">
              Classical, modern, and group compositions are now available for all. Even pieces from renowned composers like Mozart are accessible via our partnerships.
            </p>
            <Button variant="default" size="lg" onClick={() => window.location.href="/testimonials"}>
              Read Testimonials
            </Button>
          </div>
          <div className="relative h-96 bg-gradient-to-br from-purple-200 to-indigo-200 rounded-lg overflow-hidden flex items-center justify-center">
            <Music className="w-32 h-32 text-purple-400 opacity-20" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 px-4 bg-gray-50">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-900">
            Why Choose Prime Music Media?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-8">
            {features.map((feature, idx) => (
              <Card key={idx} className="p-6 text-center hover:shadow-lg transition-shadow">
                <div className="flex justify-center mb-4 text-purple-600">{feature.icon}</div>
                <h3 className="text-xl font-semibold mb-2 text-gray-900">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Music Classes Section */}
      <section id="classes" className="py-16 px-4 bg-white">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 text-gray-900">
            Music Classes
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {musicClasses.map((cls) => (
              <Card
                key={cls.id}
                className={`p-8 cursor-pointer transition-all hover:shadow-lg hover:border-purple-400 ${selectedClass === cls.id ? "border-2 border-purple-600 bg-purple-50" : ""}`}
                onClick={() => setSelectedClass(cls.id)}
              >
                <div className="flex justify-center mb-4 text-purple-600">{cls.icon}</div>
                <h3 className="text-2xl font-bold mb-2 text-gray-900 text-center">{cls.name}</h3>
                <p className="text-gray-600 mb-4 text-center">{cls.description}</p>
                <div className="flex items-center justify-center gap-2 mb-4">
                  <span className="inline-block px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">{cls.level}</span>
                </div>
                <Button variant="outline" className="w-full" onClick={(e) => e.stopPropagation()}>Learn More</Button>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-16 px-4 bg-gray-50">
        <div className="container mx-auto max-w-6xl text-center space-y-6">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
            What Our Students Say
          </h2>
          <p className="text-gray-600">
            Thousands of students have improved their musical skills with Prime Music Media.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
            <Card className="p-6">
              <p className="text-gray-700">"The piano classes were excellent! Highly recommend."</p>
              <p className="mt-2 font-semibold">- Jane Doe</p>
            </Card>
            <Card className="p-6">
              <p className="text-gray-700">"Prime Music Media made music accessible to our choir."</p>
              <p className="mt-2 font-semibold">- Choir Group</p>
            </Card>
            <Card className="p-6">
              <p className="text-gray-700">"I loved the flexibility and expert instructors."</p>
              <p className="mt-2 font-semibold">- John Smith</p>
            </Card>
          </div>
          <Button variant="default" size="lg" onClick={() => window.location.href="/testimonials"}>
            View All Testimonials
          </Button>
        </div>
      </section>

      {/* CTA Section */}
      <section id="contact" className="py-16 px-4 bg-gradient-to-r from-purple-600 to-indigo-600">
        <div className="container mx-auto max-w-4xl text-center text-white space-y-6">
          <h2 className="text-3xl md:text-4xl font-bold">
            Ready to Start Your Musical Journey?
          </h2>
          <p className="text-lg text-purple-100">
            Join thousands of students learning music with Prime Music Media.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="secondary" onClick={() => window.location.href="/login"}>Enroll Now</Button>
            <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-purple-600" onClick={() => window.location.href="/contact"}>Contact Us</Button>
          </div>
        </div>
      </section>
    </div>
  );
};