import React, { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "./ui/select";
import { Music, User, Mail, BookOpen } from "lucide-react";

const musicClasses = [
  "Piano",
  "Guitar",
  "Vocal Training",
  "Music Theory",
  "Trumpet",
  "Ensemble Performance",
];

export const MusicEnrollmentPage: React.FC = () => {
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Later: save to Firestore / send email / payment
    setTimeout(() => {
      alert("Enrollment submitted successfully 🎶");
      setLoading(false);
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-12 px-4">
      <div className="container mx-auto max-w-3xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex justify-center mb-4 text-purple-600">
            <Music className="w-12 h-12" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Music Class Enrollment
          </h1>
          <p className="text-gray-600">
            Enroll in professional music classes guided by experienced instructors
          </p>
        </div>

        {/* Enrollment Form */}
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle>Student Information</CardTitle>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Full Name */}
              <div className="space-y-2">
                <Label>Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    required
                    placeholder="Your full name"
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label>Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    type="email"
                    required
                    placeholder="you@example.com"
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Class Selection */}
              <div className="space-y-2">
                <Label>Select Music Class</Label>
                <Select required>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a class" />
                  </SelectTrigger>
                  <SelectContent>
                    {musicClasses.map(cls => (
                      <SelectItem key={cls} value={cls}>
                        {cls}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Skill Level */}
              <div className="space-y-2">
                <Label>Skill Level</Label>
                <Select required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Additional Notes (Optional)</Label>
                <textarea
                  className="w-full rounded-md border border-gray-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows={4}
                  placeholder="Any special requests or goals?"
                />
              </div>

              {/* Submit */}
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={loading}
              >
                <BookOpen className="mr-2 h-5 w-5" />
                {loading ? "Submitting..." : "Enroll Now"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};