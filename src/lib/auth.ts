import { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "./db";

export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID || "demo-github-id",
      clientSecret: process.env.GITHUB_SECRET || "demo-github-secret",
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_ID || "demo-google-id",
      clientSecret: process.env.GOOGLE_SECRET || "demo-google-secret",
    }),
    CredentialsProvider({
      name: "Demo Login",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "you@example.com" },
        name: { label: "Name", type: "text", placeholder: "Your Name" },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;
        const email = credentials.email as string;
        const name = (credentials.name as string) || email.split("@")[0];
        let user = await db.user.findUnique({ where: { email } });
        if (!user) {
          user = await db.user.create({
            data: { email, name },
          });
        }
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        if (account?.provider !== "credentials") {
          let dbUser = await db.user.findUnique({ where: { email: user.email! } });
          if (!dbUser) {
            dbUser = await db.user.create({
              data: {
                email: user.email!,
                name: user.name,
                image: user.image,
              },
            });
          } else if (user.image && !dbUser.image) {
            dbUser = await db.user.update({
              where: { id: dbUser.id },
              data: { image: user.image },
            });
          }
          token.id = dbUser.id;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        (session.user as any).id = token.id;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
  secret: process.env.NEXTAUTH_SECRET || "splitflow-super-secret-key-change-in-production",
};
