import React, { useState } from "react";
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Music, Keyboard, Guitar, Mic, Wind, Users, BookOpen, Award } from "lucide-react";
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
    { id: "piano", name: "Piano", description: "Learn piano at your pace.", icon: <Keyboard className="w-12 h-12" />, level: "Beginner to Advanced" },
    { id: "guitar", name: "Guitar", description: "Play the world's favorite instrument.", icon: <Guitar className="w-12 h-12" />, level: "Beginner to Advanced" },
    { id: "vocal", name: "Vocal", description: "Improve your singing skills.", icon: <Mic className="w-12 h-12" />, level: "All Levels" },
    { id: "trumpet", name: "Trumpet", description: "Master the trumpet with us.", icon: <Wind className="w-12 h-12" />, level: "Beginner to Advanced" },
    { id: "music-theory", name: "Music Theory", description: "Understand music composition.", icon: <BookOpen className="w-12 h-12" />, level: "All Levels" },
    { id: "ensemble", name: "Ensemble", description: "Perform with fellow musicians.", icon: <Users className="w-12 h-12" />, level: "Intermediate to Advanced" },
  ];

  const features = [
    { title: "Expert Instructors", description: "Learn from experienced professionals.", icon: <Award className="w-8 h-8" /> },
    { title: "Flexible Scheduling", description: "Classes at times that suit you.", icon: <Music className="w-8 h-8" /> },
    { title: "All Skill Levels", description: "From beginners to advanced.", icon: <BookOpen className="w-8 h-8" /> },
  ];

  const testimonials = [
    { quote: "We sang together as parents at Kianda School. Sam trained us individually and as a group, and we performed beautifully!", author: "Ann, Kianda School Parents Choir" },
    { quote: "Murekefu Sam ignited my passion for choral music and helped me perform at the national level.", author: "Oduor Benedict, Nairobi School & JKUAT Choir" },
    { quote: "Working with Sam improved my singing technique and confidence.", author: "Naserian, MKU Choir" },
    { quote: "Sam elevated our JKUAT choir to new heights with his dedication.", author: "Miriam Seka, JKUAT Choir" },
    { quote: "Sam turned Maziwa Methodist Choir into a confident and structured choir.", author: "Lilian, Maziwa Methodist Choir" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-20 px-4">
        <div className="container mx-auto max-w-6xl text-center space-y-6">
          <h1 className="text-5xl md:text-6xl font-bold">Music <span className="italic">for</span> Everyone</h1>
          <p className="text-xl md:text-2xl text-purple-100">Discover your talents and pick your instrument</p>
          <Button size="lg" variant="secondary" className="text-lg">
            Join Us Today
          </Button>
        </div>
      </section>

      {/* About Section */}
      <section className="py-16 px-4 bg-white">
        <div className="container mx-auto max-w-6xl grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Welcome to Prime Music Media!</h2>
            <p className="text-gray-600 leading-relaxed">
              We make music accessible to anyone, anywhere. We connect composers, arrangers, and music trainers with learners and choirs worldwide.
            </p>
            <p className="text-gray-600 leading-relaxed">
              Classical pieces and popular compositions that were previously hard to find are now available through our platform.
            </p>
            <Link to="/about">
              <Button variant="default" size="lg">Read More</Button>
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
          <h2 className="text-3xl font-bold mb-12 text-gray-900">Why Choose Us?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, idx) => (
              <Card key={idx} className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex justify-center mb-4 text-purple-600">{feature.icon}</div>
                <h3 className="text-xl font-semibold mb-2 text-gray-900">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Music Classes Section */}
      <section className="py-16 px-4 bg-white">
        <div className="container mx-auto max-w-6xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-gray-900">Music Classes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {musicClasses.map((musicClass) => (
              <Card
                key={musicClass.id}
                className={`p-8 cursor-pointer transition-all hover:shadow-lg hover:border-purple-400 ${
                  selectedClass === musicClass.id ? "border-2 border-purple-600 bg-purple-50" : ""
                }`}
                onClick={() => setSelectedClass(musicClass.id)}
              >
                <div className="flex justify-center mb-4 text-purple-600">{musicClass.icon}</div>
                <h3 className="text-2xl font-bold mb-2 text-gray-900 text-center">{musicClass.name}</h3>
                <p className="text-gray-600 mb-4 text-center">{musicClass.description}</p>
                <span className="inline-block px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium mb-4">
                  {musicClass.level}
                </span>
                <Link to="/classes">
                  <Button variant="outline" className="w-full">Learn More</Button>
                </Link>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="container mx-auto max-w-6xl text-center">
          <h2 className="text-3xl font-bold mb-12 text-gray-900">Testimonials</h2>
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
        <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Start Your Musical Journey?</h2>
        <p className="text-lg text-purple-100 mb-6">Join thousands of students learning music with Prime Music Media</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/enroll">
            <Button size="lg" variant="secondary">Enroll Now</Button>
          </Link>
          <Link to="/contact">
            <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-purple-600">Contact Us</Button>
          </Link>
        </div>
      </section>
    </div>
  );
};