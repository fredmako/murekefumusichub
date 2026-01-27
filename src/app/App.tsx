import React from "react";
import { Card } from "./ui/card";
import { Music, Users, Award } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-16 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            About Prime Music Media
          </h1>
          <p className="text-purple-100 text-lg">
            Empowering choirs, composers, and music trainers across Kenya and beyond
          </p>
        </div>
      </section>

      {/* About Content */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto space-y-6 text-gray-700 leading-relaxed">
          <p>
            Prime Music Media is a music company formed in <strong>August 2018</strong> during
            the Kenya Music Festival season finale held in Nyeri.
          </p>

          <p>
            Through research conducted with choir trainers from different parts of the
            country, we discovered a common challenge: difficulty accessing quality music
            scores for both local and international compositions.
          </p>

          <p>
            Due to this limitation, many choirs are forced to perform easily accessible
            pieces, limiting their artistic growth and potential.
          </p>

          <p>
            Prime Music Media was founded to bridge this gap by making music compositions,
            arrangements, and trainers easily accessible to choirs and learners.
          </p>

          <p>
            We also connect registered trainers with choirs and groups that require
            professional guidance, empowering both trainers and performers.
          </p>

          <p>
            Our training programs include:
          </p>

          <ul className="list-disc pl-6">
            <li>Music Theory</li>
            <li>Instrument Training</li>
            <li>Music Composition</li>
            <li>Music Arrangement</li>
            <li>Voice Training</li>
          </ul>
        </div>
      </section>

      {/* Team */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-12">Our Team</h2>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-6">
              <Music className="mx-auto mb-4 text-purple-600" size={40} />
              <h3 className="font-bold text-lg">Samuel Murekefu</h3>
              <p className="text-gray-600">CEO & Founder</p>
            </Card>

            <Card className="p-6">
              <Award className="mx-auto mb-4 text-purple-600" size={40} />
              <h3 className="font-bold text-lg">Eng. Alphonce O.</h3>
              <p className="text-gray-600">Technical Lead</p>
            </Card>

            <Card className="p-6">
              <Users className="mx-auto mb-4 text-purple-600" size={40} />
              <h3 className="font-bold text-lg">John Thompson</h3>
              <p className="text-gray-600">DJ Classes Teacher</p>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}