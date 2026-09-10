import type { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";
import { getServerSession } from "next-auth";
import { dbConnect } from "@/lib/mongodb";
import { User } from "@/models/User";
import { DEMO_USER, demoMode } from "@/lib/demo";

export const authOptions: NextAuthOptions = {
  providers: [
    // Only present when every demo-mode gate passes, so this cannot appear on
    // a deployed build even if DEMO_MODE leaks into the environment.
    ...(demoMode()
      ? [
          CredentialsProvider({
            id: "demo",
            name: "Demo account",
            credentials: {},
            async authorize() {
              await dbConnect();
              const user = await User.findOneAndUpdate(
                { githubId: DEMO_USER.githubId },
                {
                  $setOnInsert: {
                    ...DEMO_USER,
                    languages: ["TypeScript", "Python"],
                    interests: [],
                    level: "beginner",
                    suggestedLanguages: [],
                    skillGraphStatus: "skipped",
                    onboardedAt: new Date(),
                  },
                },
                { upsert: true, new: true },
              );
              return { id: String(user._id), name: user.name, email: null };
            },
          }),
        ]
      : []),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
      // Only what we need: profile + email. No repo write scope.
      authorization: { params: { scope: "read:user user:email" } },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/" },
  callbacks: {
    async jwt({ token, account, profile, user }) {
      // A demo sign-in carries no OAuth profile, so it is keyed off the user
      // the credentials provider returned instead.
      if (demoMode() && account?.provider === "demo" && user) {
        await dbConnect();
        const demo = await User.findById(user.id).lean();
        token.uid = String(user.id);
        token.username = demo?.username ?? DEMO_USER.username;
        token.avatarUrl = demo?.avatarUrl ?? "";
      }

      // `account` is only present on the sign-in request itself.
      if (account && profile) {
        const gh = profile as {
          id: number;
          login: string;
          avatar_url?: string;
          name?: string;
        };
        await dbConnect();

        const githubId = String(gh.id);
        let user = await User.findOne({ githubId });

        if (!user) {
          // First login: seed language suggestions from their public repos.
          // Imported lazily so the GitHub client stays out of the static graph
          // of every route that merely reads the session. Nothing on the
          // request path should be able to reach an API client by accident.
          const { inferUserLanguages } = await import("@/lib/github");
          const suggested = await inferUserLanguages(
            gh.login,
            account.access_token as string | undefined,
          );
          user = await User.create({
            githubId,
            username: gh.login,
            avatarUrl: gh.avatar_url ?? "",
            name: gh.name ?? "",
            suggestedLanguages: suggested,
            interests: [],
            languages: [],
            // Computed later, off the login path, when the profile is first viewed.
            skillGraphStatus: "pending",
          });
        } else {
          // Keep the profile snapshot current on every sign-in.
          user.username = gh.login;
          user.avatarUrl = gh.avatar_url ?? user.avatarUrl;
          user.name = gh.name ?? user.name;
          await user.save();
        }

        token.uid = String(user._id);
        token.username = user.username;
        token.avatarUrl = user.avatarUrl;
      }

      // `onboarded` can change mid-session, so it is refreshed rather than pinned.
      if (token.uid) {
        await dbConnect();
        const fresh = await User.findById(token.uid).select("onboardedAt").lean();
        token.onboarded = Boolean(fresh?.onboardedAt);
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.uid as string) ?? "";
        session.user.username = (token.username as string) ?? "";
        session.user.avatarUrl = (token.avatarUrl as string) ?? "";
        session.user.onboarded = Boolean(token.onboarded);
      }
      return session;
    },
  },
};

export function auth() {
  return getServerSession(authOptions);
}

/** The Mongo user document for the current session, or null. */
export async function currentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  await dbConnect();
  return User.findById(session.user.id);
}
