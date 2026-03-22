import { Link } from "react-router-dom";
import { ArrowLeft, Database, FileText, Lock, ShieldCheck } from "lucide-react";

const MOBILE_COMPANY_NAME = "Sri Murugan Supermarket";
const SUPPORT_EMAIL = "jprsupermarket@gmail.com";
const MOBILE_CONTACT_PHONE = "9445750954";
const MOBILE_CONTACT_ADDRESS =
  "Sothupakkam 47, Cheyur - Vandavasi Rd, Melmaruvathur, Tamil Nadu 603319";
const EFFECTIVE_DATE = "March 22, 2026";

const policySections = [
  {
    title: "Information we collect",
    icon: Database,
    content: [
      "Account details such as your name, email address, password, phone number, and optional address details when you create or manage a user account.",
      "Store operation data you enter while using the platform, including stores, items, categories, subcategories, suppliers, purchase orders, bills, customer credit records, and related reporting data.",
      "Support and security information such as login activity, password reset requests, OTP verification details, and messages you send to our support team.",
    ],
  },
  {
    title: "How we use your information",
    icon: FileText,
    content: [
      "To authenticate users, manage accounts, and let authorized team members access supermarket operations securely.",
      "To run features used in this application, including inventory tracking, supplier management, billing, reporting, credit handling, and order management.",
      "To maintain service reliability, troubleshoot issues, improve the product experience, and respond to support or compliance requests.",
    ],
  },
  {
    title: "Authentication, cookies, and local storage",
    icon: Lock,
    content: [
      "This application stores an authentication token in your browser local storage to keep you signed in between page refreshes.",
      "The app also sends authenticated requests to the backend with standard browser credentials where required for secure session-related operations.",
      "You can clear locally stored sign-in information by logging out or clearing your browser storage.",
    ],
  },
  {
    title: "Data sharing and protection",
    icon: ShieldCheck,
    content: [
      "We may share limited data with trusted third-party services only when necessary to operate the application. This may include Razorpay for payment processing, hosting providers for infrastructure and service delivery, and analytics services if they are enabled for product improvement or operational monitoring.",
      "These service providers may access only the information needed to perform their specific function and are expected to handle that information securely.",
      "We use reasonable technical and organizational measures to protect account credentials and operational records, but no internet-based system can be guaranteed to be 100% secure.",
      "You are responsible for keeping your login credentials confidential and for using strong passwords for authorized user accounts.",
    ],
  },
  {
    title: "Children's privacy",
    icon: ShieldCheck,
    content: [
      "This application is not intended for children under the age of 13.",
      "We do not knowingly collect personal information from children. If you believe a child has provided personal information through the app, please contact us so that we can review and take appropriate action.",
    ],
  },
];

const mobileAppSections = [
  {
    title: "Mobile app privacy coverage",
    body: `${MOBILE_COMPANY_NAME} provides its mobile application to let customers browse products, create an account, place orders, complete payments, and manage deliveries or returns.`,
  },
  {
    title: "Mobile app data collection",
    body:
      "Depending on how the mobile app is used, it may collect your name, email address, phone number, delivery address, account credentials, order history, return-related details, and images you choose to upload. Limited account, cart, and order information may also be stored on your device to keep you signed in and improve app performance.",
  },
  {
    title: "Mobile app payments and permissions",
    body:
      "If you make a payment through the mobile app, payment processing may be handled by providers such as Razorpay or other supported processors. The app does not store full card numbers, UPI PINs, or complete banking credentials. The mobile app uses internet access to connect to backend services and may request photo or media access only when you choose to upload an image, such as during a return workflow. Based on the current implementation, it does not describe use of background location, contacts, microphone, or call log permissions.",
  },
  {
    title: "Mobile app retention and user rights",
    body: `Mobile app information is kept only as long as reasonably necessary to provide services, maintain records, resolve disputes, enforce agreements, and comply with legal obligations. Some information may remain on a user's device until they sign out, clear app data, or uninstall the app. Users may request access, correction, or deletion of their personal data by contacting ${MOBILE_COMPANY_NAME}, subject to legal, payment, fraud-prevention, tax, and record-keeping requirements.`,
  },
];

export default function PrivacyPolicy() {
  const currentYear = new Date().getFullYear();

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="bg-red-600 min-h-14 sm:h-16 flex items-center justify-between gap-2 px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <img
            src="/favicon.ico"
            alt="Murugan Super Mart logo"
            className="h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 flex-shrink-0 object-contain"
          />
          <div className="flex items-baseline gap-1 sm:gap-2 min-w-0">
            <span className="text-white text-lg font-bold truncate sm:text-xl md:text-2xl">Murugan</span>
            <span className="text-yellow-300 text-base sm:text-lg md:text-xl flex-shrink-0">Super Mart</span>
          </div>
        </div>
        <img
          src="/pushdiggylogo.jpg"
          alt="Pushdiggy"
          className="h-8 w-auto max-h-12 object-contain sm:h-10 md:h-12 lg:h-14"
        />
      </header>

      <main className="flex-1 px-4 py-8 sm:px-6 md:px-8 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-red-600 transition-colors hover:text-red-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to login
          </Link>

          <div className="mt-4 rounded-3xl border border-gray-200 bg-white p-6 shadow-xl sm:p-8 md:p-10">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-red-600">
                Privacy Policy
              </p>
              <h1 className="mt-3 text-3xl font-bold text-gray-900 sm:text-4xl">
                Your supermarket data deserves clear handling
              </h1>
              <p className="mt-3 text-sm font-medium text-gray-500 sm:text-base">
                Effective Date: {EFFECTIVE_DATE}
              </p>
              <p className="mt-4 text-sm leading-7 text-gray-600 sm:text-base">
                This Privacy Policy explains how Murugan Super Mart uses this Super Market
                management application to collect, store, and process personal and business
                information entered by authorized users. It applies to the login, account,
                inventory, billing, supplier, reporting, credit, and order management features
                available in this system.
              </p>
              <p className="mt-3 text-sm leading-7 text-gray-600 sm:text-base">
                By using this application, you agree to the collection and use of information as
                described below for operating the service, supporting store administration, and
                protecting account security.
              </p>
              <p className="mt-3 text-sm leading-7 text-gray-600 sm:text-base">
                This policy also includes privacy information related to the customer mobile app,
                including account creation, OTP verification, ordering, payment, delivery, and
                return workflows.
              </p>
            </div>

            <div className="mt-8 grid gap-5 md:grid-cols-2">
              {policySections.map((section) => {
                const Icon = section.icon;

                return (
                  <section
                    key={section.title}
                    className="rounded-2xl border border-gray-200 bg-gray-50 p-5 sm:p-6"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-100 text-red-600">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h2 className="text-lg font-semibold text-gray-900">{section.title}</h2>
                    </div>

                    <div className="mt-4 space-y-3 text-sm leading-7 text-gray-600">
                      {section.content.map((item) => (
                        <p key={item}>{item}</p>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>

            <section className="mt-5 rounded-2xl border border-gray-200 bg-red-50 p-5 sm:p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-600">
                Mobile App Privacy
              </p>
              <h2 className="mt-2 text-xl font-semibold text-gray-900">
                Customer app disclosures
              </h2>
              <p className="mt-3 text-sm leading-7 text-gray-600">
                The mobile application privacy details below are intended to align with in-app
                disclosures and app store data safety descriptions for customer-facing features.
              </p>

              <div className="mt-5 space-y-4">
                {mobileAppSections.map((section) => (
                  <div
                    key={section.title}
                    className="rounded-2xl border border-red-100 bg-white p-4 sm:p-5"
                  >
                    <h3 className="text-base font-semibold text-gray-900">{section.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-gray-600">{section.body}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
              <h2 className="text-lg font-semibold text-gray-900">Your choices and contact details</h2>
              <div className="mt-4 space-y-3 text-sm leading-7 text-gray-600">
                <p>
                  You may request updates to account details, ask for operational data corrections,
                  or contact the support team if you need help understanding how information is used
                  in the system.
                </p>
                <p>
                  For privacy-related questions, support requests, or account assistance, please
                  contact the support team through the official business contact channels or email{" "}
                  <a
                    href={`mailto:${SUPPORT_EMAIL}`}
                    className="font-medium text-red-600 hover:text-red-700 hover:underline"
                  >
                    {SUPPORT_EMAIL}
                  </a>
                  .
                </p>
                <p>
                  Users can request account deletion by contacting{" "}
                  <a
                    href="mailto:jprsupermarket@gmail.com"
                    className="font-medium text-red-600 hover:text-red-700 hover:underline"
                  >
                    jprsupermarket@gmail.com
                  </a>
                  .
                </p>
                <p>
                  We may update this Privacy Policy from time to time to reflect product changes,
                  legal requirements, or security improvements. Continued use of the application
                  after updates means the revised policy will apply.
                </p>
              </div>
            </section>

            <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
              <h2 className="text-lg font-semibold text-gray-900">Mobile app contact information</h2>
              <div className="mt-4 space-y-3 text-sm leading-7 text-gray-600">
                <p>
                  Company name: {MOBILE_COMPANY_NAME}
                  <br />
                  Contact email: {SUPPORT_EMAIL}
                  <br />
                  Contact phone: {MOBILE_CONTACT_PHONE}
                  <br />
                  Business address: {MOBILE_CONTACT_ADDRESS}
                </p>
                <p>
                  If you have questions, complaints, or privacy-related requests about the mobile
                  app, please use the contact details listed above.
                </p>
              </div>
            </section>
          </div>
        </div>
      </main>

      <footer className="bg-red-600 min-h-14 sm:min-h-16 w-full">
        <div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4 md:px-6 lg:px-8">
          <div className="text-center text-xs text-white sm:text-sm sm:text-left">
            Privacy information for web and mobile app usage
          </div>
          <div className="text-center text-xs text-white sm:text-sm">
            © {currentYear} Murugan Super Mart. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
