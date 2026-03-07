import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { enrollmentService, registrationService } from "@/services/api";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "./ui/select";
import { Music, User, Mail, BookOpen } from "lucide-react";
import { buildLoginPath, persistPostLoginRedirect } from "@/lib/authRedirect";

const musicClasses = [
  "Piano",
  "Guitar",
  "Vocal Training",
  "Music Theory",
  "Trumpet",
  "Ensemble Performance",
];

const skillLevels = ["beginner", "intermediate", "advanced"];

export const MusicEnrollmentPage: React.FC = () => {
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    music_class: "",
    skill_level: "",
    notes: "",
  });

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      full_name: prev.full_name || appUser?.display_name || "",
      email: prev.email || appUser?.email || "",
    }));
  }, [appUser?.display_name, appUser?.email]);

  const setField = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!appUser) {
      persistPostLoginRedirect("/enroll");
      toast.info("Please sign in before submitting an enrollment request.");
      navigate(buildLoginPath({ nextPath: "/enroll" }));
      return;
    }

    setLoading(true);

    try {
      await enrollmentService.submit({
        full_name: formData.full_name.trim(),
        email: formData.email.trim(),
        music_class: formData.music_class,
        skill_level: formData.skill_level,
        notes: formData.notes.trim(),
      });

      toast.success("Enrollment submitted successfully.");
      setFormData((prev) => ({
        ...prev,
        music_class: "",
        skill_level: "",
        notes: "",
      }));
    } catch (error: any) {
      console.error("[enrollment-submit] error:", error);
      toast.error(error?.message || "Failed to submit enrollment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-12 px-4">
      <div className="container mx-auto max-w-3xl">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-4 text-purple-600">
            <Music className="w-12 h-12" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Music Class Enrollment
          </h1>
          <p className="text-gray-600">
            Enroll in professional music classes guided by experienced
            instructors
          </p>
        </div>

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle>Student Information</CardTitle>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    required
                    placeholder="Your full name"
                    className="pl-9"
                    value={formData.full_name}
                    onChange={(e) => setField("full_name", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    type="email"
                    required
                    placeholder="you@example.com"
                    className="pl-9"
                    value={formData.email}
                    onChange={(e) => setField("email", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Select Music Class</Label>
                <Select
                  value={formData.music_class}
                  onValueChange={(value) => setField("music_class", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a class" />
                  </SelectTrigger>
                  <SelectContent>
                    {musicClasses.map((cls) => (
                      <SelectItem key={cls} value={cls}>
                        {cls}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Skill Level</Label>
                <Select
                  value={formData.skill_level}
                  onValueChange={(value) => setField("skill_level", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    {skillLevels.map((level) => (
                      <SelectItem key={level} value={level}>
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Additional Notes (Optional)</Label>
                <Textarea
                  rows={4}
                  placeholder="Any special requests or goals?"
                  value={formData.notes}
                  onChange={(e) => setField("notes", e.target.value)}
                />
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={
                  loading ||
                  !formData.full_name.trim() ||
                  !formData.email.trim() ||
                  !formData.music_class ||
                  !formData.skill_level
                }
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
