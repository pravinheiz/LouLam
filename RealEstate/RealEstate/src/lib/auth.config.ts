import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { AuthService } from "@/services/auth.service";
import { Role } from "@/types/db";
import { db } from "@/lib/db";

export const authConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID || "mock_google_id",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "mock_google_secret",
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await AuthService.verifyCredentials(
          credentials.email as string,
          credentials.password as string
        );

        if (!user || (user as any).status === "BANNED") {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        try {
          const email = user.email?.trim().toLowerCase();
          if (!email) return false;

          // Check if user already exists
          const existing = await db.user.findFirst({
            where: { email },
          });

          if (existing?.status === "BANNED") {
            return false;
          }

          if (!existing) {
            // Create user profile
            await db.user.create({
              data: {
                name: user.name || "Google User",
                email,
                image: user.image || null,
                role: Role.BUYER,
                phone: "",
                phoneVerified: false,
                dateOfBirth: "",
              },
            });
          }
        } catch (err) {
          console.error("Error signing in Google user:", err);
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: Role }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
} satisfies NextAuthConfig;
