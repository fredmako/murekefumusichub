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
import { Link, useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";

interface MusicClass {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  level: string;
}

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  const [selectedClass, setSelectedClass] = useState<string | null>(null);

  // ✅ Privacy Modal (Shows only once)
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(
    !localStorage.getItem("privacyAccepted"),
  );

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
      {/* ================= Privacy Modal ================= */}
      <Dialog open={isPrivacyOpen} onOpenChange={setIsPrivacyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Privacy Policy Notice</DialogTitle>
            <DialogDescription>
              We value your privacy. Please review our Privacy Policy to
              understand how we collect and use your information.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => navigate("/privacy-policy")}
            >
              View Privacy Policy
            </Button>
            <Button onClick={handleAcceptPrivacy}>Accept & Continue</Button>
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
    </div>
  );
};
