"use client";

import dynamic from "next/dynamic";

const Chat = dynamic(() => import("./chat"), { ssr: false });

export default function Home() {
  return <Chat />;
}
