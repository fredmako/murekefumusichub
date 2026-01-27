import React, { useState } from "react"; import { Button } from './ui/button'; import { Card } from './ui/card'; import { Music, Keyboard, Guitar, Mic, Wind, Users, BookOpen, Award, Star, Menu, X, } from "lucide-react";

// Full updated landing page for Prime Music Media // - Includes Navbar with active links // - About section (full copy provided) // - Music Classes // - Features / Facts // - Testimonials (full copy provided) // - Team and Footer // Replace Button and Card imports with your own UI components if needed.

interface MusicClass { id: string; name: string; description: string; icon: React.ReactNode; level: string; }

export default function LandingPage(): JSX.Element { const [selectedClass, setSelectedClass] = useState<string | null>(null); const [mobileOpen, setMobileOpen] = useState(false);

const musicClasses: MusicClass[] = [ { id: "piano", name: "Piano", description: "Want to learn to play piano? Our Piano Lessons are open to everyone.", icon: <Keyboard className="w-12 h-12" />, level: "Beginner to Advanced", }, { id: "guitar", name: "Guitar", description: "Learn to play the world's popular instrument with our guitar classes.", icon: <Guitar className="w-12 h-12" />, level: "Beginner to Advanced", }, { id: "vocal", name: "Vocal", description: "Prime Music Media offers a wide variety of vocal classes for all ages and skills.", icon: <Mic className="w-12 h-12" />, level: "All Levels", }, { id: "trumpet", name: "Trumpet", description: "We offer an extensive trumpet learning program at our music school.", icon: <Wind className="w-12 h-12" />, level: "Beginner to Advanced", }, { id: "music-theory", name: "Music Theory", description: "Master the fundamentals of music theory and composition.", icon: <BookOpen className="w-12 h-12" />, level: "All Levels", }, { id: "ensemble", name: "Ensemble", description: "Join our ensemble classes and perform with fellow musicians.", icon: <Users className="w-12 h-12" />, level: "Intermediate to Advanced", }, ];

const features = [ { title: "Expert Instructors", description: "Learn from experienced music professionals", icon: <Award className="w-8 h-8" />, }, { title: "Flexible Scheduling", description: "Classes available at times that work for you", icon: <Music className="w-8 h-8" />, }, { title: "All Skill Levels", description: "From complete beginners to advanced musicians", icon: <BookOpen className="w-8 h-8" />, }, { title: "Certified Courses", description: "Get recognized certificates after completing selected courses", icon: <Star className="w-8 h-8" />, }, { title: "Music Library", description: "Access to classical, modern and customized compositions", icon: <BookOpen className="w-8 h-8" />, }, { title: "Online & Offline Classes", description: "Learn music in-person or from the comfort of your home", icon: <Users className="w-8 h-8" />, }, ];

// helper to navigate (in-app router or hard links depending on your setup) function goTo(href: string) { // If you're using React Router, replace this with <Link /> or useHistory push if (href.startsWith("#")) { const el = document.getElementById(href.replace('#','')); if (el) el.scrollIntoView({ behavior: 'smooth' }); return; } window.location.href = href; }

return ( <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-gray-800"> {/* NAVBAR */} <header className="bg-white shadow sticky top-0 z-50"> <div className="container mx-auto max-w-6xl flex items-center justify-between p-4"> <div className="flex items-center gap-3"> <div className="text-2xl font-bold text-purple-600">PRIME MUSIC MEDIA</div> <div className="hidden sm:block text-sm text-gray-500">© 2026</div> </div>

<nav className="hidden md:flex items-center gap-6">
        <a className="hover:text-purple-600 cursor-pointer" onClick={() => goTo('#home')}>Home</a>
        <a className="hover:text-purple-600 cursor-pointer" onClick={() => goTo('#about')}>About</a>
        <a className="hover:text-purple-600 cursor-pointer" onClick={() => goTo('#classes')}>Music Classes</a>
        <a className="hover:text-purple-600 cursor-pointer" onClick={() => goTo('#features')}>Features</a>
        <a className="hover:text-purple-600 cursor-pointer" onClick={() => goTo('#testimonials')}>Testimonials</a>
        <a className="hover:text-purple-600 cursor-pointer" onClick={() => goTo('/contact')}>Contact</a>
      </nav>

      <div className="hidden md:flex items-center gap-3">
        <Button size="sm" variant="ghost" onClick={() => goTo('/login')}>Login</Button>
        <Button size="sm" variant="secondary" onClick={() => goTo('/register')}>Register</Button>
      </div>

      {/* mobile menu toggle */}
      <button
        className="md:hidden p-2 rounded-md"
        aria-label="Toggle menu"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>
    </div>

    {/* mobile menu panel */}
    {mobileOpen && (
      <div className="md:hidden border-t bg-white">
        <div className="flex flex-col p-4 gap-2">
          <a onClick={() => { goTo('#home'); setMobileOpen(false); }} className="py-2">Home</a>
          <a onClick={() => { goTo('#about'); setMobileOpen(false); }} className="py-2">About</a>
          <a onClick={() => { goTo('#classes'); setMobileOpen(false); }} className="py-2">Music Classes</a>
          <a onClick={() => { goTo('#features'); setMobileOpen(false); }} className="py-2">Features</a>
          <a onClick={() => { goTo('#testimonials'); setMobileOpen(false); }} className="py-2">Testimonials</a>
          <a onClick={() => { goTo('/login'); setMobileOpen(false); }} className="py-2">Login</a>
          <a onClick={() => { goTo('/contact'); setMobileOpen(false); }} className="py-2">Contact</a>
        </div>
      </div>
    )}
  </header>

  {/* HERO */}
  <section id="home" className="relative bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-20 px-4">
    <div className="container mx-auto max-w-6xl text-center space-y-6">
      <h1 className="text-4xl md:text-6xl font-extrabold leading-tight">Music <span className="italic">for</span> Everyone</h1>
      <p className="text-lg md:text-2xl text-purple-100 max-w-3xl mx-auto">Discover your inner talents and pick your instrument. We make music accessible to choirs, schools, and individuals.</p>
      <div className="flex items-center justify-center gap-4">
        <Button size="lg" variant="secondary" onClick={() => goTo('/register')}>Join Us Today</Button>
        <Button size="lg" variant="outline" onClick={() => goTo('#about')}>Learn More</Button>
      </div>
    </div>
  </section>

  {/* ABOUT (full text from site) */}
  <section id="about" className="py-16 px-4 bg-white">
    <div className="container mx-auto max-w-6xl grid md:grid-cols-2 gap-12 items-start">
      <div>
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Welcome to Prime Music Media!</h2>
        <p className="text-gray-600 mb-4 leading-relaxed">
          We are a company that endeavors to create music accessibility for anyone anywhere. We register composers, arrangers and music trainers and make their works available to anyone out there seeking to access it.
        </p>

        <p className="text-gray-600 mb-4 leading-relaxed">
          Music desired by anyone that did seem unavailable for any music trainer or music enthusiast for their groups to sing is now available on our side. Even the classical pieces from the re-known composers like Mozart are now available as we are in contact with their publishers.
        </p>

        <p className="text-gray-600 mb-4 leading-relaxed">
          Prime music media is a music company that was formed in August 2018. This was during the Kenya music festival season finale at Nyeri. Due to a research we did by taking the choir trainers located on different parts of the country who came to be united at the event, we realized that all aligned to the fact that they strain to access music scores of several music compositions and arrangements for music composers from the country and international ones. These are pieces they wish to sing with their choirs but due to the pieces being inaccessible they resolve to other pieces which are accessible which definitely maligns the potential of the group.
        </p>

        <p className="text-gray-600 mb-4 leading-relaxed">
          It is from this circumstances and experiences that prompted the formation of prime music media to ease the accessibility of the pieces. Some groups have good singers and songs at hand but are unable to access trainers, on the registered trainers with us who are available we link them up to the available groups so that we can empower both the groups and the trainer. We offer training in music theory, instruments, music composition, music arrangement and voice training. In all the areas aforementioned we have experts in the areas who are readily available for the classes once one enrolls with us.
        </p>

        <div className="flex gap-3 mt-6">
          <Button variant="default" onClick={() => goTo('/about')}>About Us</Button>
          <Button variant="outline" onClick={() => goTo('/contact')}>Contact</Button>
        </div>
      </div>

      <div className="rounded-lg overflow-hidden bg-gradient-to-br from-purple-50 to-indigo-50 p-8 shadow">
        <div className="text-center mb-6">
          <Music className="w-24 h-24 text-purple-400 mx-auto opacity-30" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Our Focus</h3>
        <p className="text-gray-600 mb-4">Make music scores, trainers and arrangements accessible for choirs, schools and communities.</p>

        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="bg-white rounded p-4 shadow-sm text-center">
            <div className="text-sm text-gray-500">Founded</div>
            <div className="font-bold text-lg">August 2018</div>
          </div>
          <div className="bg-white rounded p-4 shadow-sm text-center">
            <div className="text-sm text-gray-500">Based</div>
            <div className="font-bold text-lg">Kenya</div>
          </div>

          <div className="bg-white rounded p-4 shadow-sm text-center">
            <div className="text-sm text-gray-500">Qualified Teachers</div>
            <div className="font-bold text-lg">20+</div>
          </div>
          <div className="bg-white rounded p-4 shadow-sm text-center">
            <div className="text-sm text-gray-500">Choirs Trained</div>
            <div className="font-bold text-lg">100+</div>
          </div>
        </div>
      </div>
    </div>
  </section>

  {/* FEATURES / FACTS */}
  <section id="features" className="py-16 px-4 bg-gray-50">
    <div className="container mx-auto max-w-6xl">
      <h2 className="text-3xl font-bold text-center mb-8">Why Choose Prime Music Media?</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {features.map((f, i) => (
          <Card key={i} className="p-6 text-center hover:shadow-lg transition-shadow">
            <div className="flex justify-center mb-4 text-purple-600">{f.icon}</div>
            <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
            <p className="text-sm text-gray-600">{f.description}</p>
          </Card>
        ))}
      </div>
    </div>
  </section>

  {/* MUSIC CLASSES */}
  <section id="classes" className="py-16 px-4 bg-white">
    <div className="container mx-auto max-w-6xl">
      <h2 className="text-3xl md:text-4xl font-bold text-center mb-8">Music Classes</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {musicClasses.map((c) => (
          <Card
            key={c.id}
            className={`p-8 cursor-pointer transition-all hover:shadow-lg ${selectedClass === c.id ? 'border-2 border-purple-600 bg-purple-50' : ''}`}
            onClick={() => setSelectedClass(c.id)}
          >
            <div className="flex justify-center mb-4 text-purple-600">{c.icon}</div>
            <h3 className="text-2xl font-bold text-center mb-2">{c.name}</h3>
            <p className="text-gray-600 text-center mb-4">{c.description}</p>
            <div className="flex justify-center mb-4">
              <span className="inline-block px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">{c.level}</span>
            </div>
            <Button variant="outline" className="w-full" onClick={(e) => e.stopPropagation()}>Learn More</Button>
          </Card>
        ))}
      </div>
    </div>
  </section>

  {/* TESTIMONIALS */}
  <section id="testimonials" className="py-16 px-4 bg-gray-50">
    <div className="container mx-auto max-w-6xl text-center">
      <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">What Our Students Say</h2>
      <p className="text-gray-600 mb-8">Real stories from our students, parents and choir groups.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* 1 */}
        <Card className="p-6">
          <p className="text-gray-700 italic">"We came together as Parents in Kianda school to sing together in support of our daughters. Most of us were passionate about singing without experience or training! On the first day, I could read Sam’s mind wondering what he had gotten himself into! He started from identifying who fit into which voice group and patiently training us as individuals and groups. With his determination and great teaching/coaching skills, we were able to perform during Easter and Christmas cantatas. The joy in our girls’ faces said it all. They were really proud of our beautiful singing. Memories were created that will last a lifetime."</p>
          <p className="mt-4 font-semibold">~ Ann, Kianda Sch Parents Choir 2023 & 2024</p>
        </Card>

        {/* 2 */}
        <Card className="p-6">
          <p className="text-gray-700 italic">"My passion for choral music was ignited when I had the privilege of being trained by the incredible Murekefu Sam. It all began at The Nairobi School, where I discovered a singer within me I never knew existed. With him at the helm, participation at the national level wasn't just a possibility – it was a guarantee. Murekefu is someone I truly look up to in the world of music, crafting melodies that leave you wanting more. Five years under his tutelage was a transformative experience I'd highly recommend to any aspiring choral artist."</p>
          <p className="mt-4 font-semibold">~ Oduor Benedict, Nairobi school 2020 - 2023 & Jkuat Choir 2025</p>
        </Card>

        {/* 3 */}
        <Card className="p-6">
          <p className="text-gray-700 italic">"Working with Sam Murekefu has been one of the best pleasures I have enjoyed in my adult life. He has been such an amazing music trainer, director, composer and friend. Before I met Sam, I was the \"singing in the shower kinda girl\" because I didn't know how to balance, warm, and sing from the stomach and he helped me with that. The negative for me was that I never really got the chance to work with him longer but I get to call him a friend and that's good enough. Also, if you don't learn him well you might think he's always angry when he isn't, he's just concentrating on the music."</p>
          <p className="mt-4 font-semibold">~ Naserian, MKU Main campus Choir 2022 & 2023</p>
        </Card>

        {/* 4 */}
        <Card className="p-6">
          <p className="text-gray-700 italic">"Mr. Sam Murekefu elevated our school choir to new heights with his expertise and passion for music. He demands excellence and pushes you to be your best - it's tough, but it works. It was his first time working with the JKUAT choir and his commitment to our growth and perfection pushed us to doing and being more. Literally took us out of our comfort zone. Though I didn't get to work with him one-on-one, I've seen how he brings out the best in our choir. He placed us on the map, musically speaking! Would love to learn from him more in the future."</p>
          <p className="mt-4 font-semibold">~ Miriam Seka, JKUAT Choir 2025</p>
        </Card>

        {/* 5 */}
        <Card className="p-6">
          <p className="text-gray-700 italic">"Murekefu Sam, thank you for your incredible dedication to Maziwa Methodist Choir in the year 2018 all through covid season. You took a group of passionate but untrained singers and, through individual voice coaching, discipline, and strict time keeping, turned us into a confident and effective choir. You helped Maziwa Methodist Choir grow from raw passion into a structured and confident choir through individual coaching and strong emphasis on time keeping. All the best!"</p>
          <p className="mt-4 font-semibold">~ Lilian, Maziwa Methodist Church 2018-2019</p>
        </Card>

        {/* 6 placeholder - encourage more testimonials */}
        <Card className="p-6 flex flex-col justify-between">
          <div>
            <p className="text-gray-700 italic">Have a story with Prime Music Media? We'd love to hear from you — share your testimonial and help other choirs find the right trainer.</p>
          </div>
          <div className="mt-4">
            <Button variant="default" onClick={() => goTo('/testimonials')}>Share Your Story</Button>
          </div>
        </Card>
      </div>

      <div className="mt-8">
        <Button variant="outline" onClick={() => goTo('/testimonials')}>View All Testimonials →</Button>
      </div>
    </div>
  </section>

  {/* TEAM */}
  <section className="py-12 px-4 bg-white">
    <div className="container mx-auto max-w-6xl text-center">
      <h3 className="text-2xl font-bold mb-6">Our Team</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="p-6 bg-gray-50 rounded shadow-sm">
          <div className="text-xl font-semibold">Samuel Murekefu</div>
          <div className="text-sm text-gray-500">C.E.O & Founder</div>
        </div>

        <div className="p-6 bg-gray-50 rounded shadow-sm">
          <div className="text-xl font-semibold">Eng. Alphonce O.</div>
          <div className="text-sm text-gray-500">Technical Lead</div>
        </div>

        <div className="p-6 bg-gray-50 rounded shadow-sm">
          <div className="text-xl font-semibold">John Thompson</div>
          <div className="text-sm text-gray-500">DJ Classes Teacher</div>
        </div>
      </div>
    </div>
  </section>

  {/* CTA */}
  <section className="py-12 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
    <div className="container mx-auto max-w-4xl text-center">
      <h3 className="text-2xl font-bold mb-4">Ready to Start Your Musical Journey?</h3>
      <p className="mb-6 text-purple-100">Join choirs and students across Kenya who are already learning with Prime Music Media.</p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Button size="lg" variant="secondary" onClick={() => goTo('/register')}>Enroll Now</Button>
        <Button size="lg" variant="outline" onClick={() => goTo('/contact')}>Contact Us</Button>
      </div>
    </div>
  </section>

  {/* FOOTER */}
  <footer className="bg-white border-t mt-12">
    <div className="container mx-auto max-w-6xl py-8 px-4">
      <div className="flex flex-col md:flex-row justify-between items-start gap-6">
        <div>
          <div className="font-bold text-lg">PRIME MUSIC MEDIA</div>
          <div className="text-sm text-gray-600 mt-2">Prime music media is a music company that makes scores and trainers available for choirs, schools and communities.</div>
        </div>

        <div className="flex gap-6">
          <a className="text-sm hover:text-purple-600 cursor-pointer" onClick={() => goTo('/terms')}>Terms of Use</a>
          <a className="text-sm hover:text-purple-600 cursor-pointer" onClick={() => goTo('/privacy')}>Privacy Policy</a>
        </div>
      </div>

      <div className="text-sm text-gray-500 mt-6">PRIME MUSIC MEDIA © 2026 All Rights Reserved.</div>
    </div>
  </footer>
</div>

); }