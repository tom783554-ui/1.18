import dynamic from "next/dynamic";

const Viewer = dynamic(() => import("../app/viewer/Viewer"), { ssr: false });

export default function IndexPage() {
  return (
    <main style={{ width: "100vw", height: "100vh" }}>
      <Viewer />
    </main>
  );
}
