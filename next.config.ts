import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Allow football-data.org and Groq during server-side fetches
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000'] },
  },
}

export default nextConfig
