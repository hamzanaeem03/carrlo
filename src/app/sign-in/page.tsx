import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";

async function signInAction(formData: FormData) {
  "use server";

  try {
    await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/sign-in?error=CredentialsSignin");
    }
    throw error;
  }
}

export default function SignInPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  const hasError = searchParams?.error === "CredentialsSignin";

  return (
    <main className="min-h-screen bg-[#FDFBF9] flex items-center justify-center px-4">
      <section className="w-full max-w-md rounded-lg border border-[#eadfce] bg-white p-8 shadow-sm">
        <div className="mb-8">
          <p className="text-sm font-semibold text-[#F6A60C]">Carrlo</p>
          <h1 className="mt-2 text-2xl font-semibold text-[#252525]">
            Sign in to operations
          </h1>
          <p className="mt-2 text-sm text-[#666]">
            Demo seed user: owner@carrlo.test / CarrloDemo123!
          </p>
        </div>

        {hasError ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Invalid email or password.
          </div>
        ) : null}

        <form action={signInAction} className="space-y-4">
          <label className="block text-sm font-medium text-[#252525]">
            Email
            <input
              name="email"
              type="email"
              required
              className="mt-1 w-full rounded-md border border-[#ddd3c5] px-3 py-2 text-sm outline-none focus:border-[#F6A60C]"
            />
          </label>
          <label className="block text-sm font-medium text-[#252525]">
            Password
            <input
              name="password"
              type="password"
              required
              className="mt-1 w-full rounded-md border border-[#ddd3c5] px-3 py-2 text-sm outline-none focus:border-[#F6A60C]"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-md bg-[#252525] px-4 py-2 text-sm font-semibold text-white hover:bg-black"
          >
            Sign in
          </button>
        </form>
      </section>
    </main>
  );
}
