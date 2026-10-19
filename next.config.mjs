/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["sharp"],
  async redirects() {
    // Die alte vercel.app-Adresse leitet dauerhaft auf die Hauptdomain weiter, damit Google
    // keine doppelten Inhalte sieht. Preview-Deployments (andere Hosts) sind nicht betroffen.
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "schaden-ki-tool.vercel.app" }],
        destination: "https://fahrzeug-schadenrechner.stefan-witmaier.de/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
