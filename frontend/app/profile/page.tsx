import type { Metadata } from "next";

import { ProfilePage } from "./profile-page";

export const metadata: Metadata = {
  title: "Profile",
  description: "Update your PicTools email and password.",
};

export default function ProfileRoute() {
  return <ProfilePage />;
}
