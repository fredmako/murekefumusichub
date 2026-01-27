// src/app/components/AboutPage.tsx
import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/app/components/ui/button";

export const AboutPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-purple-700 text-white py-16 px-4 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          About Prime Music Media
        </h1>
        <p className="max-w-3xl mx-auto text-lg text-purple-100">
          Making music accessible, empowering talent, and connecting choirs,
          composers, and trainers.
        </p>
      </section>

      {/* About Content */}
      <section className="max-w-5xl mx-auto px-4 py-12">
        <div className="bg-white rounded-lg shadow-md p-8 mb-12">
          <h2 className="text-3xl font-semibold text-gray-900 mb-4">
            About Us
          </h2>

          <p className="text-gray-700 leading-relaxed mb-4">
            Prime Music Media is a music company that was formed in August 2018
            during the Kenya Music Festival season finale held in Nyeri. Through
            research conducted by engaging choir trainers from different parts
            of the country who had gathered for the event, we discovered a
            common challenge.
          </p>

          <p className="text-gray-700 leading-relaxed mb-4">
            Many choir trainers struggled to access quality music scores for
            various compositions and arrangements, both from local and
            international composers. These are pieces they aspire to perform
            with their choirs, but due to inaccessibility, they are often forced
            to settle for readily available alternatives. This ultimately limits
            the artistic potential of the groups.
          </p>

          <p className="text-gray-700 leading-relaxed mb-4">
            These circumstances and experiences prompted the formation of Prime
            Music Media — to ease accessibility to quality music compositions
            and arrangements. We also recognized that while some groups have
            strong singers and songs, they lack access to professional trainers.
          </p>

          <p className="text-gray-700 leading-relaxed">
            Through our registered trainers, we connect available trainers to
            choirs and groups in need, empowering both the trainers and the
            groups. We offer training in music theory, instruments, music
            composition, music arrangement, and voice training. In all these
            areas, we have qualified experts who are readily available once one
            enrolls with us.
          </p>
        </div>

        {/* Team Section */}
        <div className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-3xl font-semibold text-gray-900 mb-8 text-center">
            Our Team
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">
                Samuel Murekefu
              </h3>
              <p className="text-gray-600">C.E.O & Founder</p>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-gray-900">
                Eng. Alphonce O.
              </h3>
              <p className="text-gray-600">Technical Lead</p>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-gray-900">
                John Thompson
              </h3>
              <p className="text-gray-600">DJ Classes Teacher</p>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="text-center mt-12">
          <Link to="/">
            <Button size="lg">Back to Home</Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-6 text-center text-sm">
        <p>© 2026 Prime Music Media. All Rights Reserved.</p>
        <p className="mt-1">Terms of Use & Privacy Policy</p>
      </footer>
    </div>
  );
};