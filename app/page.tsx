import { Hero } from "@/components/sections/Hero";
import { Experience } from "@/components/sections/Experience";
import { PastMenus } from "@/components/sections/PastMenus";
import { Membership } from "@/components/sections/Membership";
import { UpcomingDinner } from "@/components/sections/UpcomingDinner";

export default function Home() {
  return (
    <>
      <Hero />
      <Experience />
      <PastMenus />
      <Membership />
      <UpcomingDinner />
    </>
  );
}
