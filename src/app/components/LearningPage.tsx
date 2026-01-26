import React, { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import {
  Music,
  Keyboard,
  Guitar,
  Mic,
  Trumpet,
  Users,
  BookOpen,
  Award,
} from "lucide-react";

interface MusicClass {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  level: string;
}

export const LearningPage: React.FC = () => {
  const [selectedClass, setSelectedClass] = useState<string | null>(null);

  const musicClasses: MusicClass[] = [
    {
      id: "piano",
      name: "Piano",
      description:
        "Want to learn to play piano? Our Piano Lessons are open to everyone.",
      icon: <Keyboard className="w-12 h-12" />,
      level: "Beginner to Advanced",
    },
    {
      id: "guitar",
      name: "Guitar",
      description:
        "Learn to play the world's popular instrument with our guitar classes.",
      icon: <Guitar className="w-12 h-12" />,
      level: "Beginner to Advanced",
    },
    {
      id: "vocal",
      name: "Vocal",
      description:
        "Prime Music Media offers a wide variety of vocal classes for all ages and skills.",
      icon: <Mic className="w-12 h-12" />,
      level: "All Levels",
    },
    {
      id: "trumpet",
      name: "Trumpet",
      description:
        "We offer extensive trumpet learning program at our music school.",
      icon: <Trumpet className="w-12 h-12" />,
      level: "Beginner to Advanced",
    },
    {
      id: "music-theory",
      name: "Music Theory",
      description:
        "Master the fundamentals of music theory and composition.",
      icon: <BookOpen className="w-12 h-12" />,
      level: "All Levels",
    },
    {
      id: "ensemble",
      name: "Ensemble",
      description:
        "Join our ensemble classes and perform with fellow musicians.",
      icon: <Users className="w-12 h-12" />,
      level: "Intermediate to Advanced",
    },
  ];

  const features = [
    {
      title: "Expert Instructors",
      description: "Learn from experienced music professionals",
      icon: <Award className="w-8 h-8" />,
    },
    {
      title: "Flexible Scheduling",
      description: "Classes available at times that work for you",
      icon: <Music className="w-8 h-8" />,
    },
    {
      title: "All Skill Levels",
      description: "From complete beginners to advanced musicians",
      icon: <BookOpen className="w-8 h-8" />,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero Slider */}
      <section className="relative bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="space-y-6 text-center">
            <h1 className="text-5xl md:text-6xl font-bold">
              Music <span className="italic">for</span> Everyone
            </h1>
            <p className="text-xl md:text-2xl text-purple-100">
              Discover your inner talents and pick your instrument
            </p>
            <Button size="lg" variant="secondary" className="text-lg">
              Join Us Today
            </Button>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-16 px-4 bg-white">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
                Welcome to Prime Music Media!
              </h2>
              <p className="text-gray-600 leading-relaxed">
                We are a company that endeavors to create music accessibility for
                anyone anywhere. We register composers, arrangers and music
                trainers and make their works available to anyone out there seeking
                to access it.
              </p>
              <p className="text-gray-600 leading-relaxed">
                Music desired by anyone that did seem unavailable for any music
                trainer or music enthusiast for their groups to sing is now
                available on our side. Even the classical pieces from the renowned
                composers like Mozart are now available as we are in contact with
                their publishers.
              </p>
              <Button variant="default" size="lg">
                Read More
              </Button>
            </div>
            <div className="relative h-96 bg-gradient-to-br from-purple-200 to-indigo-200 rounded-lg overflow-hidden shadow-lg">
              <div className="absolute inset-0 flex items-center justify-center">
                <Music className="w-32 h-32 text-purple-400 opacity-20" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-900">
            Why Choose Prime Music Media?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, idx) => (
              <Card key={idx} className="p-6 text-center hover:shadow-lg transition-shadow">
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
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 text-gray-900">
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
                <div className="flex items-center justify-center gap-2 mb-4">
                  <span className="inline-block px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                    {musicClass.level}
                  </span>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  Learn More
                </Button>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 bg-gradient-to-r from-purple-600 to-indigo-600">
        <div className="container mx-auto max-w-4xl text-center text-white space-y-6">
          <h2 className="text-3xl md:text-4xl font-bold">
            Ready to Start Your Musical Journey?
          </h2>
          <p className="text-lg text-purple-100">
            Join thousands of students learning music with Prime Music Media
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="secondary">
              Enroll Now
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white text-white hover:bg-white hover:text-purple-600"
            >
              Contact Us
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};
