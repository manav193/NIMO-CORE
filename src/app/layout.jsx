import './globals.css';

export const metadata = {
  title: 'MIMO Core — AI Study Platform',
  description: 'Multidisciplinary AI study workspace for science, mathematics and computer science.'
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
