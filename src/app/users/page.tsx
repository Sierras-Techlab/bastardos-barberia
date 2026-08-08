import type { Metadata } from "next";

import { UsersView } from "@/components/users/users-view";
import { requireManagerPage } from "@/lib/auth/authorization";

export const metadata: Metadata = {
  title: "Usuarios",
  description: "Administrá los accesos y datos del equipo de Bastardos Barbería.",
};

const UsersPage = async () => {
  const { user } = await requireManagerPage();

  return (
    <div className="min-h-full px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <UsersView currentUser={user} />
    </div>
  );
};

export default UsersPage;
