import { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import { db } from "./db";

export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_ID!,
      clientSecret: process.env.GOOGLE_SECRET!,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        if (account?.provider === "github" || account?.provider === "google") {
          try {
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
            token.dbSynced = true;
          } catch (dbError) {
            console.error("[auth] DB sync failed:", dbError);
            token.id = user.id;
            token.dbSynced = false;
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        (session.user as any).id = token.id;
        (session.user as any).dbSynced = token.dbSynced;
      }
      return session;
    },
  },
  pages: {
    signIn: "/app",
  },
  secret: process.env.NEXTAUTH_SECRET!,
};
