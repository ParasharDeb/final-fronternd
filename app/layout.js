export const metadata = {
  title: "Pixel Tile Builder",
  description: "Tilemap editor + playable top-down prototype",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#1b1b1f", fontFamily: "system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
