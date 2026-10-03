import { Logo } from "@/components/ui";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-10">
      <div className="mb-8">
        <Logo className="text-2xl" />
        <p className="mt-1 text-sm text-ink-2">75 Ann Street, London, Ontario</p>
      </div>
      {children}
    </main>
  );
}
