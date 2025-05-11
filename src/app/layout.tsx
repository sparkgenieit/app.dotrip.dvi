import "@/styles/globals.css";

export const metadata = {
  title: "doTrip - Rent a Car",
  description: "Affordable, reliable car rentals.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
