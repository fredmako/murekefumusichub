import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";

export function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-3xl font-bold">Privacy Policy</CardTitle>
            <p className="text-sm text-gray-500">
              Last Updated: {new Date().toLocaleDateString()}
            </p>
          </CardHeader>

          <CardContent className="space-y-6 text-gray-700 leading-relaxed">
            <section>
              <h2 className="text-xl font-semibold mb-2">1. Introduction</h2>
              <p>
                Welcome to Murekefu Music Hub. We value your privacy and are
                committed to protecting your personal information. This Privacy
                Policy explains how we collect, use, and safeguard your data
                when you use our platform.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">
                2. Information We Collect
              </h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Email address and authentication details.</li>
                <li>User role (Buyer, Composer, Admin).</li>
                <li>Purchase and transaction history.</li>
                <li>Uploaded compositions (for composers).</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">
                3. How We Use Your Information
              </h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>To create and manage your account.</li>
                <li>
                  To process purchases and provide access to compositions.
                </li>
                <li>To improve our services and user experience.</li>
                <li>To communicate important updates.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">4. Data Security</h2>
              <p>
                We use secure technologies including Firebase Authentication and
                encrypted connections to protect your data from unauthorized
                access or misuse.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">
                5. Sharing of Information
              </h2>
              <p>
                We do not sell or rent your personal information. Data may be
                shared only with trusted service providers necessary for
                operating the platform.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">6. Your Rights</h2>
              <p>
                You have the right to access, update, or request deletion of
                your account information. Please contact us for assistance.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">
                7. Changes to This Policy
              </h2>
              <p>
                We may update this Privacy Policy from time to time. Changes
                will be posted on this page with an updated revision date.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">8. Contact Us</h2>
              <p>
                If you have questions about this Privacy Policy, please contact
                us at support@murekefumusic.com.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
