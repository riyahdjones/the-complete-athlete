import './globals.css';

export const metadata = {
  title: 'The Complete Athlete Admin',
  description: 'Private admin dashboard for The Complete Athlete'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
