import { Nav } from "@/components/nav";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-28 pt-[max(1.5rem,env(safe-area-inset-top))]">
        {children}
      </main>
      <Nav />
    </>
  );
}
