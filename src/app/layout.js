import localFont from "next/font/local";
import "./globals.css";
import Buttoncomp from "./components/Button";
import ResponsiveDrawer from "./components/Drawer";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/Poppins-Regular.ttf",
  variable: "--font-geist-mono",
  weight: "100 900",
});

// const poppins = localFont({
//   src: "./fonts/GeistMonoVF.woff",
//   variable: "--font-geist-mono",
//   weight: "100 900",
// });

export const metadata = {
  title: "Carrlo",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased w-screen h-screen`}
      >
        <ResponsiveDrawer>{children}</ResponsiveDrawer>{" "}
      </body>
    </html>
  );
}
