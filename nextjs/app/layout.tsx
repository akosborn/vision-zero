import type { Metadata } from "next";
import "./globals.css";
import { GoogleAnalytics } from "@next/third-parties/google";
import {
  ColorSchemeScript,
  mantineHtmlProps,
  MantineProvider,
} from "@mantine/core";
import { theme } from "@/theme";
import React from "react";
import "@mantine/carousel/styles.css";

// const geistSans = Geist({
//   variable: "--font-geist-sans",
//   subsets: ["latin"],
// });
//
// const geistMono = Geist_Mono({
//   variable: "--font-geist-mono",
//   subsets: ["latin"],
// });

export const metadata: Metadata = {
  title: "Denver Zero Vision Crash Map",
  description: "Review Denver crash data",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript />
        <meta
          name="viewport"
          content="minimum-scale=1, initial-scale=1, width=device-width, user-scalable=no"
        />
      </head>
      <body
      // className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <GoogleAnalytics gaId={"G-YVLXJHRQ6T"} />
        <MantineProvider theme={theme}>
          {/*<ThemeProvider*/}
          {/*  attribute="class"*/}
          {/*  defaultTheme="system"*/}
          {/*  enableSystem*/}
          {/*  disableTransitionOnChange*/}
          {/*>*/}
          {children}
          {/*</ThemeProvider>*/}
        </MantineProvider>
      </body>
    </html>
  );
}
