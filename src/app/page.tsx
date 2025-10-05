import Section from "@/components/Section";
import Button from "@/components/Button";
import Card from "@/components/Card";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <section className="text-center py-20 rounded-2xl shadow-sm bg-gradient-to-r from-indigo-600 to-blue-600 text-white">
        <h1 className="text-5xl font-extrabold tracking-tight">
          🗳️ The Will of The People
        </h1>
        <p className="mt-4 text-lg max-w-2xl mx-auto text-indigo-100">
          A democratic experiment — identify issues, debate approaches, 
          and vote on actionable plans.
        </p>
        <div className="mt-8 flex justify-center space-x-4">
          <Link href="/dashboard">
            <Button variant="primary" size="lg">Explore Dashboard</Button>
          </Link>
          <Link href="/auth">
            <Button variant="accent" size="lg">Register / Sign In</Button>
          </Link>
        </div>
      </section>

      {/* Our Mission */}
      <Section id="mission" title="🌍 Our Mission" align="center">
        <p className="text-gray-700 leading-relaxed max-w-2xl mx-auto">
          We believe in giving citizens a direct and informed voice on the 
          critical issues of our time. Through transparent, staged voting, 
          participants collaboratively shape the issues, approaches, and 
          plans to create a future driven by collective wisdom.
        </p>
      </Section>

      {/* How We're Funded */}
      <Section id="funding" title="💰 How We're Funded">
        <Card interactive={false}>
          <p className="text-gray-700 leading-relaxed">
            Our platform is sustained by community contributions. 
            We do not accept funding from political parties, corporations,
            or governments — ensuring our independence and impartiality.
          </p>
        </Card>
      </Section>

      {/* How Voting Works */}
      <Section id="how" title="🗳️ How Does Voting Work?">
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <h3 className="font-semibold text-lg mb-2 text-gray-900">Stage 1</h3>
            <p className="text-gray-700">Identify and select pressing issues.</p>
          </Card>
          <Card>
            <h3 className="font-semibold text-lg mb-2 text-gray-900">Stage 2</h3>
            <p className="text-gray-700">Compare approaches and methods of addressing them.</p>
          </Card>
          <Card>
            <h3 className="font-semibold text-lg mb-2 text-gray-900">Stage 3</h3>
            <p className="text-gray-700">Vote on actionable plans of action to implement.</p>
          </Card>
        </div>
        <p className="mt-6 text-gray-600 text-sm">
          ✅ At each stage, you’ll answer basic knowledge questions to ensure informed voting.
        </p>
      </Section>

      {/* Register / Sign In */}
      <Section id="auth" title="👤 Register / Sign In" align="center">
        <p className="text-gray-700 mb-6">
          Ready to participate? Create your free account and join the conversation.
        </p>
        <Link href="/auth">
          <Button variant="primary" size="lg">Get Started</Button>
        </Link>
      </Section>

      {/* Voting Results */}
      <Section id="results" title="📊 Voting Results" align="center">
        <p className="text-gray-700 mb-6">
          Explore past and present collective decisions shaped by our users.
        </p>
        <Link href="/results">
          <Button variant="secondary" size="md">View Results</Button>
        </Link>
      </Section>
    </div>
  );
}